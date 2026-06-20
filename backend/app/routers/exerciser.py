from __future__ import annotations

from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
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
    NoteAuthor,
    Role,
    TrainerNote,
    TrainerProfile,
    Unavailability,
    User,
    Workout,
    WorkoutSet,
)
from ..schemas import (
    AssignedWorkoutOut,
    DashboardOut,
    ExerciserProfileOut,
    ExerciserProfileUpdate,
    LeaveNoteIn,
    TrainerListItem,
    TrainerSelect,
    UnavailableDateOut,
    WorkoutLogCreate,
    WorkoutOut,
    WorkoutSetOut,
    WorkoutUpdate,
)

router = APIRouter(prefix="/api", tags=["exerciser"])

require_exerciser = require_role(Role.exerciser)


def _workout_out(workout: Workout) -> WorkoutOut:
    assigned = workout.assigned_workout
    trainer = assigned.trainer
    return WorkoutOut(
        id=workout.id,
        assigned_workout_id=workout.assigned_workout_id,
        body_part=assigned.body_part,
        exercise=assigned.exercise,
        trainer_name=trainer.name if trainer else "Former trainer",
        date=workout.date,
        sets=[
            WorkoutSetOut(set_number=s.set_number, reps=s.reps, weight=s.weight)
            for s in workout.sets
        ],
    )


def _get_own_assigned_workout_or_404(db: Session, user: User, assigned_id: int) -> AssignedWorkout:
    assigned = db.get(AssignedWorkout, assigned_id)
    if assigned is None or assigned.exerciser_id != user.id or not assigned.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assigned exercise not found")
    return assigned


def _get_own_workout_or_404(db: Session, user: User, workout_id: int) -> Workout:
    workout = db.get(Workout, workout_id)
    if workout is None or workout.exerciser_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workout not found")
    return workout


@router.get("/exerciser/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    return DashboardOut(
        workouts_this_week=crud.workouts_this_week(db, exerciser_id=user.id),
        days_since_last_workout=crud.days_since_last_workout(db, exerciser_id=user.id),
    )


@router.patch("/exerciser/profile", response_model=ExerciserProfileOut)
def update_profile(
    payload: ExerciserProfileUpdate,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    profile = user.exerciser_profile
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)

    logger.info("Exerciser id=%s updated health profile", user.id)
    return profile


@router.get("/exerciser/workouts", response_model=List[WorkoutOut])
def list_workouts(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    workouts = db.execute(
        select(Workout)
        .where(Workout.exerciser_id == user.id)
        .order_by(Workout.date.desc(), Workout.id.desc())
    ).scalars().all()
    return [_workout_out(w) for w in workouts]


@router.patch("/exerciser/workouts/{workout_id}", response_model=WorkoutOut)
def update_workout(
    workout_id: int,
    payload: WorkoutUpdate,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    workout = _get_own_workout_or_404(db, user, workout_id)

    if payload.date is not None:
        workout.date = payload.date

    workout.sets.clear()
    for set_number, set_in in enumerate(payload.sets, start=1):
        workout.sets.append(WorkoutSet(set_number=set_number, reps=set_in.reps, weight=set_in.weight))

    db.commit()
    db.refresh(workout)

    logger.info(
        "Workout updated: exerciser_id=%s workout_id=%s sets=%s",
        user.id, workout.id, len(payload.sets),
    )
    return _workout_out(workout)


@router.delete("/exerciser/workouts/{workout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(workout_id: int, user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    workout = _get_own_workout_or_404(db, user, workout_id)

    db.delete(workout)
    db.commit()

    logger.info("Workout deleted: exerciser_id=%s workout_id=%s", user.id, workout_id)


@router.get("/exerciser/assigned-workouts", response_model=List[AssignedWorkoutOut])
def list_assigned_workouts(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    return db.execute(
        select(AssignedWorkout)
        .where(AssignedWorkout.exerciser_id == user.id, AssignedWorkout.active.is_(True))
        .order_by(AssignedWorkout.created_at.desc())
    ).scalars().all()


@router.post(
    "/exerciser/assigned-workouts/{assigned_id}/log",
    response_model=WorkoutOut,
    status_code=status.HTTP_201_CREATED,
)
def log_assigned_workout(
    assigned_id: int,
    payload: WorkoutLogCreate,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    assigned = _get_own_assigned_workout_or_404(db, user, assigned_id)

    workout = Workout(
        exerciser_id=user.id,
        assigned_workout_id=assigned.id,
        date=payload.date or date.today(),
    )
    for set_number, set_in in enumerate(payload.sets, start=1):
        workout.sets.append(WorkoutSet(set_number=set_number, reps=set_in.reps, weight=set_in.weight))

    db.add(workout)
    db.commit()
    db.refresh(workout)

    logger.info(
        "Workout logged: exerciser_id=%s assigned_workout_id=%s exercise=%s sets=%s",
        user.id, assigned.id, assigned.exercise, len(payload.sets),
    )
    return _workout_out(workout)


@router.get("/exerciser/assigned-workouts/{assigned_id}/last", response_model=WorkoutOut)
def last_log_for_assigned_workout(
    assigned_id: int,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    assigned = _get_own_assigned_workout_or_404(db, user, assigned_id)

    workout = db.execute(
        select(Workout)
        .where(Workout.assigned_workout_id == assigned.id)
        .order_by(Workout.date.desc(), Workout.id.desc())
        .limit(1)
    ).scalars().first()

    if workout is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No previous session for this exercise")

    return _workout_out(workout)


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
            phone=t.trainer_profile.phone,
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
    user.exerciser_profile.trainer_joined_at = datetime.utcnow()
    db.commit()

    logger.info("Exerciser id=%s selected trainer_id=%s", user.id, trainer.id)

    return TrainerListItem(
        id=trainer.id,
        name=trainer.name,
        specialty=trainer.trainer_profile.specialty,
        experience_years=trainer.trainer_profile.experience_years,
        phone=trainer.trainer_profile.phone,
    )


@router.get("/exerciser/trainer/unavailability", response_model=List[UnavailableDateOut])
def trainer_unavailability(user: User = Depends(require_exerciser), db: Session = Depends(get_db)):
    trainer_id = user.exerciser_profile.trainer_id
    if trainer_id is None:
        return []

    return db.execute(
        select(Unavailability)
        .where(Unavailability.user_id == trainer_id, Unavailability.date >= date.today())
        .order_by(Unavailability.date.asc())
    ).scalars().all()


@router.delete("/exerciser/trainer", response_model=ExerciserProfileOut)
def leave_trainer(
    payload: LeaveNoteIn,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    profile = user.exerciser_profile
    if profile.trainer_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No trainer selected")

    trainer_id = profile.trainer_id

    note = TrainerNote(
        trainer_id=trainer_id,
        exerciser_id=user.id,
        exerciser_name=user.name,
        author=NoteAuthor.exerciser,
        note=payload.note,
    )
    db.add(note)

    assigned_workouts = db.execute(
        select(AssignedWorkout).where(
            AssignedWorkout.exerciser_id == user.id,
            AssignedWorkout.trainer_id == trainer_id,
            AssignedWorkout.active.is_(True),
        )
    ).scalars().all()
    for assigned in assigned_workouts:
        assigned.active = False

    logger.info("Exerciser id=%s left trainer_id=%s", user.id, trainer_id)
    profile.trainer_id = None
    profile.trainer_joined_at = None
    db.commit()
    db.refresh(profile)

    return profile
