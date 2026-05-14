import type { DateFormat, ImportMapping } from "../finance/types";

export interface MappingReviewFormRoot {
  querySelectorAll<T extends Element = Element>(selector: string): Iterable<T> | ArrayLike<T>;
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export function readReviewedMapping(root: MappingReviewFormRoot = document): ImportMapping {
  const mapping: ImportMapping = { date: "", amount: "" };
  Array.from(root.querySelectorAll<HTMLSelectElement>("[data-mapping-key]")).forEach((select) => {
    const key = select.dataset.mappingKey as keyof ImportMapping | undefined;
    if (!key) return;
    mapping[key] = select.value;
  });
  return mapping;
}

export function readReviewedDateFormat(root: MappingReviewFormRoot = document): DateFormat {
  const value = root.querySelector<HTMLSelectElement>("#mapping-date-format")?.value;
  if (value === "dmy" || value === "mdy" || value === "ymd") return value;
  return "ymd";
}
