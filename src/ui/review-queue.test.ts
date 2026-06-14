import { describe, expect, it } from "vitest";
import { placeholderCashHealthLineage, placeholderSummaryLineage } from "../finance/audit-fixtures";
import type { FinanceSummary } from "../finance/summary";
import type { TransactionRecord } from "../finance/types";
import {
  buildReviewDrawerItems,
  deriveExcludedTransactionIds,
  deriveExcludedTransactionIdsFromQueue
} from "./review-queue";

describe("review queue decisions", () => {
  it("derives row exclusions from active review item decisions without dropping overlaps", () => {
    const transferOut = record("transfer-out", "outflow");
    const transferIn = record("transfer-in", "revenue");
    const duplicateIn = { ...transferIn, id: "duplicate-in" };
    const items = buildReviewDrawerItems({
      summary: summary([transferIn, duplicateIn], transferOut, transferIn),
      rejectedRows: [],
      excludedReviewItemIds: new Set([
        "duplicate:dup-key",
        "transfer:transfer-out:transfer-in"
      ]),
      formatMoney: (value) => `$${value}`
    });

    expect(deriveExcludedTransactionIds(items).sort()).toEqual([
      "duplicate-in",
      "transfer-in",
      "transfer-out"
    ]);

    const afterIncludingDuplicate = buildReviewDrawerItems({
      summary: summary([transferIn, duplicateIn], transferOut, transferIn),
      rejectedRows: [],
      excludedReviewItemIds: new Set(["transfer:transfer-out:transfer-in"]),
      formatMoney: (value) => `$${value}`
    });

    expect(deriveExcludedTransactionIds(afterIncludingDuplicate).sort()).toEqual([
      "transfer-in",
      "transfer-out"
    ]);
  });

  it("derives saved exclusions from the full review queue when the visible filter hides the item", () => {
    const transferOut = record("transfer-out", "outflow");
    const transferIn = record("transfer-in", "revenue");
    const fullSummary = summary([], transferOut, transferIn);
    const visibleRevenueOnlySummary = summary([], transferOut, transferIn);
    visibleRevenueOnlySummary.diagnostics.transferCandidates = [];

    const visibleItems = buildReviewDrawerItems({
      summary: visibleRevenueOnlySummary,
      rejectedRows: [],
      excludedReviewItemIds: new Set(["transfer:transfer-out:transfer-in"]),
      formatMoney: (value) => `$${value}`
    });

    expect(deriveExcludedTransactionIds(visibleItems)).toEqual([]);
    expect(
      deriveExcludedTransactionIdsFromQueue({
        summary: fullSummary,
        rejectedRows: [],
        excludedReviewItemIds: new Set(["transfer:transfer-out:transfer-in"]),
        formatMoney: (value) => `$${value}`
      }).sort()
    ).toEqual(["transfer-in", "transfer-out"]);
  });
});

function summary(
  duplicateRecords: TransactionRecord[],
  outflow: TransactionRecord,
  revenue: TransactionRecord
): FinanceSummary {
  return {
    revenue: 0,
    outflow: 0,
    netCash: 0,
    transactionCount: 0,
    periodTrend: [],
    topHeads: [],
    topSubcategories: [],
    accountBalances: [],
    diagnostics: {
      duplicateGroups: [{ key: "dup-key", records: duplicateRecords }],
      transferCandidates: [
        {
          dateISO: "2026-03-01",
          amount: 100,
          fromAccount: outflow.account,
          toAccount: revenue.account,
          outflowId: outflow.id,
          revenueId: revenue.id
        }
      ]
    },
    warnings: [],
    lineage: placeholderSummaryLineage(),
    cashHealth: {
      lineage: placeholderCashHealthLineage(),
      averageMonthlyOutflow: 0,
      runwayMonths: null,
      largestTransaction: null,
      revenueConcentration: 0
    }
  };
}

function record(id: string, flow: TransactionRecord["flow"]): TransactionRecord {
  return {
    id,
    date: new Date("2026-03-01T00:00:00"),
    dateISO: "2026-03-01",
    periodDaily: "2026-03-01",
    periodWeekly: "2026-02-23",
    periodMonthly: "2026-03",
    head: "Transfer",
    parent: "Group",
    subcategory: "Subcategory",
    description: "Description",
    counterparty: "Counterparty",
    account: flow === "revenue" ? "Savings" : "Checking",
    flow,
    amount: 100,
    signedNet: flow === "revenue" ? 100 : -100,
    runningBalance: null
  };
}
