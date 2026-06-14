import { expect, test, type Page } from "@playwright/test";

const AGENCY_SAMPLE = "/sample-agency.csv";

async function importAgencyWithCash(page: Page): Promise<void> {
  await page.locator(`[data-bw-sample-path="${AGENCY_SAMPLE}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  await page.locator("#cash-on-hand").fill("50000");
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

function runwayValue(page: Page): Promise<string> {
  return page.locator('[data-kpi="runway"] .bw-kpi__value').innerText();
}

test("save project -> reset -> open project restores the recategorization", async ({ page }) => {
  await page.goto("/");
  await importAgencyWithCash(page);
  const pristineRunway = await runwayValue(page);

  // Recategorize the first review row to Internal.
  await page.locator('[data-tile="category-review"]').click();
  const row = page.locator(".category-review-item").first();
  await row.locator('[data-role="group-select"]').selectOption("Internal");
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  const recatRunway = await runwayValue(page);
  expect(recatRunway).not.toBe(pristineRunway);

  // Close the review drawer so it stops overlaying the header actions.
  await page.locator("[data-bw-lineage-close]").click();

  // Save the workspace to a .billu.json file.
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save-project").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(download.suggestedFilename()).toMatch(/\.billu\.json$/);

  // Reset the override -> runway returns to pristine.
  await page.locator('[data-tile="category-review"]').click();
  await page.locator('.category-review-item [data-role="reset"]').first().click();
  await expect.poll(() => runwayValue(page)).toBe(pristineRunway);

  // Open the saved project file -> the override is restored from the file
  // (async: read -> parse -> store.load -> re-activate the import).
  await page.locator("#project-file").setInputFiles(filePath);
  await expect(page.locator('[data-tile="non-operating"]')).toBeVisible();
  await expect.poll(() => runwayValue(page)).toBe(recatRunway);
});
