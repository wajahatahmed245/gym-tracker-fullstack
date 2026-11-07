// @ts-check
const { test, expect } = require("@playwright/test");
const { setupMocks, makeWorkoutOut } = require("./helpers");

async function goHome(page) {
  await page.goto("/");
  await page.waitForSelector(".hero-card", { timeout: 8000 });
}

async function openLogForm(page) {
  await page.click("text=💪 My Exercises");
  await page.waitForSelector(".card", { timeout: 5000 });
  await page.click("text=Log Workout");
  await page.waitForSelector('input[placeholder*="Gym"]', { timeout: 5000 });
}

// ---------------------------------------------------------------------------
// 1. Gym input is visible on the log form
// ---------------------------------------------------------------------------
test("gym input is present on the workout log form", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  const gymInput = page.locator('input[placeholder*="PureGym"]');
  await expect(gymInput).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Gym input label is "🏢 Gym (optional)"
// ---------------------------------------------------------------------------
test("gym input label shows as optional", async ({ page }) => {
  await setupMocks(page);
  await goHome(page);
  await openLogForm(page);

  await expect(page.locator(".form-label", { hasText: /Gym/ })).toBeVisible();
  await expect(page.locator(".form-label-optional")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Previously used gyms appear in datalist
// ---------------------------------------------------------------------------
test("previously used gym names appear in the datalist dropdown", async ({ page }) => {
  // Pass gyms already sorted as the backend would return them
  await setupMocks(page, { gyms: ["Home Gym", "PureGym City"] });
  await goHome(page);
  await openLogForm(page);

  // The datalist options should be rendered in the DOM
  const options = page.locator("datalist option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toHaveAttribute("value", "Home Gym");
  await expect(options.nth(1)).toHaveAttribute("value", "PureGym City");
});

// ---------------------------------------------------------------------------
// 4. No datalist when user has no previous gyms
// ---------------------------------------------------------------------------
test("no datalist rendered when user has no previous gyms", async ({ page }) => {
  await setupMocks(page, { gyms: [] });
  await goHome(page);
  await openLogForm(page);

  const datalist = page.locator("datalist");
  await expect(datalist).not.toBeAttached();
});

// ---------------------------------------------------------------------------
// 5. Logging with a gym name stores it and shows it in history
// ---------------------------------------------------------------------------
test("logged workout with gym name shows gym tag in history", async ({ page }) => {
  const GYM = "PureGym Central";
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 10, weight: 80, weight_unit: "kg" }],
    { gymName: GYM }
  );

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      const body = await route.request().postDataJSON();
      const w = makeWorkoutOut(body.sets, { gymName: body.gym_name });
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(w),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  // Fill gym name
  await page.locator('input[placeholder*="PureGym"]').fill(GYM);

  // Fill weight and reps
  await page.locator('input[type="number"]').first().fill("80");
  await page.locator('input[placeholder="8"]').first().fill("10");
  await page.click("text=Log Set");
  await expect(page.locator("text=✓ Done")).toBeVisible();
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  // Go back home, then to history
  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // The gym tag should appear
  await expect(page.locator(".card-gym-tag", { hasText: GYM })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 6. Logging without a gym name shows no gym tag in history
// ---------------------------------------------------------------------------
test("logged workout without gym name shows no gym tag in history", async ({ page }) => {
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 10, weight: 80, weight_unit: "kg" }],
    { gymName: null }
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

  // Leave gym empty, just fill weight/reps
  await page.locator('input[type="number"]').first().fill("80");
  await page.locator('input[placeholder="8"]').first().fill("10");
  await page.click("text=Log Set");
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  await expect(page.locator(".card-gym-tag")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// 7. Last session preview shows gym name when previous workout had one
// ---------------------------------------------------------------------------
test("last session preview includes gym name from previous workout", async ({ page }) => {
  const lastSession = makeWorkoutOut(
    [{ reps: 8, weight: 75, weight_unit: "kg" }],
    { gymName: "Home Gym" }
  );

  await setupMocks(page, { lastSession });
  await goHome(page);
  await openLogForm(page);

  // The "Last (date · Home Gym): ..." subtitle
  await expect(
    page.locator(".card-subtitle", { hasText: /Home Gym/ })
  ).toBeVisible({ timeout: 5000 });
});

// ---------------------------------------------------------------------------
// 8. After logging a new gym, it appears in next log form datalist
// ---------------------------------------------------------------------------
test("newly typed gym name is added to the datalist for the next log", async ({ page }) => {
  const GYM = "New City Gym";
  let gymsList = [];
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 5, weight: 50, weight_unit: "kg" }],
    { gymName: GYM }
  );

  await setupMocks(page, {
    workouts: [],
    gyms: gymsList,
    onLog: async (route) => {
      gymsList.push(GYM);
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(loggedWorkout),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  // Log with a new gym name
  await page.locator('input[placeholder*="PureGym"]').fill(GYM);
  await page.locator('input[type="number"]').first().fill("50");
  await page.locator('input[placeholder="8"]').first().fill("5");
  await page.click("text=Log Set");
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  // Open the form again on the same card
  await page.click("text=Log Workout");
  await page.waitForSelector('input[placeholder*="PureGym"]', { timeout: 5000 });

  // The datalist should now contain the newly saved gym
  const datalist = page.locator("datalist");
  await expect(datalist).toBeAttached();
  await expect(page.locator("datalist option")).toHaveCount(1);
  await expect(page.locator("datalist option").first()).toHaveAttribute("value", GYM);
});

// ---------------------------------------------------------------------------
// 9. Edit form shows gym input with existing gym name pre-filled
// ---------------------------------------------------------------------------
test("edit form shows gym input pre-filled with the existing gym name", async ({ page }) => {
  const GYM = "Fitness First";
  const existingWorkout = makeWorkoutOut(
    [{ reps: 10, weight: 60, weight_unit: "kg" }],
    { gymName: GYM }
  );

  await setupMocks(page, { workouts: [existingWorkout] });
  await goHome(page);
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  await page.click("text=Edit");

  const gymInput = page.locator('input[placeholder*="PureGym"]');
  await expect(gymInput).toBeVisible();
  await expect(gymInput).toHaveValue(GYM);
});

// ---------------------------------------------------------------------------
// 10. Full gym flow: log with gym → verify exact card in history
// ---------------------------------------------------------------------------
test("full gym flow: type gym name → save → verify gym tag in workout card", async ({ page }) => {
  const GYM = "Gold's Gym";
  const loggedWorkout = makeWorkoutOut(
    [{ reps: 12, weight: 50, weight_unit: "kg" }],
    { gymName: GYM }
  );

  await setupMocks(page, {
    workouts: [loggedWorkout],
    onLog: async (route) => {
      const body = await route.request().postDataJSON();
      const w = makeWorkoutOut(body.sets, { gymName: body.gym_name });
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(w),
      });
    },
  });

  await goHome(page);
  await openLogForm(page);

  await page.locator('input[placeholder*="PureGym"]').fill(GYM);
  await page.locator('input[type="number"]').first().fill("50");
  await page.locator('input[placeholder="8"]').first().fill("12");
  await page.click("text=Log Set");
  await expect(page.locator("text=✓ Done")).toBeVisible();
  await page.click("text=Save");
  await expect(page.locator("text=Workout logged successfully!")).toBeVisible();

  await page.click("button.back-button");
  await page.waitForSelector(".hero-card", { timeout: 5000 });
  await page.click("text=📜 View History");
  await page.waitForSelector(".date-heading", { timeout: 5000 });

  // Verify exercise name, sets, and gym tag are all visible
  await expect(page.locator("text=Bench Press")).toBeVisible();
  await expect(page.locator("text=Set 1: 50kg x 12 reps")).toBeVisible();
  await expect(page.locator(".card-gym-tag", { hasText: `🏢 ${GYM}` })).toBeVisible();
});
