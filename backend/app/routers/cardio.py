from __future__ import annotations

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_approved_trainer, require_role
from ..logging_config import logger
from ..models import CardioExercise, CardioSession, ExerciserProfile, Role, User
from ..schemas import CardioExerciseCreate, CardioExerciseOut, CardioSessionCreate, CardioSessionOut

router = APIRouter(prefix="/api", tags=["cardio"])

require_exerciser = require_role(Role.exerciser)


def _session_out(s: CardioSession) -> CardioSessionOut:
    ex = s.cardio_exercise
    return CardioSessionOut(
        id=s.id,
        cardio_exercise_id=s.cardio_exercise_id,
        exercise_name=ex.name if ex else "(Deleted)",
        exercise_icon=ex.icon if ex else "🏃",
        duration_minutes=s.duration_minutes,
        calories_burned=s.calories_burned,
        date=s.date,
    )


# ── Trainer endpoints ────────────────────────────────────────────────────────

@router.get("/trainer/cardio-exercises", response_model=List[CardioExerciseOut])
def list_trainer_cardio_exercises(
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    return db.execute(
        select(CardioExercise)
        .where(CardioExercise.trainer_id == trainer.id)
        .order_by(CardioExercise.name)
    ).scalars().all()


@router.post("/trainer/cardio-exercises", response_model=CardioExerciseOut, status_code=status.HTTP_201_CREATED)
def create_cardio_exercise(
    payload: CardioExerciseCreate,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(CardioExercise).where(
            CardioExercise.trainer_id == trainer.id,
            CardioExercise.name == payload.name.strip(),
        )
    ).scalars().first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Exercise already exists")

    ex = CardioExercise(
        trainer_id=trainer.id,
        name=payload.name.strip(),
        icon=payload.icon,
        tracks_calories=payload.tracks_calories,
    )
    db.add(ex)
    db.commit()
    db.refresh(ex)
    logger.info("Trainer %s created cardio exercise: %s", trainer.id, ex.name)
    return ex


@router.delete("/trainer/cardio-exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cardio_exercise(
    exercise_id: int,
    trainer: User = Depends(require_approved_trainer),
    db: Session = Depends(get_db),
):
    ex = db.get(CardioExercise, exercise_id)
    if ex is None or ex.trainer_id != trainer.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found")

    has_sessions = db.execute(
        select(CardioSession).where(CardioSession.cardio_exercise_id == exercise_id).limit(1)
    ).scalars().first()
    if has_sessions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete — clients have sessions logged for this exercise",
        )

    db.delete(ex)
    db.commit()


# ── Exerciser endpoints ──────────────────────────────────────────────────────

@router.get("/exerciser/cardio-exercises", response_model=List[CardioExerciseOut])
def list_exerciser_cardio_exercises(
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    trainer_id = user.exerciser_profile.trainer_id if user.exerciser_profile else None
    if not trainer_id:
        return []
    return db.execute(
        select(CardioExercise)
        .where(CardioExercise.trainer_id == trainer_id)
        .order_by(CardioExercise.name)
    ).scalars().all()


@router.get("/exerciser/cardio-sessions", response_model=List[CardioSessionOut])
def list_cardio_sessions(
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    sessions = db.execute(
        select(CardioSession)
        .where(CardioSession.exerciser_id == user.id)
        .order_by(CardioSession.date.desc(), CardioSession.id.desc())
    ).scalars().all()
    return [_session_out(s) for s in sessions]


@router.post("/exerciser/cardio-sessions", response_model=CardioSessionOut, status_code=status.HTTP_201_CREATED)
def log_cardio_session(
    payload: CardioSessionCreate,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    ex = db.get(CardioExercise, payload.cardio_exercise_id)
    if ex is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cardio exercise not found")

    session = CardioSession(
        exerciser_id=user.id,
        cardio_exercise_id=payload.cardio_exercise_id,
        duration_minutes=payload.duration_minutes,
        calories_burned=payload.calories_burned,
        date=payload.date or date.today(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    logger.info("Exerciser %s logged cardio: %s %smin", user.id, ex.name, payload.duration_minutes)
    return _session_out(session)


@router.delete("/exerciser/cardio-sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cardio_session(
    session_id: int,
    user: User = Depends(require_exerciser),
    db: Session = Depends(get_db),
):
    s = db.get(CardioSession, session_id)
    if s is None or s.exerciser_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    db.delete(s)
    db.commit()
