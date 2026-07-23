import { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * Dismissible card shown before/after logging a workout.
 * timing: "pre_workout" | "post_workout" | "post_workout_second_dose"
 */
export default function NutritionPrompt({ timing, recentProteinMeal }) {
  const [target, setTarget] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    setTarget(null);

    let cancelled = false;
    const load = async () => {
      try {
        let data;
        if (timing === "pre_workout") {
          data = await api.nutritionPreWorkout(recentProteinMeal || {});
        } else if (timing === "post_workout") {
          data = await api.nutritionPostWorkout();
        } else {
          data = await api.nutritionPostWorkoutSecondDose();
        }
        if (!cancelled) setTarget(data);
      } catch {
        // non-blocking — nutrition prompts are optional
      }
    };
    load();
    return () => { cancelled = true; };
  }, [timing, recentProteinMeal]);

  if (dismissed || !target) return null;

  const isPost = timing !== "pre_workout";

  return (
    <div className="nutrition-prompt">
      <div className="nutrition-prompt-body">
        <div className="nutrition-prompt-icon">{isPost ? "🍽️" : "⚡"}</div>
        <div>
          <div className="nutrition-prompt-title">
            {isPost ? "Post-Workout Nutrition" : "Pre-Workout Nutrition"}
          </div>
          <p className="nutrition-prompt-message">{target.message}</p>

          {target.food_suggestions?.length > 0 && (
            <div className="nutrition-suggestions">
              <span className="nutrition-suggestions-label">Try:</span>
              <ul className="nutrition-suggestions-list">
                {target.food_suggestions.map((food) => (
                  <li key={food.name}>
                    <strong>{food.name}</strong>{" "}
                    <span className="nutrition-serving">({food.serving})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <button
        className="nutrition-dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
