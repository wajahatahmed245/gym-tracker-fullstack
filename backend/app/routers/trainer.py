from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from .. import health as health_calc
from ..database import get_db
from ..deps import require_approved_trainer
from ..logging_config import logger
from ..models import AssignedWorkout, Exercise, ExerciserProfile, NoteAuthor, TrainerNote, Unavailability, User, Workout
from ..schemas import (
    AssignWorkoutCreate,
    AssignedWorkoutOut,
    AssignedWorkoutUpdate,
    ClientDetailOut,
    ClientOut,
    ClientUnavailabilityOut,
    ExerciseOut,
    LeaveNoteIn,
    RecentWorkoutItem,
    TrainerNoteOut,
    WorkoutSetOut,
)

router = APIRouter(prefix="/api/trainer", tags=["trainer"])


def _upsert_exercise_library(db: Session, trainer_id: int, body_part, name: str) -> None:
    """Insert exercise into trainer's library, or update body_part if the name already exists."""
    normalized = name.strip().lower()
    existing = db.execute(
        select(Exercise).where(Exercise.trainer_id == trainer_id, Exercise.name_normalized == normalized)
    ).scalars().first()
    if existing is None:
        db.add(Exercise(trainer_id=trainer_id, body_part=body_part, name=name.strip(), name_normalized=normalized))
    elif existing.body_part != body_part:
        existing.body_part = body_part


