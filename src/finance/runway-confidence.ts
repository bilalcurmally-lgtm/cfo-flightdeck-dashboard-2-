import type { ForecastResult } from "./forecast";
import type { ReadinessReport } from "./readiness";
import type { TransactionRecord } from "./types";

export type RunwayConfidenceLevel = "high" | "medium" | "low";

export interface RunwayConfidenceReason {
  id: string;
  severity: "positive" | "caution" | "risk";
  label: string;
  detail: string;
}

export interface RunwayConfidenceReport {
  level: RunwayConfidenceLevel;
  score: number;
  headline: string;
  reasons: RunwayConfidenceReason[];
}

export interface RunwayConfidenceInput {
  records: readonly TransactionRecord[];
  cashOnHand: number;
  forecast: ForecastResult;
  readiness: ReadinessReport;
  rejectedRowCount: number;
  categoryReviewPendingCount: number;
  revenueConcentration: number;
}

export interface BuildRunwayConfidenceInput {
  view: {
    filteredRecords: readonly TransactionRecord[];
    forecast: ForecastResult;
    summary: { cashHealth: { revenueConcentration: number } };
    categoryReview: { items: readonly { acted: boolean }[] };
  };
  cashOnHand: number;
  readiness: ReadinessReport;
  rejectedRowCount: number;
}

export function buildRunwayConfidenceInput(
  options: BuildRunwayConfidenceInput
): RunwayConfidenceInput {
  return {
    records: options.view.filteredRecords,
    cashOnHand: options.cashOnHand,
    forecast: options.view.forecast,
    readiness: options.readiness,
    rejectedRowCount: options.rejectedRowCount,
    categoryReviewPendingCount: options.view.categoryReview.items.filter((item) => !item.acted)
      .length,
    revenueConcentration: options.view.summary.cashHealth.revenueConcentration
  };
}

const HIGH_THRESHOLD = 70;
const MEDIUM_THRESHOLD = 40;

export function assessRunwayConfidence(input: RunwayConfidenceInput): RunwayConfidenceReport {
  const monthsObserved = countMonthsObserved(input.records);
  const incomeVolatility = coefficientOfVariation(monthlyTotals(input.records, "revenue"));
  const expenseVolatility = coefficientOfVariation(monthlyTotals(input.records, "outflow"));
  const reasons: RunwayConfidenceReason[] = [];
  let score = 50;

  if (input.cashOnHand > 0) {
    score += 15;
    reasons.push({
      id: "cash-on-hand",
      severity: "positive",
      label: "Cash on hand set",
      detail: "Runway uses a user-entered cash balance."
    });
  } else {
    score -= 25;
    reasons.push({
      id: "missing-cash",
      severity: "risk",
      label: "Cash on hand missing",
      detail: "Runway is undefined until cash on hand is provided."
    });
  }

  if (monthsObserved >= 6) {
    score += 15;
    reasons.push({
      id: "coverage-strong",
      severity: "positive",
      label: "Strong history coverage",
      detail: `${monthsObserved} months of activity inform burn and trend assumptions.`
    });
  } else if (monthsObserved >= 3) {
    score += 8;
    reasons.push({
      id: "coverage-moderate",
      severity: "positive",
      label: "Moderate history coverage",
      detail: `${monthsObserved} months observed; longer history would stabilize burn.`
    });
  } else if (monthsObserved >= 1) {
    score -= 8;
    reasons.push({
      id: "coverage-thin",
      severity: "caution",
      label: "Thin history coverage",
      detail: `${monthsObserved} month${monthsObserved === 1 ? "" : "s"} observed; burn may be noisy.`
    });
  } else {
    score -= 20;
    reasons.push({
      id: "coverage-none",
      severity: "risk",
      label: "No monthly history",
      detail: "Runway and forecast lack monthly outflow history."
    });
  }

  score += volatilityAdjustment(incomeVolatility, "income", reasons);
  score += volatilityAdjustment(expenseVolatility, "expense", reasons);

  if (input.rejectedRowCount > 0) {
    score -= 10;
    reasons.push({
      id: "rejected-rows",
      severity: "risk",
      label: "Rejected import rows",
      detail: `${input.rejectedRowCount} row${input.rejectedRowCount === 1 ? "" : "s"} failed import validation.`
    });
  }

  if (input.categoryReviewPendingCount > 0) {
    const penalty = Math.min(15, input.categoryReviewPendingCount * 5);
    score -= penalty;
    reasons.push({
      id: "category-review",
      severity: "caution",
      label: "Unresolved category review",
      detail: `${input.categoryReviewPendingCount} row${input.categoryReviewPendingCount === 1 ? "" : "s"} still need classification.`
    });
  }

  if (input.readiness.status === "needs-review") {
    score -= 12;
    reasons.push({
      id: "readiness-needs-review",
      severity: "risk",
      label: "Dashboard needs review",
      detail: input.readiness.headline
    });
  } else if (input.readiness.status === "partial") {
    score -= 6;
    reasons.push({
      id: "readiness-partial",
      severity: "caution",
      label: "Dashboard ready with caveats",
      detail: input.readiness.headline
    });
  } else if (input.readiness.status === "ready") {
    score += 5;
    reasons.push({
      id: "readiness-ready",
      severity: "positive",
      label: "Dashboard ready",
      detail: "Trust checks passed for the visible scope."
    });
  }

  if (input.revenueConcentration >= 0.75) {
    score -= 10;
    reasons.push({
      id: "revenue-concentration-high",
      severity: "caution",
      label: "Concentrated revenue",
      detail: `${Math.round(input.revenueConcentration * 100)}% of revenue comes from one source.`
    });
  } else if (input.revenueConcentration >= 0.5) {
    score -= 4;
    reasons.push({
      id: "revenue-concentration-moderate",
      severity: "caution",
      label: "Moderate revenue concentration",
      detail: `${Math.round(input.revenueConcentration * 100)}% of revenue comes from one source.`
    });
  }

  if (input.forecast.events.length >= 3) {
    score -= 10;
    reasons.push({
      id: "manual-events-heavy",
      severity: "caution",
      label: "Forecast depends on manual events",
      detail: `${input.forecast.events.length} manual future events shape the projection.`
    });
  } else if (input.forecast.events.length > 0) {
    score -= 4;
    reasons.push({
      id: "manual-events-present",
      severity: "caution",
      label: "Manual future events included",
      detail: `${input.forecast.events.length} manual event${input.forecast.events.length === 1 ? "" : "s"} adjust the forecast path.`
    });
  }

  if (input.forecast.rejectedEvents.length > 0) {
    score -= 5;
    reasons.push({
      id: "manual-events-rejected",
      severity: "caution",
      label: "Rejected manual events",
      detail: `${input.forecast.rejectedEvents.length} future-event line${input.forecast.rejectedEvents.length === 1 ? "" : "s"} were ignored.`
    });
  }

  const clamped = clampScore(score);
  const level = confidenceLevel(clamped);

  return {
    level,
    score: clamped,
    headline: confidenceHeadline(level, clamped),
    reasons
  };
}

