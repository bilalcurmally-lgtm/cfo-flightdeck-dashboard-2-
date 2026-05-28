import { describe, expect, it } from "vitest";
import { SAMPLE_DATASETS } from "../import/sample-datasets";
import { renderAppShell } from "./app-shell";

describe("renderAppShell", () => {
  it("renders stable shell controls without the legacy import panel", () => {
    const html = renderAppShell(SAMPLE_DATASETS);

    expect(html).toContain('id="csv-file"');
    expect(html).toContain('aria-label="Choose a CSV or Excel file"');
    expect(html).toContain('data-bw-action="import-file"');
    expect(html).toContain('id="clear-button"');
    expect(html).toContain('id="reference-button"');
    expect(html).toContain('id="status"');
    expect(html).toContain('id="reference-panel"');
    expect(html).toContain('id="results"');
    expect(html).not.toContain('class="import-panel"');
    expect(html).not.toContain('id="sample-select"');
    expect(html).not.toContain('id="sample-button"');
    expect(html).not.toContain('id="northstar-workbook-button"');
  });
});
