import { expect, test, type Page } from "@playwright/test";

const AGENCY_SAMPLE = "/sample-agency.csv";

async function importAgency(page: Page): Promise<void> {
  await page.locator(`[data-bw-sample-path="${AGENCY_SAMPLE}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
}

test("re-import shows a dismissible welcome-back strip", async ({ page }) => {
  await page.goto("/");
  await importAgency(page);
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);

  // Wait for the import-history write-through before proving reload persistence.
  await page.waitForTimeout(600);
  await page.reload();
  await importAgency(page);

  await expect(page.locator("[data-bw-welcome-strip]")).toBeVisible();
  await expect(page.locator("[data-bw-welcome-strip]")).toContainText(
    "Since your last import"
  );

  await page.locator("[data-bw-welcome-dismiss]").click();
  await expect(page.locator("[data-bw-welcome-strip]")).toHaveCount(0);
});
