// @ts-check
const { test, expect } = require("@playwright/test");
const { setupMocks, makeWorkoutOut } = require("./helpers");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate to Home, wait for the app to finish loading. */
async function goHome(page) {
  await page.goto("/");
  await page.waitForSelector(".hero-card", { timeout: 8000 });
}

/** Navigate to My Exercises screen and expand the first card. */
async function openLogForm(page) {
  await page.click("text=💪 My Exercises");
  await page.waitForSelector(".card", { timeout: 5000 });
  await page.click("text=Log Workout");
  // Wait for the form to appear
  await page.waitForSelector(".unit-toggle", { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// 1. Toggle default state: should show "⚖️ kg"
// ---------------------------------------------------------------------------
test("toggle shows ⚖️ kg by default", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const toggle = page.locator(".unit-toggle").first();
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText("kg");
  await expect(toggle).not.toHaveClass(/unit-toggle--active/);
});

// ---------------------------------------------------------------------------
// 2. Toggle kg → plates: button text and style change
// ---------------------------------------------------------------------------
test("clicking toggle switches from kg to plates (purple active state)", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const toggle = page.locator(".unit-toggle").first();

  // Before click
  await expect(toggle).toContainText("kg");
  await expect(toggle).not.toHaveClass(/unit-toggle--active/);

  await toggle.click();

  // After click
  await expect(toggle).toContainText("Plates");
  await expect(toggle).toHaveClass(/unit-toggle--active/);
});

// ---------------------------------------------------------------------------
// 3. Toggle plates → kg: clicking again reverts
// ---------------------------------------------------------------------------
test("clicking toggle twice returns to kg", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const toggle = page.locator(".unit-toggle").first();
  await toggle.click(); // kg → plates
  await expect(toggle).toContainText("Plates");

  await toggle.click(); // plates → kg
  await expect(toggle).toContainText("kg");
  await expect(toggle).not.toHaveClass(/unit-toggle--active/);
});

