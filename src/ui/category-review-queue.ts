// src/ui/category-review-queue.ts
import type { CashFlow, TransactionRecord } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";
import { NON_OPERATING_GROUPS } from "../finance/operating-groups";

export type CategoryReviewReason = "non-operating-group" | "keyword";
const KEYWORDS = ["owner draw","draw","tax","refund","reimbursement","loan","investment","dividend","transfer"];

export interface CategoryReviewItem {
  id: string; flow: CashFlow; parent: string; head: string; label: string;
  reasons: CategoryReviewReason[]; acted: boolean; record: TransactionRecord;
}
export interface CategoryReviewSummary { items: CategoryReviewItem[]; }
export interface BuildCategoryReviewOptions {
  records: TransactionRecord[]; overrides: Map<string, ClassificationOverride>;
}

function matchesKeyword(r: TransactionRecord): boolean {
  const h = `${r.head} ${r.subcategory} ${r.counterparty}`.toLowerCase();
  return KEYWORDS.some((kw) => h.includes(kw));
}

export function buildCategoryReviewSummary(o: BuildCategoryReviewOptions): CategoryReviewSummary {
  const items: CategoryReviewItem[] = [];
  for (const r of o.records) {
    const reasons: CategoryReviewReason[] = [];
    if (NON_OPERATING_GROUPS.has((r.parent ?? "").trim().toLowerCase())) reasons.push("non-operating-group");
    if (matchesKeyword(r)) reasons.push("keyword");
    const acted = o.overrides.has(r.id);
    // Keep acted (overridden) rows in the queue even once the override removed
    // their only review reason — otherwise the row vanishes and its Reset becomes
    // unreachable, stranding an active override (e.g. a group-only flag moved to
    // an operating group).
    if (reasons.length === 0 && !acted) continue;
    items.push({
      id: r.id, flow: r.flow, parent: r.parent, head: r.head,
      label: `${r.description} — ${r.head || "Uncategorized"}`,
      reasons, acted, record: r,
    });
  }
  return { items };
}
