from __future__ import annotations

import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Role(str, enum.Enum):
    exerciser = "exerciser"
    trainer = "trainer"
    admin = "admin"


class AccountStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"


class Goal(str, enum.Enum):
    weight_loss = "Weight Loss"
    muscle_gain = "Muscle Gain"
    general_fitness = "General Fitness"
    endurance = "Endurance"


class Specialty(str, enum.Enum):
    strength_training = "Strength Training"
    cardio_weight_loss = "Cardio & Weight Loss"
    bodybuilding = "Bodybuilding"
    crossfit = "CrossFit"
    yoga_mobility = "Yoga & Mobility"


class BodyPart(str, enum.Enum):
    chest = "Chest"
    back = "Back"
    legs = "Legs"
    shoulders = "Shoulders"
    arms = "Arms"
    core = "Core"


class CardioActivity(str, enum.Enum):
    running = "Running"
    cycling = "Cycling"
    swimming = "Swimming"
    rowing = "Rowing"
    walking = "Walking"
    elliptical = "Elliptical"


class NoteAuthor(str, enum.Enum):
    trainer = "trainer"
    exerciser = "exerciser"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    status: Mapped[AccountStatus] = mapped_column(
        Enum(AccountStatus), nullable=False, default=AccountStatus.active
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    exerciser_profile: Mapped[Optional["ExerciserProfile"]] = relationship(
        "ExerciserProfile",
        back_populates="user",
        uselist=False,
        foreign_keys="ExerciserProfile.user_id",
        cascade="all, delete-orphan",
    )
    trainer_profile: Mapped[Optional["TrainerProfile"]] = relationship(
        "TrainerProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class ExerciserProfile(Base):
    __tablename__ = "exerciser_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    goal: Mapped[Goal] = mapped_column(Enum(Goal), nullable=False, default=Goal.general_fitness)
    trainer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="exerciser_profile", foreign_keys=[user_id])
    trainer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[trainer_id])


class TrainerProfile(Base):
    __tablename__ = "trainer_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    specialty: Mapped[Specialty] = mapped_column(Enum(Specialty), nullable=False)
    experience_years: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus), nullable=False, default=ApprovalStatus.pending
    )

    user: Mapped["User"] = relationship("User", back_populates="trainer_profile")


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    exerciser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    assigned_workout_id: Mapped[int] = mapped_column(
        ForeignKey("assigned_workouts.id"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    assigned_workout: Mapped["AssignedWorkout"] = relationship("AssignedWorkout", back_populates="logs")
    sets: Mapped[List["WorkoutSet"]] = relationship(
        "WorkoutSet",
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.set_number",
    )


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id"), nullable=False, index=True)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)

    workout: Mapped["Workout"] = relationship("Workout", back_populates="sets")


class AssignedWorkout(Base):
    __tablename__ = "assigned_workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    exerciser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    body_part: Mapped[BodyPart] = mapped_column(Enum(BodyPart), nullable=False)
    exercise: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    logs: Mapped[List["Workout"]] = relationship(
        "Workout", back_populates="assigned_workout", cascade="all, delete-orphan"
    )


class CardioLog(Base):
    __tablename__ = "cardio_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    exerciser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    activity: Mapped[CardioActivity] = mapped_column(Enum(CardioActivity), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class TrainerNote(Base):
    __tablename__ = "trainer_notes"

    id: Mapped[int] = mapped_column(primary_key=True)
    trainer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    exerciser_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    exerciser_name: Mapped[str] = mapped_column(String(120), nullable=False)
    author: Mapped[NoteAuthor] = mapped_column(Enum(NoteAuthor), nullable=False)
    note: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
