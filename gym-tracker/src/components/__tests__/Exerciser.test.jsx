import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import Exerciser from "../Exerciser";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("motion/react", () => {
  const React = require("react");
  const strip = (props) => {
    const { initial, animate, exit, transition, whileTap, ...rest } = props;
    return rest;
  };
  return {
    motion: {
      div: ({ children, ...props }) => { const { initial, animate, exit, transition, whileTap, ...r } = props; return <div {...r}>{children}</div>; },
      button: ({ children, ...props }) => { const { initial, animate, exit, transition, whileTap, ...r } = props; return <button {...r}>{children}</button>; },
      form: ({ children, ...props }) => { const { initial, animate, exit, transition, ...r } = props; return <form {...r}>{children}</form>; },
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

jest.mock("../RestTimer", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => null,
    startRestTimer: jest.fn(),
    clearRestTimer: jest.fn(),
    useRestTimerRemaining: () => null,
  };
});
jest.mock("../NutritionPrompt", () => () => null);
jest.mock("../ExerciseStatus", () => () => null);
jest.mock("../UnavailabilityTicker", () => () => null);
jest.mock("../AvailabilityCalendar", () => () => null);
jest.mock("../ProgressChart", () => ({ StrengthChart: () => null, CardioChart: () => null }));

jest.mock("../../api/client", () => ({
  api: {
    dashboard: jest.fn(),
    listWorkouts: jest.fn(),
    assignedWorkouts: jest.fn(),
    listTrainers: jest.fn(),
    exerciserCardioExercises: jest.fn(),
    listCardioSessions: jest.fn(),
    listUserGyms: jest.fn(),
    lastWorkoutFor: jest.fn(),
    logAssignedWorkout: jest.fn(),
    updateWorkout: jest.fn(),
    deleteWorkout: jest.fn(),
    myUnavailability: jest.fn(),
    trainerUnavailability: jest.fn(),
    nutritionPreWorkout: jest.fn(),
    nutritionPostWorkout: jest.fn(),
    nutritionCardioShouldShowPost: jest.fn(),
  },
  getToken: jest.fn(() => "mock_token"),
  setToken: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_USER = {
  id: 1,
  name: "Test Exerciser",
  email: "test@test.com",
  role: "exerciser",
  status: "active",
  created_at: "2026-01-01T00:00:00",
  exerciser_profile: {
    goal: "General Fitness",
    trainer_id: 99,
    trainer_joined_at: null,
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

function makeWorkout(sets, { gymName = null } = {}) {
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

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

const { api } = require("../../api/client");

function setupDefaultMocks({ workouts = [], gyms = [] } = {}) {
  api.dashboard.mockResolvedValue({ workouts_this_week: 0, days_since_last_workout: null });
  api.listWorkouts.mockResolvedValue(workouts);
  api.assignedWorkouts.mockResolvedValue([MOCK_ASSIGNED_WORKOUT]);
  api.listTrainers.mockResolvedValue([
    { id: 99, name: "Test Trainer", specialty: "Strength Training", experience_years: 5, phone: null },
  ]);
  api.exerciserCardioExercises.mockResolvedValue([]);
  api.listCardioSessions.mockResolvedValue([]);
  api.listUserGyms.mockResolvedValue(gyms);
  api.lastWorkoutFor.mockRejectedValue({ status: 404, message: "Not Found" });
  api.myUnavailability.mockResolvedValue([]);
  api.trainerUnavailability.mockResolvedValue([]);
}

function renderExerciser(props = {}) {
  return render(<Exerciser user={MOCK_USER} onUserChange={jest.fn()} {...props} />);
}

/** Navigate from home screen to My Exercises and open the log form. */
async function navigateToLogForm() {
  // Wait for home screen to finish loading
  await waitFor(() => screen.getByText(/My Exercises/), { timeout: 5000 });

  // Click "💪 My Exercises" to go to exercises screen
  fireEvent.click(screen.getByRole("button", { name: /My Exercises/ }));

  // Wait for exercises screen with "Log Workout" button
  await waitFor(() => screen.getByText("Log Workout"), { timeout: 5000 });

  // Expand the first assigned workout
  fireEvent.click(screen.getByText("Log Workout"));

  // Wait for the toggle button to appear
  await waitFor(() => screen.getByText(/⚖️ kg/), { timeout: 5000 });
}

/** Navigate to history screen from home. */
async function navigateToHistory() {
  await waitFor(() => screen.getByText(/View History/), { timeout: 5000 });
  fireEvent.click(screen.getByRole("button", { name: /View History/ }));
  await waitFor(() => screen.getByText("Workout History"), { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// Tests: Plates feature — toggle behavior
// ---------------------------------------------------------------------------

describe("Plates toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  test("renders loading state initially", () => {
    renderExerciser();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  test("home screen loads after async fetch", async () => {
    renderExerciser();
    await waitFor(() => screen.getByText(/My Exercises/), { timeout: 5000 });
    expect(screen.getByText(/My Exercises/)).toBeInTheDocument();
  });

  test("log form shows ⚖️ kg toggle by default", async () => {
    renderExerciser();
    await navigateToLogForm();

    const toggle = screen.getByText(/⚖️ kg/);
    expect(toggle).toBeInTheDocument();
    expect(toggle.closest("button")).not.toHaveClass("unit-toggle--active");
  });

  test("clicking toggle switches to 🏋️ Plates and adds active class", async () => {
    renderExerciser();
    await navigateToLogForm();

    const toggleBtn = screen.getByText(/⚖️ kg/).closest("button");
    fireEvent.click(toggleBtn);

    await waitFor(() => screen.getByText(/🏋️ Plates/));
    expect(screen.getByText(/🏋️ Plates/).closest("button")).toHaveClass("unit-toggle--active");
  });

  test("clicking toggle twice returns to kg", async () => {
    renderExerciser();
    await navigateToLogForm();

    const toggleBtn = screen.getByText(/⚖️ kg/).closest("button");
    fireEvent.click(toggleBtn); // → plates
    await waitFor(() => screen.getByText(/🏋️ Plates/));

    fireEvent.click(screen.getByText(/🏋️ Plates/).closest("button")); // → kg
    await waitFor(() => screen.getByText(/⚖️ kg/));

    expect(screen.getByText(/⚖️ kg/).closest("button")).not.toHaveClass("unit-toggle--active");
  });

  test("add set row inherits plates unit from previous row", async () => {
    renderExerciser();
    await navigateToLogForm();

    // Switch to plates
    fireEvent.click(screen.getByText(/⚖️ kg/).closest("button"));
    await waitFor(() => screen.getByText(/🏋️ Plates/));

    // Add a second row
    fireEvent.click(screen.getByText("➕ Add Set"));

    // Both rows should now show plates
    await waitFor(() => {
      const platesBtns = screen.getAllByText(/🏋️ Plates/);
      expect(platesBtns).toHaveLength(2);
    });
  });

  test("weight input placeholder is '3' in plates mode and '80' in kg mode", async () => {
    renderExerciser();
    await navigateToLogForm();

    const spinners = screen.getAllByRole("spinbutton");
    // First spinner is weight (placeholder "80"), second is reps
    expect(spinners[0]).toHaveAttribute("placeholder", "80");

    fireEvent.click(screen.getByText(/⚖️ kg/).closest("button"));
    await waitFor(() => expect(spinners[0]).toHaveAttribute("placeholder", "3"));
  });
});

// ---------------------------------------------------------------------------
// Tests: Plates in history
// ---------------------------------------------------------------------------

describe("Plates in history", () => {
  beforeEach(() => jest.clearAllMocks());

  test("history shows 'X plates x Y reps' for a plates workout", async () => {
    setupDefaultMocks({ workouts: [makeWorkout([{ reps: 8, weight: 4, weight_unit: "plates" }])] });

    renderExerciser();
    await navigateToHistory();

    expect(screen.getByText("Set 1: 4 plates x 8 reps")).toBeInTheDocument();
  });

  test("history shows 'Xkg x Y reps' for a kg workout", async () => {
    setupDefaultMocks({ workouts: [makeWorkout([{ reps: 10, weight: 80, weight_unit: "kg" }])] });

    renderExerciser();
    await navigateToHistory();

    expect(screen.getByText("Set 1: 80kg x 10 reps")).toBeInTheDocument();
  });

  test("history shows mixed kg and plates sets correctly", async () => {
    setupDefaultMocks({
      workouts: [
        makeWorkout([
          { reps: 10, weight: 70, weight_unit: "kg" },
          { reps: 8, weight: 3, weight_unit: "plates" },
        ]),
      ],
    });

    renderExerciser();
    await navigateToHistory();

    expect(screen.getByText("Set 1: 70kg x 10 reps")).toBeInTheDocument();
    expect(screen.getByText("Set 2: 3 plates x 8 reps")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests: Gym selector feature
// ---------------------------------------------------------------------------

describe("Gym selector", () => {
  beforeEach(() => jest.clearAllMocks());

  test("gym input is visible in the log form", async () => {
    setupDefaultMocks();
    renderExerciser();
    await navigateToLogForm();

    expect(screen.getByPlaceholderText(/PureGym/i)).toBeInTheDocument();
  });

  test("gym label shows (optional) text", async () => {
    setupDefaultMocks();
    renderExerciser();
    await navigateToLogForm();

    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  test("datalist renders previously used gym names", async () => {
    setupDefaultMocks({ gyms: ["Home Gym", "PureGym City"] });
    renderExerciser();
    await navigateToLogForm();

    // datalist options in the DOM
    await waitFor(() => {
      const opts = document.querySelectorAll("datalist option");
      expect(opts).toHaveLength(2);
      const values = Array.from(opts).map((o) => o.value);
      expect(values).toContain("Home Gym");
      expect(values).toContain("PureGym City");
    });
  });

  test("no datalist when gyms list is empty", async () => {
    setupDefaultMocks({ gyms: [] });
    renderExerciser();
    await navigateToLogForm();

    expect(document.querySelectorAll("datalist")).toHaveLength(0);
  });

  test("typed gym name is passed to logAssignedWorkout", async () => {
    const GYM = "Gold's Gym";
    const logged = makeWorkout([{ reps: 5, weight: 50, weight_unit: "kg" }], { gymName: GYM });
    setupDefaultMocks();
    api.logAssignedWorkout.mockResolvedValue(logged);
    api.listWorkouts.mockResolvedValue([logged]);
    api.dashboard.mockResolvedValue({ workouts_this_week: 1, days_since_last_workout: 0 });

    renderExerciser();
    await navigateToLogForm();

    // Type gym name
    fireEvent.change(screen.getByPlaceholderText(/PureGym/i), { target: { value: GYM } });

    // Fill weight and reps
    const spinners = screen.getAllByRole("spinbutton");
    fireEvent.change(spinners[0], { target: { value: "50" } });
    fireEvent.change(spinners[1], { target: { value: "5" } });

    // Log set
    fireEvent.click(screen.getByText("Log Set"));
    await waitFor(() => screen.getByText("✓ Done"), { timeout: 5000 });

    // Save
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(api.logAssignedWorkout).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ gym_name: GYM })
      ),
      { timeout: 5000 }
    );
  });

  test("history card shows gym tag when workout has a gym name", async () => {
    const GYM = "Home Gym";
    setupDefaultMocks({ workouts: [makeWorkout([{ reps: 10, weight: 60, weight_unit: "kg" }], { gymName: GYM })] });

    renderExerciser();
    await navigateToHistory();

    expect(screen.getByText(`🏢 ${GYM}`)).toBeInTheDocument();
  });

  test("history card does not show gym tag when no gym name", async () => {
    setupDefaultMocks({ workouts: [makeWorkout([{ reps: 10, weight: 60, weight_unit: "kg" }])] });

    renderExerciser();
    await navigateToHistory();

    expect(document.querySelector(".card-gym-tag")).not.toBeInTheDocument();
  });

  test("last session preview shows gym name from previous session", async () => {
    const GYM = "Fitness First";
    const lastSession = makeWorkout([{ reps: 8, weight: 75, weight_unit: "kg" }], { gymName: GYM });
    setupDefaultMocks();
    api.lastWorkoutFor.mockResolvedValue(lastSession);

    renderExerciser();
    await navigateToLogForm();

    await waitFor(
      () => expect(screen.getByText(new RegExp(GYM))).toBeInTheDocument(),
      { timeout: 5000 }
    );
  });
});
