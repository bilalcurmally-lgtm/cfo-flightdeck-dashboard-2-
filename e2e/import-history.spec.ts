import { expect, test, type Page } from "@playwright/test";

const AGENCY_SAMPLE = "/sample-agency.csv";
const FREELANCER_SAMPLE = "/sample-freelancer.csv";

async function importSample(page: Page, samplePath: string): Promise<void> {
  await page.locator(`[data-bw-sample-path="${samplePath}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

test("re-import shows a dismissible welcome-back strip", async ({ page }) => {
  await page.goto("/");
  await importSample(page, AGENCY_SAMPLE);
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);

  // Wait for the import-history write-through before proving reload persistence.
  await page.waitForTimeout(600);
  await page.reload();
  await importSample(page, AGENCY_SAMPLE);

  await expect(page.locator("[data-bw-welcome-strip]")).toBeVisible();
  await expect(page.locator("[data-bw-welcome-strip]")).toContainText(
    "Since your last import"
  );

  await page.locator("[data-bw-welcome-dismiss]").click();
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);

  await page.locator("#clear-button").click();
  await importSample(page, FREELANCER_SAMPLE);

  await page.locator("#history-button").click();
  await expect(page.locator("#history-panel")).toBeVisible();
  await expect(page.locator("#history-panel .bw-history__row")).toHaveCount(2);
  await expect(page.locator("#history-panel")).toContainText("sample-agency.csv");
  await expect(page.locator("#history-panel")).toContainText("sample-freelancer.csv");
});