function confidenceLevel(score: number): RunwayConfidenceLevel {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= MEDIUM_THRESHOLD) return "medium";
  return "low";
}

function confidenceHeadline(level: RunwayConfidenceLevel, score: number): string {
  switch (level) {
    case "high":
      return `High runway confidence (${score}) — history, cash, and review state look solid.`;
    case "medium":
      return `Medium runway confidence (${score}) — usable, but volatility or review debt may shift the number.`;
    default:
      return `Low runway confidence (${score}) — treat runway as directional until cash, history, or review gaps are resolved.`;
  }
}

function volatilityAdjustment(
  coefficient: number | null,
  kind: "income" | "expense",
  reasons: RunwayConfidenceReason[]
): number {
  if (coefficient === null) return 0;

  const label = kind === "income" ? "Income volatility" : "Expense volatility";
  if (coefficient <= 0.3) {
    reasons.push({
      id: `${kind}-volatility-low`,
      severity: "positive",
      label: `Stable ${kind}`,
      detail: `${label} is low across observed months.`
    });
    return 5;
  }

  if (coefficient <= 0.6) {
    reasons.push({
      id: `${kind}-volatility-moderate`,
      severity: "caution",
      label: `Moderate ${kind} swings`,
      detail: `${label} may move runway month to month.`
    });
    return -5;
  }

  reasons.push({
    id: `${kind}-volatility-high`,
    severity: "risk",
    label: `High ${kind} swings`,
    detail: `${label} is high; average burn may not hold.`
  });
  return -12;
}

function countMonthsObserved(records: readonly TransactionRecord[]): number {
  return new Set(records.map((record) => record.periodMonthly)).size;
}

function monthlyTotals(
  records: readonly TransactionRecord[],
  flow: TransactionRecord["flow"]
): number[] {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (record.flow !== flow) continue;
    totals.set(record.periodMonthly, (totals.get(record.periodMonthly) ?? 0) + record.amount);
  }
  return [...totals.values()];
}

function coefficientOfVariation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}