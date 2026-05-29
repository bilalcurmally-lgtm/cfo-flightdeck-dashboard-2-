import { expect, test, type Locator, type Page } from "@playwright/test";

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
