import type { CashFlow, TransactionRecord } from "./types";

export interface ClassificationOverride { flow?: CashFlow; parent?: string; }

/** New array with flow/parent replaced; signedNet recomputed from `amount` on flow flip
 *  (revenue=+amount, outflow=-amount). Pure & reversible (drop entry = restore). */
export function applyClassificationOverrides(
  records: TransactionRecord[],
  overrides: Map<string, ClassificationOverride>,
): TransactionRecord[] {
  if (overrides.size === 0) return records.map((r) => ({ ...r }));
  return records.map((record) => {
    const o = overrides.get(record.id);
    if (!o) return { ...record };
    const next: TransactionRecord = { ...record };
    if (o.parent !== undefined) next.parent = o.parent;
    if (o.flow !== undefined && o.flow !== record.flow) {
      next.flow = o.flow;
      next.signedNet = o.flow === "revenue" ? record.amount : -record.amount;
    }
    return next;
  });
}
