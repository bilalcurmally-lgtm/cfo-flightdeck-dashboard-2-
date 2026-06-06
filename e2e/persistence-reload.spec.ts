import { expect, test, type Page } from "@playwright/test";

const AGENCY_SAMPLE = "/sample-agency.csv";

async function importAgencyWithCash(page: Page): Promise<void> {
  await page.locator(`[data-bw-sample-path="${AGENCY_SAMPLE}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  // Runway = cashOnHand / averageMonthlyOutflow; cash isn't part of D1
  // persistence, so it is re-entered after reload.
  await page.locator("#cash-on-hand").fill("50000");
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

function runwayValue(page: Page): Promise<string> {
  return page.locator('[data-kpi="runway"] .bw-kpi__value').innerText();
}

test("a recategorization survives reload + re-import via signature persistence", async ({
  page
}) => {
  await page.goto("/");
  await importAgencyWithCash(page);
  const pristineRunway = await runwayValue(page);

  // Recategorize the first review row to Internal (moves it out of operating KPIs).
  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator(".category-review-item").first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  const recatRunway = await runwayValue(page);
  expect(recatRunway, "recategorization should move runway").not.toBe(pristineRunway);

  // Give the IndexedDB write-through a beat to commit before reload.
  await page.waitForTimeout(600);

  // Reload returns to the pre-import screen; re-import the SAME sample.
  await page.reload();
  await importAgencyWithCash(page);

  // Without touching the category review again, the persisted override should
  // re-apply by signature: the non-operating tile is back and runway matches
  // the post-recategorization value, not the pristine one.
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  const restoredRunway = await runwayValue(page);
  expect(restoredRunway, "persisted override should reproduce recat runway").toBe(recatRunway);
  expect(restoredRunway, "persisted override should differ from pristine").not.toBe(pristineRunway);
});
