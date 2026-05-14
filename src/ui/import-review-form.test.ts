import { describe, expect, it } from "vitest";
import {
  readReviewedDateFormat,
  readReviewedMapping,
  type MappingReviewFormRoot
} from "./import-review-form";

describe("readReviewedMapping", () => {
  it("reads selected import mapping fields from mapping controls", () => {
    const mapping = readReviewedMapping(root({
      selects: [
        select("date", "Posted At"),
        select("amount", "Net"),
        select("counterparty", "Vendor"),
        select("", "Ignored")
      ]
    }));

    expect(mapping).toEqual({
      date: "Posted At",
      amount: "Net",
      counterparty: "Vendor"
    });
  });
});

describe("readReviewedDateFormat", () => {
  it("returns the selected supported date format", () => {
    expect(
      readReviewedDateFormat(root({ dateFormat: select("", "dmy") }))
    ).toBe("dmy");
  });

  it("falls back to ymd for unsupported or missing values", () => {
    expect(
      readReviewedDateFormat(root({ dateFormat: select("", "iso") }))
    ).toBe("ymd");
    expect(
      readReviewedDateFormat(root({ dateFormat: null }))
    ).toBe("ymd");
  });
});

function root({ selects = [], dateFormat = null }: {
  selects?: HTMLSelectElement[];
  dateFormat?: HTMLSelectElement | null;
}): MappingReviewFormRoot {
  return {
    querySelectorAll: () => selects,
    querySelector: () => dateFormat
  } as unknown as MappingReviewFormRoot;
}

function select(mappingKey: string, value: string): HTMLSelectElement {
  return {
    dataset: { mappingKey },
    value
  } as unknown as HTMLSelectElement;
}
