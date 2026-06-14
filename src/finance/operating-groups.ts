// src/finance/operating-groups.ts
/** Canonical non-operating groups, matched case-insensitively against record.parent. */
export const NON_OPERATING_GROUPS = new Set(["internal", "financing"]);

export function isOperating(record: { parent: string }): boolean {
  return !NON_OPERATING_GROUPS.has((record.parent ?? "").trim().toLowerCase());
}