// ---------------------------------------------------------------------------
// 4. Log a plates set and verify success + history shows "X plates x Y reps"
// ---------------------------------------------------------------------------
test("saving a plates set shows plates notation in history", async ({ page }) => {
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 8, weight: 4, weight_unit: "plates" }]
  );

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(loggedWorkout),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  // Switch to plates
  const toggle = page.locator(".unit-toggle").first();
  await toggle.click();
  await expect(toggle).toContainText("Plates");

  // Fill in weight (number of plates) and reps
  const weightInput = page.locator('input[type="number"]').first();
  await weightInput.fill("4");
  const repsInput = page.locator('input[placeholder="8"]').first();
  await repsInput.fill("8");

  // Log the set
  await page.click("text=Log Set");
  await expect(page.locator("text=✓ Done")).toBeVisible();

  // Save
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  // Go back home, then to history
  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // Verify the display
  await expect(page.locator("text=4 plates x 8 reps")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 5. kg set shows kg notation in history
// ---------------------------------------------------------------------------
test("saving a kg set shows kg notation in history", async ({ page }) => {
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 10, weight: 80, weight_unit: "kg" }]
  );

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(loggedWorkout),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  // Stay on kg (default)
  const weightInput = page.locator('input[type="number"]').first();
  await weightInput.fill("80");
  const repsInput = page.locator('input[placeholder="8"]').first();
  await repsInput.fill("10");

  await page.click("text=Log Set");
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  await expect(page.locator("text=80kg x 10 reps")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 6. Last session preview shows plates notation
// ---------------------------------------------------------------------------
test("last session preview shows plates notation for a plates workout", async ({ page }) => {
  const lastSession = makeWorkoutOut(
    [{ reps: 6, weight: 5, weight_unit: "plates" }]
  );

  await setupMocks(page, { lastSession });
  await goHome(page);
  await openLogForm(page);

  // The "Last (date):" subtitle should appear with plates notation
  await expect(page.locator(".card-subtitle", { hasText: /5 plates x6/ })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 7. Last session preview shows kg notation for a kg workout
// ---------------------------------------------------------------------------
test("last session preview shows kg notation for a kg workout", async ({ page }) => {
  const lastSession = makeWorkoutOut(
    [{ reps: 12, weight: 60, weight_unit: "kg" }]
  );

  await setupMocks(page, { lastSession });
  await goHome(page);
  await openLogForm(page);

  await expect(page.locator(".card-subtitle", { hasText: /60kg x12/ })).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 8. Mixed sets: first set kg, second set plates — both show in history
// ---------------------------------------------------------------------------
test("mixed kg and plates sets both appear correctly in history", async ({ page }) => {
  const loggedWorkout = makeWorkoutOut([
    { reps: 10, weight: 70, weight_unit: "kg" },
    { reps: 8, weight: 3, weight_unit: "plates" },
  ]);

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(loggedWorkout),
      });
    },
  });

  await goHome(page);
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // Both notations must appear
  await expect(page.locator("text=70kg x 10 reps")).toBeVisible();
  await expect(page.locator("text=3 plates x 8 reps")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 9. Add set inherits the unit of the last set
// ---------------------------------------------------------------------------
test("adding a new set row inherits the unit of the previous set", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  // Switch first set to plates
  const toggle1 = page.locator(".unit-toggle").first();
  await toggle1.click();
  await expect(toggle1).toContainText("Plates");

  // Add a second set
  await page.click("text=➕ Add Set");

  // Both toggles should now show plates
  const toggles = page.locator(".unit-toggle");
  await expect(toggles).toHaveCount(2);
  await expect(toggles.nth(1)).toContainText("Plates");
});

// ---------------------------------------------------------------------------
// 10. Toggle is disabled after a set is logged
// ---------------------------------------------------------------------------
test("toggle is disabled after the set is logged", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const toggle = page.locator(".unit-toggle").first();
  const weightInput = page.locator('input[type="number"]').first();
  const repsInput = page.locator('input[placeholder="8"]').first();

  await weightInput.fill("50");
  await repsInput.fill("5");
  await page.click("text=Log Set");

  await expect(page.locator("text=✓ Done")).toBeVisible();
  await expect(toggle).toBeDisabled();
});

// ---------------------------------------------------------------------------
// 11. Edit mode: toggle works in edit form
// ---------------------------------------------------------------------------
test("edit mode allows changing weight unit via toggle", async ({ page }) => {
  const existingWorkout = makeWorkoutOut([{ reps: 10, weight: 60, weight_unit: "kg" }]);

  await setupMocks(page, { workouts: [existingWorkout] });
  await goHome(page);
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // Click Edit on the workout card
  await page.click("text=Edit");

  // Find the toggle in the edit form
  const editToggle = page.locator(".unit-toggle").first();
  await expect(editToggle).toContainText("kg");

  await editToggle.click();
  await expect(editToggle).toContainText("Plates");
  await expect(editToggle).toHaveClass(/unit-toggle--active/);
});

// ---------------------------------------------------------------------------
// 12. Plates placeholder shows "3" (plate count hint vs "80" for kg)
// ---------------------------------------------------------------------------
test("plates mode shows plate-count placeholder, kg mode shows weight placeholder", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const weightInput = page.locator('input[type="number"]').first();

  // Default kg mode → placeholder "80"
  await expect(weightInput).toHaveAttribute("placeholder", "80");

  // Switch to plates
  await page.locator(".unit-toggle").first().click();
  await expect(weightInput).toHaveAttribute("placeholder", "3");
});

// ---------------------------------------------------------------------------
// 13. Full flow: log plates set, verify exact text in saved workout card
// ---------------------------------------------------------------------------
test("full plates flow: toggle → fill → log set → save → verify card text", async ({ page }) => {
  const loggedWorkout = makeWorkoutOut([{ reps: 6, weight: 4, weight_unit: "plates" }]);

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(loggedWorkout),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  await page.locator(".unit-toggle").first().click();
  await page.locator('input[type="number"]').first().fill("4");
  await page.locator('input[placeholder="8"]').first().fill("6");
  await page.click("text=Log Set");
  await expect(page.locator("text=✓ Done")).toBeVisible();
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  // Go back home, then to History
  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // The saved card shows the exercise and the plates notation
  await expect(page.locator("text=Bench Press")).toBeVisible();
  await expect(page.locator("text=Set 1: 4 plates x 6 reps")).toBeVisible();
});
