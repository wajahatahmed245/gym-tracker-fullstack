"""
Seed food data for the pre/post-workout food recommendation feature.

Values are approximate macros per one typical serving, sourced from the
book's own suggested food lists (pre-workout carbs, nutrient-dense foods).
This is intentionally a small, curated list -- not a full nutrition
database -- so recommendations stay fast, simple, and food-list-accurate.

category values:
  "pre_workout_carb"   -> fast, easy-to-digest carb sources for before training
  "pre_workout_protein"-> fast-digesting protein sources for before training
  "post_workout_protein" -> fast-digesting, leucine-rich protein for after training
  "post_workout_carb"  -> general carb sources good for refilling glycogen
  "general"             -> nutrient-dense whole foods for any meal
"""

FOODS = [
    # ---- Pre-workout carbs (book's named examples) ----
    {"name": "Banana (large)", "category": "pre_workout_carb", "protein_g": 1.5, "carbs_g": 31, "fat_g": 0.4, "serving": "1 large banana"},
    {"name": "Rice milk", "category": "pre_workout_carb", "protein_g": 0.5, "carbs_g": 22, "fat_g": 2.5, "serving": "1 cup (240ml)"},
    {"name": "Instant oatmeal", "category": "pre_workout_carb", "protein_g": 5, "carbs_g": 27, "fat_g": 3, "serving": "1 packet, prepared"},
    {"name": "Dates", "category": "pre_workout_carb", "protein_g": 0.4, "carbs_g": 18, "fat_g": 0, "serving": "3 dates"},
    {"name": "Figs (dried)", "category": "pre_workout_carb", "protein_g": 1, "carbs_g": 20, "fat_g": 0.2, "serving": "3 figs"},
    {"name": "Melon", "category": "pre_workout_carb", "protein_g": 1, "carbs_g": 13, "fat_g": 0.2, "serving": "1 cup, cubed"},
    {"name": "White potato", "category": "pre_workout_carb", "protein_g": 2, "carbs_g": 26, "fat_g": 0, "serving": "1 medium potato"},
    {"name": "White rice", "category": "pre_workout_carb", "protein_g": 4, "carbs_g": 45, "fat_g": 0.4, "serving": "1 cup, cooked"},
    {"name": "Raisins", "category": "pre_workout_carb", "protein_g": 1, "carbs_g": 29, "fat_g": 0.2, "serving": "1/4 cup"},
    {"name": "Sweet potato", "category": "pre_workout_carb", "protein_g": 2, "carbs_g": 24, "fat_g": 0.1, "serving": "1 medium potato"},

    # ---- Pre/post-workout protein (fast digesting, book-recommended) ----
    {"name": "Whey protein shake", "category": "pre_workout_protein", "protein_g": 25, "carbs_g": 3, "fat_g": 1.5, "serving": "1 scoop + water"},
    {"name": "Whey protein shake", "category": "post_workout_protein", "protein_g": 25, "carbs_g": 3, "fat_g": 1.5, "serving": "1 scoop + water"},
    {"name": "Egg protein powder", "category": "post_workout_protein", "protein_g": 24, "carbs_g": 1, "fat_g": 0, "serving": "1 scoop"},
    {"name": "Chicken breast", "category": "post_workout_protein", "protein_g": 31, "carbs_g": 0, "fat_g": 3.6, "serving": "4 oz, cooked"},
    {"name": "Greek yogurt (nonfat)", "category": "post_workout_protein", "protein_g": 17, "carbs_g": 6, "fat_g": 0, "serving": "170g container"},
    {"name": "Cottage cheese", "category": "post_workout_protein", "protein_g": 12, "carbs_g": 4, "fat_g": 1, "serving": "1/2 cup"},

    # ---- Post-workout carbs (general refeed-friendly) ----
    {"name": "White rice", "category": "post_workout_carb", "protein_g": 4, "carbs_g": 45, "fat_g": 0.4, "serving": "1 cup, cooked"},
    {"name": "Sweet potato", "category": "post_workout_carb", "protein_g": 2, "carbs_g": 24, "fat_g": 0.1, "serving": "1 medium potato"},
    {"name": "Banana (large)", "category": "post_workout_carb", "protein_g": 1.5, "carbs_g": 31, "fat_g": 0.4, "serving": "1 large banana"},
    {"name": "White bread", "category": "post_workout_carb", "protein_g": 3, "carbs_g": 24, "fat_g": 1, "serving": "2 slices"},

    # ---- General nutrient-dense foods (from the book's whole-food list) ----
    {"name": "Salmon", "category": "general", "protein_g": 34, "carbs_g": 0, "fat_g": 13, "serving": "4 oz, cooked"},
    {"name": "Lean beef", "category": "general", "protein_g": 28, "carbs_g": 0, "fat_g": 10, "serving": "4 oz, cooked"},
    {"name": "Turkey breast", "category": "general", "protein_g": 30, "carbs_g": 0, "fat_g": 1, "serving": "4 oz, cooked"},
    {"name": "Eggs", "category": "general", "protein_g": 6, "carbs_g": 0.5, "fat_g": 5, "serving": "1 large egg"},
    {"name": "Quinoa", "category": "general", "protein_g": 8, "carbs_g": 39, "fat_g": 3.5, "serving": "1 cup, cooked"},
    {"name": "Brown rice", "category": "general", "protein_g": 5, "carbs_g": 45, "fat_g": 1.8, "serving": "1 cup, cooked"},
    {"name": "Lentils", "category": "general", "protein_g": 18, "carbs_g": 40, "fat_g": 0.8, "serving": "1 cup, cooked"},
    {"name": "Almonds", "category": "general", "protein_g": 6, "carbs_g": 6, "fat_g": 14, "serving": "1 oz (23 almonds)"},
    {"name": "Avocado", "category": "general", "protein_g": 3, "carbs_g": 12, "fat_g": 21, "serving": "1 whole avocado"},
    {"name": "Broccoli", "category": "general", "protein_g": 3, "carbs_g": 6, "fat_g": 0.3, "serving": "1 cup, cooked"},
    {"name": "Spinach", "category": "general", "protein_g": 5, "carbs_g": 4, "fat_g": 0.4, "serving": "1 cup, cooked"},
    {"name": "Berries (mixed)", "category": "general", "protein_g": 1, "carbs_g": 15, "fat_g": 0.5, "serving": "1 cup"},
]
