/**
 * Dashboard readiness model — a compact, deterministic answer to "can I trust
 * this dashboard right now?". It folds the cockpit's scattered trust signals
 * (rejected rows, duplicates, transfers, unassigned categories, missing
 * cash-on-hand, category-review suggestions, non-operating exclusions, import
 * history) into a single status plus the signals that produced it.
 *
 * Pure and decoupled: callers map their domain objects into a {@link ReadinessInput}
 * of counts/flags, mirroring the metric-registry split between data and rendering.
 */

import type { DashboardViewData } from "./dashboard-view";

export type ReadinessStatus = "ready" | "partial" | "needs-review" | "empty";

/** blocker downgrades to needs-review, caution to partial, info never downgrades. */
export type ReadinessSeverity = "blocker" | "caution" | "info";

export interface ReadinessInput {
  transactionCount: number;
  rejectedRows: number;
  duplicateGroups: number;
  transferCandidates: number;
  categoryReviewItems: number;
  unassignedHeads: number;
  unassignedCounterparties: number;
  /** Whether a cash-on-hand figure was provided (runway depends on it). */
  hasCashOnHand: boolean;
  /** Share of revenue from the largest source, 0..1. */
  revenueConcentration: number;
  nonOperatingRows: number;
  /** Whether a prior import exists to compare against. */
  hasImportHistory: boolean;
}

export interface ReadinessSignal {
  id: string;
  severity: ReadinessSeverity;
  label: string;
  detail: string;
}

export interface ReadinessReport {
  status: ReadinessStatus;
  headline: string;
  signals: ReadinessSignal[];
}

export interface BuildReadinessInputOptions {
  view: DashboardViewData;
  rejectedRowCount: number;
  cashOnHand: number;
  hasImportHistory?: boolean;
  /** Defaults to `view.categoryReview.items.length`. */
  categoryReviewItemCount?: number;
}

/** Shared readiness inputs for render and export paths. */
export function buildReadinessInput(options: BuildReadinessInputOptions): ReadinessInput {
  const {
    view,
    rejectedRowCount,
    cashOnHand,
    hasImportHistory = false,
    categoryReviewItemCount = view.categoryReview.items.length
  } = options;

  return {
    transactionCount: view.summary.transactionCount,
    rejectedRows: rejectedRowCount,
    duplicateGroups: view.summary.diagnostics.duplicateGroups.length,
    transferCandidates: view.summary.diagnostics.transferCandidates.length,
    categoryReviewItems: categoryReviewItemCount,
    unassignedHeads: view.filteredRecords.filter((record) => record.head === "Unassigned Head")
      .length,
    unassignedCounterparties: view.filteredRecords.filter(
      (record) => record.counterparty === "Unassigned Counterparty"
    ).length,
    hasCashOnHand: cashOnHand > 0,
    revenueConcentration: view.summary.cashHealth.revenueConcentration,
    nonOperatingRows: view.nonOperating?.rows.length ?? 0,
    hasImportHistory
  };
}

function plural(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`;
}

export function assessReadiness(input: ReadinessInput): ReadinessReport {
  if (input.transactionCount <= 0) {
    return {
      status: "empty",
      headline: "No data imported yet.",
      signals: []
    };
  }

  const signals: ReadinessSignal[] = [];

  if (input.rejectedRows > 0) {
    signals.push({
      id: "rejectedRows",
      severity: "blocker",
      label: "Rejected rows",
      detail: `${input.rejectedRows} ${plural(
        input.rejectedRows,
        "row"
      )} failed to import and are missing from every KPI.`
    });
  }

  if (input.unassignedHeads > 0) {
    signals.push({
      id: "unassignedHeads",
      severity: "blocker",
      label: "Unassigned categories",
      detail: `${input.unassignedHeads} ${plural(
        input.unassignedHeads,
        "row"
      )} have no category, so revenue and outflow may be misstated.`
    });
  }

  if (input.categoryReviewItems > 0) {
    signals.push({
      id: "categoryReviewItems",
      severity: "caution",
      label: "Category review",
      detail: `${input.categoryReviewItems} suggested ${plural(
        input.categoryReviewItems,
        "recategorization"
      )} pending.`
    });
  }

  if (input.duplicateGroups > 0) {
    signals.push({
      id: "duplicateGroups",
      severity: "caution",
      label: "Duplicates",
      detail: `${input.duplicateGroups} possible duplicate ${plural(
        input.duplicateGroups,
        "group"
      )}.`
    });
  }

  if (input.transferCandidates > 0) {
    signals.push({
      id: "transferCandidates",
      severity: "caution",
      label: "Transfers",
      detail: `${input.transferCandidates} possible internal ${plural(
        input.transferCandidates,
        "transfer"
      )}.`
    });
  }

  if (!input.hasCashOnHand) {
    signals.push({
      id: "cashOnHand",
      severity: "caution",
      label: "Runway unavailable",
      detail: "Set cash on hand to compute runway."
    });
  }

  if (input.unassignedCounterparties > 0) {
    signals.push({
      id: "unassignedCounterparties",
      severity: "caution",
      label: "Unassigned counterparties",
      detail: `${input.unassignedCounterparties} ${plural(
        input.unassignedCounterparties,
        "row"
      )} without a counterparty, so revenue concentration is partial.`
    });
  }

  if (input.revenueConcentration >= 0.75) {
    signals.push({
      id: "revenueConcentration",
      severity: "caution",
      label: "Revenue concentration",
      detail: `${Math.round(
        input.revenueConcentration * 100
      )}% of revenue comes from one source.`
    });
  }

  if (input.nonOperatingRows > 0) {
    signals.push({
      id: "nonOperating",
      severity: "info",
      label: "Non-operating money",
      detail: `${input.nonOperatingRows} ${plural(
        input.nonOperatingRows,
        "row"
      )} excluded from operating KPIs (kept in your export).`
    });
  }

  if (!input.hasImportHistory) {
    signals.push({
      id: "importHistory",
      severity: "info",
      label: "First import",
      detail: "No prior import to compare against yet."
    });
  }

  const actionable = signals.filter((signal) => signal.severity !== "info");
  const hasBlocker = signals.some((signal) => signal.severity === "blocker");

  const status: ReadinessStatus = hasBlocker
    ? "needs-review"
    : actionable.length > 0
      ? "partial"
      : "ready";

  return { status, headline: headlineFor(status, actionable.length), signals };
}

function headlineFor(status: ReadinessStatus, actionable: number): string {
  switch (status) {
    case "ready":
      return "Dashboard ready — every signal checks out.";
    case "partial":
      return `Dashboard ready with caveats — ${actionable} ${plural(
        actionable,
        "item"
      )} to review.`;
    case "needs-review":
      return `Needs review — ${actionable} ${plural(
        actionable,
        "item"
      )} affecting trust.`;
    case "empty":
      return "No data imported yet.";
  }
}
