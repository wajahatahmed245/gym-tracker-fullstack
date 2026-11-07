/**
 * Shared test helpers and mock data for Playwright E2E tests.
 */

const MOCK_USER = {
  id: 1,
  name: "Test Exerciser",
  email: "test@gymtrack.test",
  role: "exerciser",
  status: "active",
  created_at: "2026-01-01T00:00:00",
  exerciser_profile: {
    goal: "General Fitness",
    trainer_id: 99,
    trainer_joined_at: "2026-01-01T00:00:00",
    height_cm: 175,
    weight_kg: 75,
    age: 28,
    gender: "Male",
    activity_level: "Moderately Active",
    phone: null,
    health: null,
  },
  trainer_profile: null,
};

const MOCK_ASSIGNED_WORKOUT = {
  id: 10,
  exercise: "Bench Press",
  body_part: "Chest",
  trainer_id: 99,
  exerciser_id: 1,
  active: true,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
};

function makeWorkoutOut(sets, { gymName = null } = {}) {
  return {
    id: 42,
    assigned_workout_id: 10,
    body_part: "Chest",
    exercise: "Bench Press",
    trainer_name: "Test Trainer",
    date: "2026-11-07",
    gym_name: gymName,
    sets: sets.map((s, i) => ({
      set_number: i + 1,
      reps: s.reps,
      weight: s.weight,
      weight_unit: s.weight_unit || "kg",
    })),
  };
}

// Set up all standard API route mocks for the exerciser view.
// options.workouts   – list returned by GET /exerciser/workouts
// options.lastSession – returned by GET /exerciser/assigned-workouts/{id}/last (undefined = 404)
// options.onLog      – override handler for POST log endpoint
// options.gyms       – list returned by GET /exerciser/gyms
async function setupMocks(page, options = {}) {
  const { workouts = [], lastSession = undefined, onLog, gyms = [] } = options;

  // Inject a fake token before the page loads so the app skips the login screen.
  await page.addInitScript(() => {
    localStorage.setItem("gymtrack_token", "mock_token_e2e");
  });

  // /api/auth/me
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_USER) })
  );

  // /api/exerciser/dashboard
  await page.route("**/api/exerciser/dashboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workouts_this_week: 1, days_since_last_workout: 0 }),
    })
  );

  // /api/exerciser/exercise-status
  await page.route("**/api/exerciser/exercise-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // /api/exerciser/assigned-workouts (GET list)
  await page.route("**/api/exerciser/assigned-workouts", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_ASSIGNED_WORKOUT]),
    });
  });

  // /api/exerciser/assigned-workouts/*/last
  await page.route("**/api/exerciser/assigned-workouts/*/last", (route) => {
    if (lastSession === undefined) {
      return route.fulfill({ status: 404, body: "Not Found" });
    }
    if (lastSession === null) {
      return route.fulfill({ status: 404, body: "Not Found" });
    }
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(lastSession),
    });
  });

  // POST /api/exerciser/assigned-workouts/*/log
  await page.route("**/api/exerciser/assigned-workouts/*/log", (route) => {
    if (onLog) return onLog(route);
    // Default: echo back a workout that reflects the posted sets.
    route.request().postDataJSON().then((body) => {
      const w = makeWorkoutOut(body.sets, { gymName: body.gym_name });
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(w) });
    }).catch(() => {
      route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(makeWorkoutOut([])) });
    });
  });

  // /api/exerciser/workouts
  let _workouts = [...workouts];
  await page.route("**/api/exerciser/workouts", (route) => {
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(_workouts) });
  });

  // /api/exerciser/gyms — backend now returns [{id, name}] objects
  await page.route("**/api/exerciser/gyms", (route) => {
    const normalized = gyms.map((g, i) =>
      typeof g === "string" ? { id: i + 1, name: g } : g
    );
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(normalized) });
  });

  // /api/trainers
  await page.route("**/api/trainers", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 99, name: "Test Trainer", specialty: "Strength Training", experience_years: 5, phone: null },
      ]),
    })
  );

  // Cardio
  await page.route("**/api/exerciser/cardio-exercises", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/exerciser/cardio-sessions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Unavailability
  await page.route("**/api/me/unavailability", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route("**/api/exerciser/trainer/unavailability", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
}

module.exports = { MOCK_USER, MOCK_ASSIGNED_WORKOUT, makeWorkoutOut, setupMocks };
