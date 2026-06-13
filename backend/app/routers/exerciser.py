from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db
from ..deps import require_role
from ..logging_config import logger
from ..models import (
    AccountStatus,
    ApprovalStatus,
    AssignedWorkout,
    BodyPart,
    CardioLog,
    Role,
    TrainerProfile,
    User,
    Workout,
)
from ..schemas import (
    AssignedWorkoutOut,
    CardioCreate,
    CardioOut,
    DashboardOut,
    TrainerListItem,
    TrainerSelect,
    WorkoutCreate,
    WorkoutOut,
)

router = APIRouter(prefix="/api", tags=["exerciser"])

require_exerciser = require_role(Role.exerciser)


@router.get("/exerciser/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    return DashboardOut(
        workouts_this_week=crud.workouts_this_week(db, exerciser_id=user.id),
        days_since_last_workout=crud.days_since_last_workout(db, exerciser_id=user.id),
    )


@router.get("/exerciser/workouts", response_model=List[WorkoutOut])
def list_workouts(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    workouts = db.execute(
        select(Workout)
        .where(Workout.exerciser_id == user.id)
        .order_by(Workout.date.desc(), Workout.id.desc())
    ).scalars().all()
    return workouts


@router.post("/exerciser/workouts", response_model=WorkoutOut, status_code=status.HTTP_201_CREATED)
def log_workout(payload: WorkoutCreate, user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    workout = Workout(
        exerciser_id=user.id,
        body_part=payload.body_part,
        exercise=payload.exercise,
        sets=payload.sets,
        reps=payload.reps,
        weight=payload.weight,
        date=payload.date or date.today(),
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)

    logger.info(
        "Workout logged: exerciser_id=%s body_part=%s exercise=%s",
        user.id, workout.body_part.value, workout.exercise,
    )
    return workout


@router.get("/exerciser/workouts/last", response_model=WorkoutOut)
def last_workout_for_body_part(
    body_part: BodyPart = Query(...),
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    workout = db.execute(
        select(Workout)
        .where(Workout.exerciser_id == user.id, Workout.body_part == body_part)
        .order_by(Workout.date.desc(), Workout.id.desc())
        .limit(1)
    ).scalars().first()

    if workout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No previous session for this body part")

    return workout


@router.get("/exerciser/cardio", response_model=List[CardioOut])
def list_cardio(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    return crud.cardio_logs_for(db, exerciser_id=user.id)


@router.post("/exerciser/cardio", response_model=CardioOut, status_code=status.HTTP_201_CREATED)
def log_cardio(payload: CardioCreate, user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    cardio = CardioLog(
        exerciser_id=user.id,
        activity=payload.activity,
        duration_minutes=payload.duration_minutes,
        date=payload.date or date.today(),
    )
    db.add(cardio)
    db.commit()
    db.refresh(cardio)

    logger.info(
        "Cardio logged: exerciser_id=%s activity=%s duration=%s",
        user.id, cardio.activity.value, cardio.duration_minutes,
    )
    return cardio


@router.get("/exerciser/assigned-workouts", response_model=List[AssignedWorkoutOut])
def list_assigned_workouts(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    return db.execute(
        select(AssignedWorkout)
        .where(AssignedWorkout.exerciser_id == user.id)
        .order_by(AssignedWorkout.created_at.desc())
    ).scalars().all()


@router.get("/trainers", response_model=List[TrainerListItem])
def list_trainers(db: Session = Depends(get_db)):
    rows = db.execute(
        select(User)
        .join(TrainerProfile, TrainerProfile.user_id == User.id)
        .where(
            User.status == AccountStatus.active,
            TrainerProfile.approval_status == ApprovalStatus.approved,
        )
    ).scalars().all()

    return [
        TrainerListItem(
            id=t.id,
            name=t.name,
            specialty=t.trainer_profile.specialty,
            experience_years=t.trainer_profile.experience_years,
        )
        for t in rows
    ]


@router.patch("/exerciser/trainer", response_model=TrainerListItem)
def select_trainer(payload: TrainerSelect, user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    trainer = db.get(User, payload.trainer_id)
    if (
        trainer is None
        or trainer.role != Role.trainer
        or trainer.trainer_profile is None
        or trainer.trainer_profile.approval_status != ApprovalStatus.approved
        or trainer.status != AccountStatus.active
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")

    user.exerciser_profile.trainer_id = trainer.id
    db.commit()

    logger.info("Exerciser id=%s selected trainer_id=%s", user.id, trainer.id)

    return TrainerListItem(
        id=trainer.id,
        name=trainer.name,
        specialty=trainer.trainer_profile.specialty,
        experience_years=trainer.trainer_profile.experience_years,
    )
