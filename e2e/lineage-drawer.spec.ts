import { expect, test, type Locator, type Page } from "@playwright/test";

const OWNER_NEXT_FIXTURE = "public/sample-owner-next.csv";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Do two boxes overlap? (small tolerance to forgive sub-pixel borders) */
function overlaps(a: Box, b: Box, tol = 1): boolean {
  return (
    a.x < b.x + b.width - tol &&
    a.x + a.width - tol > b.x &&
    a.y < b.y + b.height - tol &&
    a.y + a.height - tol > b.y
  );
}

async function loadFirstSampleAndOpenRunway(page: Page): Promise<Locator> {
  await page.goto("/");
  // Flow: load a sample CSV -> mapping stage -> Apply Mapping -> cockpit.
  await page.locator("[data-bw-sample-path]").first().click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();

  const trigger = page.locator('[data-bw-lineage-trigger="runwayMonths"]');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const panel = page.locator("[data-bw-lineage-panel]");
  await expect(panel).toBeVisible();
  return panel;
}

test("runway lineage calc tree never overlaps label and value", async ({ page }, testInfo) => {
  const panel = await loadFirstSampleAndOpenRunway(page);

  const nodes = panel.locator(".bw-lineage__node");
  const count = await nodes.count();
  expect(count, "expected at least one calc node in the runway tree").toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const node = nodes.nth(i);
    const label = node.locator(":scope > .bw-lineage__node-label");
    const value = node.locator(":scope > .bw-lineage__node-value");
    if ((await label.count()) === 0 || (await value.count()) === 0) continue;

    const labelBox = await label.boundingBox();
    const valueBox = await value.boundingBox();
    expect(labelBox && valueBox, `node ${i} is missing a box`).toBeTruthy();
    expect(
      overlaps(labelBox as Box, valueBox as Box),
      `node ${i}: label and value boxes overlap (jumbled layout)`
    ).toBe(false);
  }

  // Capture an artifact for human eyeballing (gitignored).
  await page.screenshot({
    path: `e2e/__artifacts__/runway-${testInfo.project.name}.png`
  });
});

async function openReviewDrawer(page: Page): Promise<Locator> {
  await page.goto("/");
  // Agency sample carries a transfer pair, so the review queue has a
  // toggleable item (rejected-row items have no rowIds and render no toggle).
  await page.locator('[data-bw-sample-path="/sample-agency.csv"]').click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();

  const reviewTrigger = page.locator("[data-bw-review-trigger]");
  await expect(reviewTrigger).toBeVisible();
  await reviewTrigger.click();

  const panel = page.locator("[data-bw-lineage-panel]");
  await expect(panel).toBeVisible();
  return panel;
}

async function loadAgencySample(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator('[data-bw-sample-path="/sample-agency.csv"]').click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  // Runway is cashOnHand / averageMonthlyOutflow, so cash must be set for a
  // non-null runway that can move when an outflow leaves operating KPIs.
  await page.locator("#cash-on-hand").fill("50000");
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

test("recategorizing a row to Internal re-derives runway live", async ({ page }) => {
  await loadAgencySample(page);
  const before = await page.locator('[data-kpi="runway"] .bw-kpi__value').innerText();
  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator(".category-review-item").first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  expect(await page.locator('[data-kpi="runway"] .bw-kpi__value').innerText()).not.toBe(before);
  await expect(row.locator('[data-role="group-select"]')).toBeFocused();

  await row.locator('[data-role="save-rule"]').click();
  await expect(page.locator("#status")).toContainText("saved a rule for future imports");
  await page.locator("[data-bw-lineage-close]").click();

  const savedRules = page.locator(".saved-rules");
  await expect(savedRules).toContainText("Owner");
  await savedRules.locator("[data-rule-toggle]").click();
  await expect(page.locator("#status")).toContainText("saved rule updated");
  await expect(savedRules).toContainText("Disabled");

  await savedRules.locator("[data-rule-delete]").click();
  await expect(page.locator("#status")).toContainText("saved rule deleted");
  await expect(savedRules).toContainText("No saved rules yet");
});

test("remembered category rule applies to a distinct matching import", async ({ page }) => {
  await loadAgencySample(page);
  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator(".category-review-item").first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");
  await row.locator('[data-role="save-rule"]').click();
  await expect(page.locator("#status")).toContainText("saved a rule for future imports");
  await page.locator("[data-bw-lineage-close]").click();

  await page.locator("#clear-button").click();
  await page.locator("#csv-file").setInputFiles(OWNER_NEXT_FIXTURE);
  await page.getByRole("button", { name: "Apply Mapping" }).click();

  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  await expect(page.locator(".rules-applied")).toContainText("1 row classified by 1 saved rule");
  await expect(page.locator('[data-tile="category-review"]')).toHaveCount(0);
});

test("confirmed category rows do not carry forward as unresolved review work", async ({ page }) => {
  await loadAgencySample(page);
  await page.locator('[data-tile="category-review"]').click();
  const ownerRow = page
    .locator(".category-review-item")
    .filter({ hasText: "Owner draw distribution" });
  await expect(ownerRow).toBeVisible();
  await ownerRow.locator('[data-role="confirm"]').click();
  await expect(
    page.locator(".category-review-item").filter({ hasText: "Owner draw distribution" })
  ).toHaveCount(0);

  await page.locator("[data-bw-lineage-close]").click();
  await page.locator("#clear-button").click();
  await page.locator('[data-bw-sample-path="/sample-agency.csv"]').click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();

  await page.locator('[data-tile="category-review"]').click();
  await expect(
    page.locator(".category-review-item").filter({ hasText: "Owner draw distribution" })
  ).toHaveCount(0);
});

test("toggling a review item reopens the drawer with focus on that item", async ({ page }) => {
  const panel = await openReviewDrawer(page);
  const body = page.locator("[data-bw-lineage-active]");

  const firstToggle = body.locator("[data-bw-review-toggle]").first();
  await expect(firstToggle).toBeVisible();
  const itemId = await firstToggle.getAttribute("data-bw-review-toggle");
  const before = await firstToggle.getAttribute("aria-pressed");
  expect(itemId, "expected a toggleable review item").toBeTruthy();

  await firstToggle.click();

  // The toggle re-renders the dashboard; the drawer must reopen so the user
  // keeps their place, with focus restored to the item they just changed.
  await expect(panel).toBeVisible();
  const reopened = body.locator(`[data-bw-review-toggle="${itemId}"]`);
  await expect(reopened).toBeVisible();
  await expect(reopened).toBeFocused();
  // ...and its state actually flipped (exclude <-> include).
  await expect(reopened).not.toHaveAttribute("aria-pressed", before ?? "");
});
