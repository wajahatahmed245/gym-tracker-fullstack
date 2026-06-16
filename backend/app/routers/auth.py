from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..logging_config import logger
from ..models import (
    AccountStatus,
    ExerciserProfile,
    Role,
    TrainerProfile,
    User,
)
from ..schemas import (
    ExerciserSignup,
    LoginRequest,
    MeOut,
    Token,
    TrainerSignup,
)
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.execute(select(User).where(User.email == email)).scalars().first()


@router.post("/signup/exerciser", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup_exerciser(payload: ExerciserSignup, db: Session = Depends(get_db)):
    if _get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.exerciser,
        status=AccountStatus.active,
    )
    db.add(user)
    db.flush()

    profile = ExerciserProfile(
        user_id=user.id,
        goal=payload.goal,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        age=payload.age,
        gender=payload.gender,
        activity_level=payload.activity_level,
        phone=payload.phone,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    logger.info("New exerciser signup: id=%s email=%s", user.id, user.email)

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=MeOut.model_validate(user))


@router.post("/signup/trainer", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup_trainer(payload: TrainerSignup, db: Session = Depends(get_db)):
    if _get_user_by_email(db, payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=Role.trainer,
        status=AccountStatus.active,
    )
    db.add(user)
    db.flush()

    profile = TrainerProfile(
        user_id=user.id,
        specialty=payload.specialty,
        experience_years=payload.experience_years,
        phone=payload.phone,
    )
    db.add(profile)
    db.commit()
    db.refresh(user)

    logger.info("New trainer signup (pending approval): id=%s email=%s", user.id, user.email)

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=MeOut.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = _get_user_by_email(db, payload.email)

    if user is None or user.role != payload.role or not verify_password(payload.password, user.hashed_password):
        logger.warning("Failed login attempt for email=%s role=%s", payload.email, payload.role.value)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.status != AccountStatus.active:
        logger.warning("Login rejected for inactive account: id=%s email=%s", user.id, user.email)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    logger.info("User logged in: id=%s email=%s role=%s", user.id, user.email, user.role.value)

    token = create_access_token(str(user.id))
    return Token(access_token=token, user=MeOut.model_validate(user))


@router.get("/me", response_model=MeOut)
def read_me(user: User = Depends(get_current_user)):
    return MeOut.model_validate(user)
