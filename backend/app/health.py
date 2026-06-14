from __future__ import annotations

from typing import Optional, TypedDict

from .models import ActivityLevel, Gender

ACTIVITY_MULTIPLIERS = {
    ActivityLevel.sedentary: 1.2,
    ActivityLevel.lightly_active: 1.375,
    ActivityLevel.moderately_active: 1.55,
    ActivityLevel.very_active: 1.725,
    ActivityLevel.extra_active: 1.9,
}


class HealthMetrics(TypedDict):
    bmi: float
    bmi_category: str
    bmr: float
    tdee: Optional[float]
    healthy_weight_min_kg: float
    healthy_weight_max_kg: float
    target_weight_kg: Optional[float]


def bmi_category(bmi: float) -> str:
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Normal"
    if bmi < 30:
        return "Overweight"
    return "Obese"


def compute_bmr(weight_kg: float, height_cm: float, age: int, gender: Gender) -> float:
    """Mifflin-St Jeor equation. 'Other' uses the average of the male/female offsets."""
    base = 10 * weight_kg + 6.25 * height_cm - 5 * age
    if gender == Gender.male:
        return base + 5
    if gender == Gender.female:
        return base - 161
    return base - 78  # average of (+5) and (-161)


def build_health_metrics(
    height_cm: Optional[float],
    weight_kg: Optional[float],
    age: Optional[int],
    gender: Optional[Gender],
    activity_level: Optional[ActivityLevel],
) -> Optional[HealthMetrics]:
    if height_cm is None or weight_kg is None or age is None or gender is None:
        return None

    height_m = height_cm / 100
    bmi = weight_kg / (height_m ** 2)
    bmr = compute_bmr(weight_kg, height_cm, age, gender)
    tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level] if activity_level is not None else None

    healthy_min = 18.5 * height_m ** 2
    healthy_max = 24.9 * height_m ** 2

    target_weight_kg: Optional[float] = None
    if weight_kg < healthy_min:
        target_weight_kg = healthy_min
    elif weight_kg > healthy_max:
        target_weight_kg = healthy_max

    return HealthMetrics(
        bmi=round(bmi, 1),
        bmi_category=bmi_category(bmi),
        bmr=round(bmr),
        tdee=round(tdee) if tdee is not None else None,
        healthy_weight_min_kg=round(healthy_min, 1),
        healthy_weight_max_kg=round(healthy_max, 1),
        target_weight_kg=round(target_weight_kg, 1) if target_weight_kg is not None else None,
    )
