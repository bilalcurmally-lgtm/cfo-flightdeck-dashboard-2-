import { expect, test, type Page } from "@playwright/test";

const AGENCY_SAMPLE = "/sample-agency.csv";
const BUDGET_KEY = "Payroll";
const INCOME_LABEL = "Northstar retainer";

async function importAgencyWithCash(page: Page): Promise<void> {
  await page.locator(`[data-bw-sample-path="${AGENCY_SAMPLE}"]`).click();
  await page.getByRole("button", { name: "Apply Mapping" }).click();
  await page.locator("#cash-on-hand").fill("50000");
  await expect(page.locator('[data-kpi="runway"]')).toBeVisible();
  await expect(page.locator("#budget-add")).toBeVisible();
}

async function clearWorkspaceDatabase(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("billu-workspace");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Failed to delete billu-workspace"));
      request.onblocked = () => resolve();
    });
  });
}

async function addPlanningRows(page: Page): Promise<void> {
  await page.locator("#budget-month").scrollIntoViewIfNeeded();
  await page.locator("#budget-month").fill("2026-03");
  await page.locator("#budget-key").fill(BUDGET_KEY);
  await page.locator("#budget-flow").selectOption("outflow");
  await page.locator("#budget-amount").fill("5000");
  await page.getByRole("button", { name: "Add budget" }).click();
  await expect(page.locator(".budget-settings__list")).toContainText(BUDGET_KEY);

  await page.locator("#expected-income-date").fill("2026-04-01");
  await page.locator("#expected-income-amount").fill("3000");
  await page.locator("#expected-income-label").fill(INCOME_LABEL);
  await page.getByRole("button", { name: "Add expected income" }).click();
  await expect(page.locator(".expected-income__list")).toContainText(INCOME_LABEL);
}

test("budgets and expected income survive project file save and open", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/");
  await importAgencyWithCash(page);
  await addPlanningRows(page);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save-project").click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(download.suggestedFilename()).toMatch(/\.billu\.json$/);

  await clearWorkspaceDatabase(page);
  await page.reload();
  await importAgencyWithCash(page);

  await expect(page.getByText("No budgets yet.")).toBeVisible();
  await expect(page.getByText("No tagged expected income yet.")).toBeVisible();

  await page.locator("#project-file").setInputFiles(filePath);
  await expect(page.locator(".budget-settings__list")).toContainText(BUDGET_KEY);
  await expect(page.locator(".expected-income__list")).toContainText(INCOME_LABEL);
  await expect(page.getByRole("heading", { name: "Budget vs Actual" })).toBeVisible();
});