def _get_client_or_404(db: Session, trainer: User, exerciser_id: int) -> User:
    client = db.get(User, exerciser_id)
    if (
        client is None
        or client.exerciser_profile is None
        or client.exerciser_profile.trainer_id != trainer.id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


def _get_client_assigned_workout_or_404(db: Session, client: User, assigned_id: int) -> AssignedWorkout:
    assigned = db.get(AssignedWorkout, assigned_id)
    if assigned is None or assigned.exerciser_id != client.id or not assigned.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned exercise not found")
    return assigned


@router.get("/exercises", response_model=List[ExerciseOut])
def list_exercises(
    body_part: Optional[str] = None,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    """Return the trainer's personal exercise library, optionally filtered by body_part."""
    q = select(Exercise).where(Exercise.trainer_id == trainer.id).order_by(Exercise.name)
    if body_part:
        q = q.where(Exercise.body_part == body_part)
    return db.execute(q).scalars().all()


@router.get("/clients", response_model=List[ClientOut])
def list_clients(trainer: User = Depends(require_approved_trainer), db: Session = Depends(get_db)):
    clients = db.execute(
        select(User)
        .join(ExerciserProfile, ExerciserProfile.user_id == User.id)
        .where(ExerciserProfile.trainer_id == trainer.id)
    ).scalars().all()

    result = []
    for client in clients:
        dates = crud.get_workout_dates(db, client.id)
        result.append(
            ClientOut(
                id=client.id,
                name=client.name,
                last_workout_date=max(dates) if dates else None,
                total_workouts=len(dates),
                streak=crud.compute_streak(dates),
                joined_at=client.exerciser_profile.trainer_joined_at,
            )
        )
    return result


@router.get("/clients/unavailability", response_model=List[ClientUnavailabilityOut])
def clients_unavailability(trainer: User = Depends(require_approved_trainer), db: Session = Depends(get_db)):
    clients = db.execute(
        select(User)
        .join(ExerciserProfile, ExerciserProfile.user_id == User.id)
        .where(ExerciserProfile.trainer_id == trainer.id)
    ).scalars().all()

    result = []
    for client in clients:
        dates = db.execute(
            select(Unavailability.date)
            .where(Unavailability.user_id == client.id, Unavailability.date >= date.today())
            .order_by(Unavailability.date.asc())
        ).scalars().all()
        if dates:
            result.append(ClientUnavailabilityOut(exerciser_id=client.id, name=client.name, dates=dates))
    return result


@router.get("/clients/{exerciser_id}", response_model=ClientDetailOut)
def client_detail(
    exerciser_id: int,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer, exerciser_id)

    workouts = db.execute(
        select(Workout)
        .where(Workout.exerciser_id == client.id)
        .order_by(Workout.created_at.desc())
        .limit(20)
    ).scalars().all()

    assigned = db.execute(
        select(AssignedWorkout)
        .where(AssignedWorkout.exerciser_id == client.id, AssignedWorkout.active.is_(True))
        .order_by(AssignedWorkout.created_at.desc())
    ).scalars().all()

    recent = [
        RecentWorkoutItem(
            body_part=w.assigned_workout.body_part,
            exercise=w.assigned_workout.exercise,
            date=w.date,
            sets=[
                WorkoutSetOut(set_number=s.set_number, reps=s.reps, weight=s.weight)
                for s in w.sets
            ],
            created_at=w.created_at,
        )
        for w in workouts
    ]

    dates = crud.get_workout_dates(db, client.id)

    profile = client.exerciser_profile
    metrics = health_calc.build_health_metrics(
        profile.height_cm, profile.weight_kg, profile.age, profile.gender, profile.activity_level
    )

    unavailable_dates = db.execute(
        select(Unavailability.date)
        .where(Unavailability.user_id == client.id, Unavailability.date >= date.today())
        .order_by(Unavailability.date.asc())
    ).scalars().all()

    return ClientDetailOut(
        id=client.id,
        name=client.name,
        goal=profile.goal,
        total_workouts=len(dates),
        streak=crud.compute_streak(dates),
        joined_at=profile.trainer_joined_at,
        health=metrics,
        phone=profile.phone,
        unavailable_dates=unavailable_dates,
        assigned_workouts=assigned,
        recent_workouts=recent,
    )


@router.post(
    "/clients/{exerciser_id}/assign-workout",
    response_model=AssignedWorkoutOut,
    status_code=status.HTTP_201_CREATED,
)
def assign_workout(
    exerciser_id: int,
    payload: AssignWorkoutCreate,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer, exerciser_id)

    is_unavailable_today = db.execute(
        select(Unavailability).where(
            Unavailability.user_id == client.id, Unavailability.date == date.today()
        )
    ).scalars().first()
    if is_unavailable_today is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{client.name} has marked today as unavailable",
        )

    # Save / update in trainer's exercise library
    _upsert_exercise_library(db, trainer.id, payload.body_part, payload.exercise)

    # Reuse existing AssignedWorkout for the same exerciser + exercise (case-insensitive)
    name_normalized = payload.exercise.strip().lower()
    existing = db.execute(
        select(AssignedWorkout).where(
            AssignedWorkout.exerciser_id == client.id,
            AssignedWorkout.trainer_id == trainer.id,
        )
    ).scalars().all()
    match = next(
        (a for a in existing if a.exercise.strip().lower() == name_normalized),
        None,
    )

    if match is not None:
        if not match.active:
            match.active = True
            match.body_part = payload.body_part
            db.commit()
            db.refresh(match)
            logger.info(
                "Trainer id=%s reactivated assigned workout id=%s for exerciser_id=%s",
                trainer.id, match.id, client.id,
            )
        db.commit()
        return match

    assigned = AssignedWorkout(
        exerciser_id=client.id,
        trainer_id=trainer.id,
        body_part=payload.body_part,
        exercise=payload.exercise.strip(),
    )
    db.add(assigned)
    db.commit()
    db.refresh(assigned)

    logger.info(
        "Trainer id=%s assigned workout to exerciser_id=%s: body_part=%s exercise=%s",
        trainer.id, client.id, assigned.body_part.value, assigned.exercise,
    )
    return assigned


@router.patch(
    "/clients/{exerciser_id}/assigned-workouts/{assigned_id}",
    response_model=AssignedWorkoutOut,
)
def update_assigned_workout(
    exerciser_id: int,
    assigned_id: int,
    payload: AssignedWorkoutUpdate,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer, exerciser_id)
    assigned = _get_client_assigned_workout_or_404(db, client, assigned_id)

    if payload.body_part is not None:
        assigned.body_part = payload.body_part
    if payload.exercise is not None:
        assigned.exercise = payload.exercise

    db.commit()
    db.refresh(assigned)

    logger.info(
        "Trainer id=%s updated assigned_workout_id=%s for exerciser_id=%s: body_part=%s exercise=%s",
        trainer.id, assigned.id, client.id, assigned.body_part.value, assigned.exercise,
    )
    return assigned


@router.delete(
    "/clients/{exerciser_id}/assigned-workouts/{assigned_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_assigned_workout(
    exerciser_id: int,
    assigned_id: int,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer, exerciser_id)
    assigned = _get_client_assigned_workout_or_404(db, client, assigned_id)

    db.delete(assigned)
    db.commit()

    logger.info(
        "Trainer id=%s removed assigned_workout_id=%s for exerciser_id=%s",
        trainer.id, assigned_id, client.id,
    )


@router.delete("/clients/{exerciser_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_client(
    exerciser_id: int,
    payload: LeaveNoteIn,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    client = _get_client_or_404(db, trainer, exerciser_id)

    note = TrainerNote(
        trainer_id=trainer.id,
        exerciser_id=client.id,
        exerciser_name=client.name,
        author=NoteAuthor.trainer,
        note=payload.note,
    )
    db.add(note)

    assigned_workouts = db.execute(
        select(AssignedWorkout).where(
            AssignedWorkout.exerciser_id == client.id,
            AssignedWorkout.trainer_id == trainer.id,
            AssignedWorkout.active.is_(True),
        )
    ).scalars().all()
    for assigned in assigned_workouts:
        assigned.active = False

    client.exerciser_profile.trainer_id = None
    client.exerciser_profile.trainer_joined_at = None
    db.commit()

    logger.info("Trainer id=%s removed client exerciser_id=%s", trainer.id, client.id)


@router.get("/notes", response_model=List[TrainerNoteOut])
def list_notes(trainer: User = Depends(require_approved_trainer), db: Session = Depends(get_db)):
    return db.execute(
        select(TrainerNote)
        .where(TrainerNote.trainer_id == trainer.id)
        .order_by(TrainerNote.created_at.desc())
    ).scalars().all()
