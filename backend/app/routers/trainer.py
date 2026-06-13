from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db
from ..deps import require_approved_trainer
from ..logging_config import logger
from ..models import AssignedWorkout, ExerciserProfile, User, Workout
from ..schemas import (
    AssignWorkoutCreate,
    AssignedWorkoutOut,
    AssignedWorkoutUpdate,
    ClientDetailOut,
    ClientOut,
    RecentWorkoutItem,
    WorkoutSetOut,
)

router = APIRouter(prefix="/api/trainer", tags=["trainer"])


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
    if assigned is None or assigned.exerciser_id != client.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned exercise not found")
    return assigned


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
            )
        )
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
        .where(AssignedWorkout.exerciser_id == client.id)
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

    return ClientDetailOut(
        id=client.id,
        name=client.name,
        goal=client.exerciser_profile.goal,
        total_workouts=len(dates),
        streak=crud.compute_streak(dates),
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

    assigned = AssignedWorkout(
        exerciser_id=client.id,
        trainer_id=trainer.id,
        body_part=payload.body_part,
        exercise=payload.exercise,
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
