from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import (
    AccountStatus,
    ApprovalStatus,
    CardioLog,
    Role,
    User,
    Workout,
)


def compute_streak(workout_dates: List[date]) -> int:
    """Consecutive days with a logged workout, ending today or yesterday."""
    if not workout_dates:
        return 0

    unique_dates = set(workout_dates)
    today = date.today()

    if today in unique_dates:
        cursor = today
    elif (today - timedelta(days=1)) in unique_dates:
        cursor = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in unique_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def get_workout_dates(db: Session, exerciser_id: int) -> List[date]:
    rows = db.execute(
        select(Workout.date).where(Workout.exerciser_id == exerciser_id)
    ).scalars().all()
    return list(rows)


def workouts_this_week(db: Session, exerciser_id: Optional[int] = None) -> int:
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())

    query = select(func.count(Workout.id)).where(Workout.date >= start_of_week)
    if exerciser_id is not None:
        query = query.where(Workout.exerciser_id == exerciser_id)

    return db.execute(query).scalar_one()


def workouts_today(db: Session) -> int:
    today = date.today()
    return db.execute(
        select(func.count(Workout.id)).where(Workout.date == today)
    ).scalar_one()


def days_since_last_workout(db: Session, exerciser_id: int) -> Optional[int]:
    last_date = db.execute(
        select(func.max(Workout.date)).where(Workout.exerciser_id == exerciser_id)
    ).scalar_one()
    if last_date is None:
        return None
    return (date.today() - last_date).days


def total_users(db: Session) -> int:
    return db.execute(
        select(func.count(User.id)).where(User.role == Role.exerciser)
    ).scalar_one()


def active_trainers_count(db: Session) -> int:
    from .models import TrainerProfile

    return db.execute(
        select(func.count(User.id))
        .join(TrainerProfile, TrainerProfile.user_id == User.id)
        .where(
            User.role == Role.trainer,
            User.status == AccountStatus.active,
            TrainerProfile.approval_status == ApprovalStatus.approved,
        )
    ).scalar_one()


def cardio_logs_for(db: Session, exerciser_id: int) -> List[CardioLog]:
    return list(
        db.execute(
            select(CardioLog)
            .where(CardioLog.exerciser_id == exerciser_id)
            .order_by(CardioLog.date.desc(), CardioLog.id.desc())
        ).scalars()
    )
