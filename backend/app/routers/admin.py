from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import crud
from ..database import get_db
from ..deps import require_role
from ..logging_config import logger
from ..models import AccountStatus, ApprovalStatus, Role, User
from ..schemas import (
    AdminDashboardOut,
    AdminTrainerOut,
    AdminUserOut,
    PasswordUpdate,
    PhoneUpdate,
    StatusUpdate,
)
from ..security import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])

require_admin = require_role(Role.admin)


def _get_user_with_role_or_404(db: Session, user_id: int, role: Role) -> User:
    user = db.get(User, user_id)
    if user is None or user.role != role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return user


def _admin_user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        status=user.status,
        goal=user.exerciser_profile.goal if user.exerciser_profile else None,
        phone=user.exerciser_profile.phone if user.exerciser_profile else None,
    )


def _admin_trainer_out(trainer: User) -> AdminTrainerOut:
    return AdminTrainerOut(
        id=trainer.id,
        name=trainer.name,
        email=trainer.email,
        status=trainer.status,
        specialty=trainer.trainer_profile.specialty,
        experience_years=trainer.trainer_profile.experience_years,
        approval_status=trainer.trainer_profile.approval_status,
        phone=trainer.trainer_profile.phone,
    )


@router.get("/dashboard", response_model=AdminDashboardOut)
def dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return AdminDashboardOut(
        total_users=crud.total_users(db),
        active_trainers=crud.active_trainers_count(db),
        workouts_this_week=crud.workouts_this_week(db),
        workouts_today=crud.workouts_today(db),
    )


# ---------- Users (exercisers) ----------


@router.get("/users", response_model=List[AdminUserOut])
def list_users(
    status_filter: Optional[AccountStatus] = Query(default=None, alias="status"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = select(User).where(User.role == Role.exerciser)
    if status_filter is not None:
        query = query.where(User.status == status_filter)

    users = db.execute(query).scalars().all()
    return [_admin_user_out(u) for u in users]


@router.get("/users/{user_id}", response_model=AdminUserOut)
def get_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = _get_user_with_role_or_404(db, user_id, Role.exerciser)
    return _admin_user_out(user)


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
def set_user_status(
    user_id: int,
    payload: StatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_with_role_or_404(db, user_id, Role.exerciser)
    user.status = payload.status
    db.commit()

    logger.info("Admin id=%s set user id=%s status=%s", admin.id, user.id, payload.status.value)

    return _admin_user_out(user)


@router.patch("/users/{user_id}/phone", response_model=AdminUserOut)
def set_user_phone(
    user_id: int,
    payload: PhoneUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_with_role_or_404(db, user_id, Role.exerciser)
    if user.exerciser_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exerciser profile not found")

    user.exerciser_profile.phone = payload.phone
    db.commit()

    logger.info("Admin id=%s set phone for user id=%s", admin.id, user.id)

    return _admin_user_out(user)


@router.patch("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_user_password(
    user_id: int,
    payload: PasswordUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = _get_user_with_role_or_404(db, user_id, Role.exerciser)
    user.hashed_password = hash_password(payload.new_password)
    db.commit()

    logger.info("Admin id=%s reset password for user id=%s", admin.id, user.id)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = _get_user_with_role_or_404(db, user_id, Role.exerciser)
    db.delete(user)
    db.commit()

    logger.info("Admin id=%s deleted user id=%s", admin.id, user_id)


# ---------- Trainers ----------


@router.get("/trainers", response_model=List[AdminTrainerOut])
def list_trainers(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    trainers = db.execute(select(User).where(User.role == Role.trainer)).scalars().all()
    return [_admin_trainer_out(t) for t in trainers]


@router.get("/trainers/{trainer_id}", response_model=AdminTrainerOut)
def get_trainer(trainer_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    return _admin_trainer_out(trainer)


@router.patch("/trainers/{trainer_id}/approve", response_model=AdminTrainerOut)
def approve_trainer(trainer_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    trainer.trainer_profile.approval_status = ApprovalStatus.approved
    db.commit()

    logger.info("Admin id=%s approved trainer id=%s", admin.id, trainer.id)

    return _admin_trainer_out(trainer)


@router.patch("/trainers/{trainer_id}/status", response_model=AdminTrainerOut)
def set_trainer_status(
    trainer_id: int,
    payload: StatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    trainer.status = payload.status
    db.commit()

    logger.info("Admin id=%s set trainer id=%s status=%s", admin.id, trainer.id, payload.status.value)

    return _admin_trainer_out(trainer)


@router.patch("/trainers/{trainer_id}/phone", response_model=AdminTrainerOut)
def set_trainer_phone(
    trainer_id: int,
    payload: PhoneUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    trainer.trainer_profile.phone = payload.phone
    db.commit()

    logger.info("Admin id=%s set phone for trainer id=%s", admin.id, trainer.id)

    return _admin_trainer_out(trainer)


@router.patch("/trainers/{trainer_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def reset_trainer_password(
    trainer_id: int,
    payload: PasswordUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    trainer.hashed_password = hash_password(payload.new_password)
    db.commit()

    logger.info("Admin id=%s reset password for trainer id=%s", admin.id, trainer.id)


@router.delete("/trainers/{trainer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trainer(trainer_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    trainer = _get_user_with_role_or_404(db, trainer_id, Role.trainer)
    db.delete(trainer)
    db.commit()

    logger.info("Admin id=%s deleted trainer id=%s", admin.id, trainer_id)
