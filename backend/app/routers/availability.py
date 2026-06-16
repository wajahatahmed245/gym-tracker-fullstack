from __future__ import annotations

from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..logging_config import logger
from ..models import Unavailability, User
from ..schemas import UnavailabilityCreate, UnavailableDateOut

router = APIRouter(prefix="/api/me", tags=["availability"])


@router.get("/unavailability", response_model=List[UnavailableDateOut])
def list_unavailability(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.execute(
        select(Unavailability)
        .where(Unavailability.user_id == user.id, Unavailability.date >= date.today())
        .order_by(Unavailability.date.asc())
    ).scalars().all()


@router.post("/unavailability", response_model=UnavailableDateOut, status_code=status.HTTP_201_CREATED)
def add_unavailability(
    payload: UnavailabilityCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        select(Unavailability).where(
            Unavailability.user_id == user.id, Unavailability.date == payload.date
        )
    ).scalars().first()
    if existing is not None:
        return existing

    entry = Unavailability(user_id=user.id, date=payload.date)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    logger.info("User id=%s marked unavailable on %s", user.id, payload.date)
    return entry


@router.delete("/unavailability/{target_date}", status_code=status.HTTP_204_NO_CONTENT)
def remove_unavailability(
    target_date: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = db.execute(
        select(Unavailability).where(
            Unavailability.user_id == user.id, Unavailability.date == target_date
        )
    ).scalars().first()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unavailable date not found")

    db.delete(entry)
    db.commit()

    logger.info("User id=%s removed unavailable date %s", user.id, target_date)
