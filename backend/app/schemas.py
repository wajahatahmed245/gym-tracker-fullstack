from __future__ import annotations

from datetime import date as date_type, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import (
    AccountStatus,
    ApprovalStatus,
    BodyPart,
    CardioActivity,
    Goal,
    NoteAuthor,
    Role,
    Specialty,
)


# ---------- Auth ----------


class ExerciserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    goal: Goal = Goal.general_fitness


class TrainerSignup(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    specialty: Specialty
    experience_years: int = Field(ge=0, default=0)
    phone: str = Field(min_length=7, max_length=30)


class LoginRequest(BaseModel):
    role: Role
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: Role
    status: AccountStatus
    created_at: datetime


class ExerciserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    goal: Goal
    trainer_id: Optional[int] = None


class TrainerProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    specialty: Specialty
    experience_years: int
    phone: Optional[str] = None
    approval_status: ApprovalStatus


class MeOut(UserOut):
    exerciser_profile: Optional[ExerciserProfileOut] = None
    trainer_profile: Optional[TrainerProfileOut] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: MeOut


# ---------- Exerciser ----------


class DashboardOut(BaseModel):
    workouts_this_week: int
    days_since_last_workout: Optional[int] = None


class WorkoutSetIn(BaseModel):
    reps: int = Field(gt=0)
    weight: float = Field(ge=0)


class WorkoutSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    set_number: int
    reps: int
    weight: float


class WorkoutLogCreate(BaseModel):
    sets: List[WorkoutSetIn] = Field(min_length=1)
    date: Optional[date_type] = None


class WorkoutOut(BaseModel):
    id: int
    assigned_workout_id: int
    body_part: BodyPart
    exercise: str
    date: date_type
    sets: List[WorkoutSetOut]


class CardioCreate(BaseModel):
    activity: CardioActivity
    duration_minutes: int = Field(gt=0)
    date: Optional[date_type] = None


class CardioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activity: CardioActivity
    duration_minutes: int
    date: date_type


class AssignedWorkoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    body_part: BodyPart
    exercise: str
    created_at: datetime
    updated_at: datetime


class TrainerListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    specialty: Specialty
    experience_years: int
    phone: Optional[str] = None


class TrainerSelect(BaseModel):
    trainer_id: int


class LeaveNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


class WorkoutUpdate(BaseModel):
    sets: List[WorkoutSetIn] = Field(min_length=1)
    date: Optional[date_type] = None


# ---------- Trainer ----------


class ClientOut(BaseModel):
    id: int
    name: str
    last_workout_date: Optional[date_type] = None
    total_workouts: int
    streak: int


class RecentWorkoutItem(BaseModel):
    body_part: BodyPart
    exercise: str
    date: date_type
    sets: List[WorkoutSetOut]
    created_at: datetime


class ClientDetailOut(BaseModel):
    id: int
    name: str
    goal: Goal
    total_workouts: int
    streak: int
    assigned_workouts: List[AssignedWorkoutOut]
    recent_workouts: List[RecentWorkoutItem]


class AssignWorkoutCreate(BaseModel):
    body_part: BodyPart
    exercise: str = Field(min_length=1, max_length=120)


class AssignedWorkoutUpdate(BaseModel):
    body_part: Optional[BodyPart] = None
    exercise: Optional[str] = Field(default=None, min_length=1, max_length=120)


class TrainerNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exerciser_name: str
    author: NoteAuthor
    note: str
    created_at: datetime


# ---------- Admin ----------


class AdminDashboardOut(BaseModel):
    total_users: int
    active_trainers: int
    workouts_this_week: int
    workouts_today: int


class AdminUserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    status: AccountStatus
    goal: Optional[Goal] = None


class AdminTrainerOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    status: AccountStatus
    specialty: Specialty
    experience_years: int
    approval_status: ApprovalStatus


class StatusUpdate(BaseModel):
    status: AccountStatus


class PasswordUpdate(BaseModel):
    new_password: str = Field(min_length=6)
