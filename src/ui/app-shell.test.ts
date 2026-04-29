import { describe, expect, it } from "vitest";
import { SAMPLE_DATASETS } from "../import/sample-datasets";
import { renderAppShell } from "./app-shell";

describe("renderAppShell", () => {
  it("renders the import controls and sample dataset options", () => {
    const html = renderAppShell(SAMPLE_DATASETS);

    expect(html).toContain('id="csv-file"');
    expect(html).toContain('id="sample-select"');
    expect(html).toContain('id="sample-button"');
    expect(html).toContain('id="clear-button"');
    expect(html).toContain('id="reference-button"');
    expect(html).toContain('value="/sample-freelancer.csv"');
    expect(html).toContain(">Agency</option>");
  });

  it("escapes custom sample labels and paths", () => {
    const html = renderAppShell([{ label: "<Bad>", path: "/sample?a=<x>" }]);

    expect(html).toContain("&lt;Bad&gt;");
    expect(html).toContain("/sample?a=&lt;x&gt;");
    expect(html).not.toContain("<Bad>");
  });
});
