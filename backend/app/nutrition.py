"""
Nutrition prompt logic for GymTrack.

Pure Python, framework-agnostic -- wrap these functions in a FastAPI route
(see nutrition_router.py) or call them directly from existing endpoints.

All formulas below come directly from the book's pre/post-workout chapter:

  Pre-workout (30 min before training):
    - Protein: 30-40g (skip if 20g+ protein already eaten in the last 1-2 hrs)
    - Carbs:   40-50g
    - Fat:     no benefit either way, not included in prompts

  Post-workout (immediately after training):
    - Protein: 30-40g
    - Carbs:   1g per kg of body weight
    - Optional second dose ~2 hrs later: half that carb amount

  Cardio sessions:
    - Any session: some protein beforehand is smart
    - Only sessions 60+ minutes AND intense (e.g. with sprinting) need a
      post-workout protein/carb prompt at all
"""

from dataclasses import dataclass, field
from typing import List, Literal, Optional
from .food_data import FOODS

MealType = Literal["pre_workout", "post_workout", "post_workout_second_dose"]


@dataclass
class NutritionTarget:
    meal_type: MealType
    protein_g_min: float
    protein_g_max: float
    carbs_g: float
    message: str
    food_suggestions: list = field(default_factory=list)


def _recent_protein_covers_pre_workout(minutes_since_last_protein_meal: Optional[int],
                                        grams_in_that_meal: Optional[float]) -> bool:
    """
    Returns True if the user already ate enough protein recently that the
    pre-workout protein prompt can be skipped, per the book's rule:
    skip if 20g+ protein was eaten within the last 1-2 hours (120 min).
    """
    if minutes_since_last_protein_meal is None or grams_in_that_meal is None:
        return False
    return minutes_since_last_protein_meal <= 120 and grams_in_that_meal >= 20


def get_pre_workout_target(minutes_since_last_protein_meal: Optional[int] = None,
                            grams_in_that_meal: Optional[float] = None) -> NutritionTarget:
    skip_protein = _recent_protein_covers_pre_workout(
        minutes_since_last_protein_meal, grams_in_that_meal
    )

    if skip_protein:
        message = "You've already had enough protein recently — just have 40-50g of carbs about 30 minutes before training."
        protein_min, protein_max = 0, 0
    else:
        message = "About 30 minutes before training: eat 30-40g of protein (whey works best) and 40-50g of carbs."
        protein_min, protein_max = 30, 40

    return NutritionTarget(
        meal_type="pre_workout",
        protein_g_min=protein_min,
        protein_g_max=protein_max,
        carbs_g=45,  # midpoint of 40-50g range, used for food-matching only
        message=message,
        food_suggestions=_suggest_foods(
            categories=(["pre_workout_protein"] if not skip_protein else []) + ["pre_workout_carb"],
            carb_target_g=45,
            protein_target_g=35 if not skip_protein else 0,
        ),
    )


def get_post_workout_target(body_weight_kg: float) -> NutritionTarget:
    carbs_g = round(body_weight_kg * 1.0, 1)
    message = f"Right after training: eat 30-40g of protein and about {carbs_g}g of carbs."

    return NutritionTarget(
        meal_type="post_workout",
        protein_g_min=30,
        protein_g_max=40,
        carbs_g=carbs_g,
        message=message,
        food_suggestions=_suggest_foods(
            categories=["post_workout_protein", "post_workout_carb"],
            carb_target_g=carbs_g,
            protein_target_g=35,
        ),
    )


def get_post_workout_second_dose(body_weight_kg: float) -> NutritionTarget:
    """Optional, per the book: about half the post-workout carb amount, ~2 hours later."""
    carbs_g = round(body_weight_kg * 0.5, 1)
    message = f"Optional, about 2 hours after training: another {carbs_g}g of carbs can help top off energy stores."

    return NutritionTarget(
        meal_type="post_workout_second_dose",
        protein_g_min=0,
        protein_g_max=0,
        carbs_g=carbs_g,
        message=message,
        food_suggestions=_suggest_foods(
            categories=["post_workout_carb"],
            carb_target_g=carbs_g,
            protein_target_g=0,
        ),
    )


def should_show_cardio_post_workout_prompt(duration_minutes: int, high_intensity: bool) -> bool:
    """
    Per the book: post-workout protein/carb only matters for cardio when the
    session is long AND intense (60+ minutes, with sprinting/high effort).
    Otherwise, only a pre-workout protein reminder is needed.
    """
    return duration_minutes >= 60 and high_intensity


def _suggest_foods(categories: List[str], carb_target_g: float, protein_target_g: float,
                    max_results: int = 4) -> List[dict]:
    """
    Very simple recommendation: pull foods from the requested categories,
    ranked by how close a single serving lands to the smaller of the two
    (carb or protein) targets, since a real meal is usually built from more
    than one food. This keeps suggestions realistic ("banana + whey shake")
    rather than pretending one food should hit the whole target alone.
    """
    candidates = [f for f in FOODS if f["category"] in categories]

    def distance(food: dict) -> float:
        # Prefer foods that don't wildly overshoot either macro target
        carb_gap = abs(food["carbs_g"] - carb_target_g) if carb_target_g else 0
        protein_gap = abs(food["protein_g"] - protein_target_g) if protein_target_g else 0
        return carb_gap + protein_gap

    ranked = sorted(candidates, key=distance)

    # de-duplicate by name (same food can appear in two categories)
    seen = set()
    results = []
    for food in ranked:
        if food["name"] in seen:
            continue
        seen.add(food["name"])
        results.append(food)
        if len(results) >= max_results:
            break

    return results
