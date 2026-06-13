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
    ClientDetailOut,
    ClientOut,
    RecentWorkoutItem,
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
        .limit(20)
    ).scalars().all()

    recent: List[RecentWorkoutItem] = [
        RecentWorkoutItem(
            kind="logged",
            body_part=w.body_part,
            exercise=w.exercise,
            date=w.date,
            sets=w.sets,
            reps=w.reps,
            weight=w.weight,
            created_at=w.created_at,
        )
        for w in workouts
    ] + [
        RecentWorkoutItem(
            kind="assigned",
            body_part=a.body_part,
            exercise=a.exercise,
            created_at=a.created_at,
        )
        for a in assigned
    ]
    recent.sort(key=lambda item: item.created_at, reverse=True)
    recent = recent[:20]

    dates = crud.get_workout_dates(db, client.id)

    return ClientDetailOut(
        id=client.id,
        name=client.name,
        goal=client.exerciser_profile.goal,
        total_workouts=len(dates),
        streak=crud.compute_streak(dates),
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
