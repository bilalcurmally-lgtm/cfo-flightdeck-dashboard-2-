import type { TransactionRecord } from "./types";

/**
 * Local metric diagnostics — deterministic, offline explanations of *why* a cash
 * metric changed between imports or *what* is driving it now. Explainers:
 *  - explainRunwayChange: decomposes a runway delta into cash vs burn drivers.
 *  - topNetCashContributors: the biggest inflows and outflows behind net cash.
 *
 * Pure: callers pass the metric snapshots/records plus formatters (mirroring the
 * lineage drawer), and the model returns fully-formed values or text.
 */

export interface RunwayInputs {
  runwayMonths: number | null;
  cashOnHand: number | null;
  averageMonthlyOutflow: number | null;
}

export interface DiagnosticsFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

export type RunwayChangeDirection = "up" | "down" | "flat" | "unavailable";

export interface RunwayDriver {
  factor: "cash" | "burn";
  direction: "up" | "down";
  detail: string;
}

export interface RunwayExplanation {
  direction: RunwayChangeDirection;
  headline: string;
  drivers: RunwayDriver[];
}

/** Runway moves under this many months are treated as flat. */
const FLAT_EPSILON = 0.05;

export function explainRunwayChange(
  previous: RunwayInputs,
  current: RunwayInputs,
  formatters: DiagnosticsFormatters
): RunwayExplanation {
  const { formatMoney, formatRunway } = formatters;

  if (current.runwayMonths === null) {
    const reason =
      current.cashOnHand === null || current.cashOnHand <= 0
        ? "set cash on hand to compute runway"
        : "there is no recorded burn yet";
    return {
      direction: "unavailable",
      headline: `Runway is unavailable — ${reason}.`,
      drivers: []
    };
  }

  if (previous.runwayMonths === null) {
    return {
      direction: "flat",
      headline: `Runway is ${formatRunway(
        current.runwayMonths
      )} now — no comparable prior runway to explain the change.`,
      drivers: []
    };
  }

  const delta = current.runwayMonths - previous.runwayMonths;
  const direction: RunwayChangeDirection =
    Math.abs(delta) < FLAT_EPSILON ? "flat" : delta > 0 ? "up" : "down";

  const drivers = buildDrivers(previous, current, formatMoney);
  const primary = drivers[0];

  let headline: string;
  if (direction === "flat") {
    headline = `Runway held at ${formatRunway(current.runwayMonths)}.`;
  } else {
    const verb = direction === "up" ? "rose" : "fell";
    const base = `Runway ${verb} from ${formatRunway(
      previous.runwayMonths
    )} to ${formatRunway(current.runwayMonths)}`;
    headline = primary
      ? `${base}, mainly because ${shortClause(primary)}.`
      : `${base}.`;
  }

  return { direction, headline, drivers };
}

interface ScoredDriver extends RunwayDriver {
  contribution: number;
}

function buildDrivers(
  previous: RunwayInputs,
  current: RunwayInputs,
  formatMoney: (value: number) => string
): RunwayDriver[] {
  const prevCash = previous.cashOnHand;
  const currCash = current.cashOnHand;
  const prevBurn = previous.averageMonthlyOutflow;
  const currBurn = current.averageMonthlyOutflow;

  // Counterfactual contributions need positive burn in both snapshots.
  const canDecompose =
    prevCash !== null &&
    currCash !== null &&
    prevBurn !== null &&
    currBurn !== null &&
    prevBurn > 0 &&
    currBurn > 0;
  if (!canDecompose) return [];

  const scored: ScoredDriver[] = [];
  const cashDelta = currCash - prevCash;
  const burnDelta = currBurn - prevBurn;

  if (cashDelta !== 0) {
    scored.push({
      factor: "cash",
      direction: cashDelta > 0 ? "up" : "down",
      detail: `Cash on hand ${cashDelta > 0 ? "rose" : "fell"} by ${formatMoney(
        Math.abs(cashDelta)
      )} (${formatMoney(prevCash)} → ${formatMoney(currCash)}).`,
      // holding burn at the previous level isolates the cash effect
      contribution: currCash / prevBurn - prevCash / prevBurn
    });
  }

  if (burnDelta !== 0) {
    scored.push({
      factor: "burn",
      direction: burnDelta > 0 ? "up" : "down",
      detail: `Monthly burn ${burnDelta > 0 ? "rose" : "fell"} by ${formatMoney(
        Math.abs(burnDelta)
      )} (${formatMoney(prevBurn)} → ${formatMoney(currBurn)}).`,
      // holding cash at the current level isolates the burn effect
      contribution: currCash / currBurn - currCash / prevBurn
    });
  }

  scored.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return scored.map(({ contribution: _c, ...driver }) => driver);
}

function shortClause(driver: RunwayDriver): string {
  const verb = driver.direction === "up" ? "increased" : "decreased";
  return driver.factor === "cash" ? `cash on hand ${verb}` : `monthly burn ${verb}`;
}

export interface NetCashContributor {
  label: string;
  amount: number;
  flow: "revenue" | "outflow";
}

export interface NetCashContributors {
  positives: NetCashContributor[];
  negatives: NetCashContributor[];
}

export interface NetCashContributorOptions {
  limit?: number;
  groupBy?: "head" | "counterparty";
}

/**
 * The biggest inflows (positives) and outflows (negatives) behind net cash,
 * grouped by head (default) or counterparty and sorted by magnitude. Answers
 * "what is driving net cash?" alongside the lineage drawer's "how it was computed".
 */
export function topNetCashContributors(
  records: readonly TransactionRecord[],
  options: NetCashContributorOptions = {}
): NetCashContributors {
  const limit = options.limit ?? 3;
  const key = options.groupBy ?? "head";

  const positives = groupByLabel(records, "revenue", key);
  const negatives = groupByLabel(records, "outflow", key);

  return {
    positives: rank(positives, "revenue", limit),
    negatives: rank(negatives, "outflow", limit)
  };
}

function groupByLabel(
  records: readonly TransactionRecord[],
  flow: "revenue" | "outflow",
  key: "head" | "counterparty"
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    if (record.flow !== flow) continue;
    const label = record[key];
    totals.set(label, (totals.get(label) ?? 0) + record.amount);
  }
  return totals;
}

function rank(
  totals: Map<string, number>,
  flow: "revenue" | "outflow",
  limit: number
): NetCashContributor[] {
  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount, flow }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}
