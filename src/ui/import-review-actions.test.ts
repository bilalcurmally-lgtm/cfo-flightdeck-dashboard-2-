import { describe, expect, it } from "vitest";
import type { CsvImportResult, ImportMapping } from "../finance/types";
import { bindImportReviewActions, type ImportReviewActionRoot } from "./import-review-actions";

describe("bindImportReviewActions", () => {
  it("refreshes validation and applies reviewed CSV mappings", () => {
    const elements = {
      "#mapping-validation": element(),
      "#apply-mapping": button(),
      "[data-mapping-key], #mapping-date-format": select()
    };
    const rendered: string[] = [];
    const mapping: ImportMapping = { date: "Date", amount: "Amount", head: "Head" };

    bindImportReviewActions({
      root: root(elements),
      getDraftImport: () => ({
        result: importResult(),
        sourceName: "sample.csv",
        source: "Date,Amount,Head\n2026-05-04,100,Client"
      }),
      readMapping: () => mapping,
      readDateFormat: () => "ymd",
      renderImportResult: (result, sourceName) => {
        rendered.push(`${sourceName}:${result.records.length}`);
      }
    });

    expect(elements["#mapping-validation"].innerHTML).toContain("1/1 rows ready");
    expect(elements["#apply-mapping"].disabled).toBe(false);

    elements["#apply-mapping"].fire("click");
    expect(rendered).toEqual(["sample.csv:1"]);
  });

  it("disables apply when required reviewed mappings are missing", () => {
    const elements = {
      "#mapping-validation": element(),
      "#apply-mapping": button(),
      "[data-mapping-key], #mapping-date-format": select()
    };

    bindImportReviewActions({
      root: root(elements),
      getDraftImport: () => ({
        result: importResult(),
        sourceName: "sample.csv",
        source: "Date,Amount\n2026-05-04,100"
      }),
      readMapping: () => ({ date: "", amount: "" }),
      readDateFormat: () => "ymd",
      renderImportResult: () => {
        throw new Error("apply should not be possible when required mappings are missing");
      }
    });

    expect(elements["#apply-mapping"].disabled).toBe(true);
  });
});

function root(elements: Record<string, FakeElement>): ImportReviewActionRoot {
  return {
    querySelector: (selector: string) => elements[selector] ?? null,
    querySelectorAll: (selector: string) => {
      const match = elements[selector];
      return match ? [match] : [];
    }
  } as unknown as ImportReviewActionRoot;
}

interface FakeElement {
  innerHTML: string;
  disabled: boolean;
  addEventListener: (event: string, listener: () => void) => void;
  fire: (event: string) => void;
}

function element(): FakeElement {
  return {
    innerHTML: "",
    disabled: false,
    addEventListener: () => undefined,
    fire: () => undefined
  };
}

function button(): FakeElement {
  const listeners = new Map<string, () => void>();
  return {
    innerHTML: "",
    disabled: false,
    addEventListener: (event, listener) => {
      listeners.set(event, listener);
    },
    fire: (event) => {
      listeners.get(event)?.();
    }
  };
}

function select(): FakeElement {
  return button();
}

function importResult(): CsvImportResult {
  return {
    rawRows: [{ Date: "2026-05-04", Amount: "100", Head: "Client" }],
    records: [],
    rejectedRows: [],
    mapping: { date: "", amount: "" },
    dateFormat: "ymd"
  };
}
