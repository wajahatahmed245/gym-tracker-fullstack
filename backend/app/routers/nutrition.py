from fastapi import APIRouter, Depends, Query
from typing import Optional

from ..deps import get_current_user
from ..models import User
from ..nutrition import (
    get_pre_workout_target,
    get_post_workout_target,
    get_post_workout_second_dose,
    should_show_cardio_post_workout_prompt,
)

router = APIRouter(prefix="/api/nutrition", tags=["nutrition"])


@router.get("/pre-workout")
def pre_workout_prompt(
    minutes_since_last_protein_meal: Optional[int] = Query(None),
    grams_in_that_meal: Optional[float] = Query(None),
    current_user: User = Depends(get_current_user),
):
    target = get_pre_workout_target(minutes_since_last_protein_meal, grams_in_that_meal)
    return target


@router.get("/post-workout")
def post_workout_prompt(
    current_user: User = Depends(get_current_user),
):
    weight_kg = current_user.exerciser_profile.weight_kg if current_user.exerciser_profile else 75.0
    target = get_post_workout_target(weight_kg or 75.0)
    return target


@router.get("/post-workout/second-dose")
def post_workout_second_dose_prompt(
    current_user: User = Depends(get_current_user),
):
    weight_kg = current_user.exerciser_profile.weight_kg if current_user.exerciser_profile else 75.0
    target = get_post_workout_second_dose(weight_kg or 75.0)
    return target


@router.get("/cardio/should-show-post-prompt")
def cardio_post_prompt_check(
    duration_minutes: int = Query(...),
    high_intensity: bool = Query(False),
    current_user: User = Depends(get_current_user),
):
    return {"show_post_workout_prompt": should_show_cardio_post_workout_prompt(duration_minutes, high_intensity)}
