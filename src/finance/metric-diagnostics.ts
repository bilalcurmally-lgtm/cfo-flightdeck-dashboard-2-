import type { TransactionRecord } from "./types";

/**
 * Local metric diagnostics — deterministic, offline explanations of *why* a cash
 * metric changed between imports or *what* is driving it now. Explainers:
 *  - explainRunwayChange: decomposes a runway delta into cash vs burn drivers.
 *  - topNetCashContributors: the biggest inflows and outflows behind net cash.
 *  - topBurnContributors: the biggest outflow heads/subcategories behind burn.
 *  - revenueConcentration: the biggest revenue sources by head/counterparty.
 *  - largestTransactionInfluence: the single row with the largest cash effect.
 *  - filterExclusionImpact: how the current view/exclusions changed headline KPIs.
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

export interface BurnContributor {
  label: string;
  amount: number;
  share: number;
}

export interface BurnContributors {
  total: number;
  heads: BurnContributor[];
  subcategories: BurnContributor[];
}

export interface BurnContributorOptions {
  limit?: number;
}

/**
 * Biggest outflow groups behind average burn. Heads answer "which budget areas
 * drive burn?", subcategories answer "what specifically inside those areas?".
 */
export function topBurnContributors(
  records: readonly TransactionRecord[],
  options: BurnContributorOptions = {}
): BurnContributors {
  const limit = options.limit ?? 3;
  const outflows = records.filter((record) => record.flow === "outflow");
  const total = outflows.reduce((sum, record) => sum + record.amount, 0);
  if (total === 0) return { total: 0, heads: [], subcategories: [] };

  return {
    total,
    heads: rankBurn(groupBurn(outflows, (record) => record.head), total, limit),
    subcategories: rankBurn(
      groupBurn(outflows, (record) => `${record.head} / ${record.subcategory}`),
      total,
      limit
    )
  };
}

function groupBurn(
  records: readonly TransactionRecord[],
  labelFor: (record: TransactionRecord) => string
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const label = labelFor(record);
    totals.set(label, (totals.get(label) ?? 0) + record.amount);
  }
  return totals;
}

function rankBurn(
  totals: Map<string, number>,
  total: number,
  limit: number
): BurnContributor[] {
  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface RevenueConcentrationItem {
  label: string;
  amount: number;
  share: number;
}

export interface RevenueConcentration {
  total: number;
  topHead: RevenueConcentrationItem | null;
  topCounterparty: RevenueConcentrationItem | null;
  heads: RevenueConcentrationItem[];
  counterparties: RevenueConcentrationItem[];
}

export interface RevenueConcentrationOptions {
  limit?: number;
}

/**
 * Revenue concentration explains dependency risk: how much revenue comes from
 * the largest category/head and the largest customer/counterparty.
 */
export function revenueConcentration(
  records: readonly TransactionRecord[],
  options: RevenueConcentrationOptions = {}
): RevenueConcentration {
  const limit = options.limit ?? 3;
  const revenue = records.filter((record) => record.flow === "revenue");
  const total = revenue.reduce((sum, record) => sum + record.amount, 0);
  if (total === 0) {
    return { total: 0, topHead: null, topCounterparty: null, heads: [], counterparties: [] };
  }

  const heads = rankRevenue(groupRevenue(revenue, (record) => record.head), total, limit);
  const counterparties = rankRevenue(
    groupRevenue(revenue, (record) => record.counterparty),
    total,
    limit
  );

  return {
    total,
    topHead: heads[0] ?? null,
    topCounterparty: counterparties[0] ?? null,
    heads,
    counterparties
  };
}

function groupRevenue(
  records: readonly TransactionRecord[],
  labelFor: (record: TransactionRecord) => string
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const record of records) {
    const label = labelFor(record);
    totals.set(label, (totals.get(label) ?? 0) + record.amount);
  }
  return totals;
}

function rankRevenue(
  totals: Map<string, number>,
  total: number,
  limit: number
): RevenueConcentrationItem[] {
  return [...totals.entries()]
    .map(([label, amount]) => ({ label, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export interface LargestTransactionInfluence {
  id: string;
  label: string;
  dateISO: string;
  head: string;
  counterparty: string;
  flow: "revenue" | "outflow";
  amount: number;
  signedImpact: number;
  totalActivity: number;
  netCash: number;
  shareOfActivity: number;
}

/**
 * Identifies whether one row dominates the period. `amount` is the absolute row
 * value; `signedImpact` is its effect on net cash.
 */
export function largestTransactionInfluence(
  records: readonly TransactionRecord[]
): LargestTransactionInfluence | null {
  if (records.length === 0) return null;

  const totalActivity = records.reduce((sum, record) => sum + record.amount, 0);
  const netCash = records.reduce((sum, record) => sum + record.signedNet, 0);
  const largest = [...records].sort((a, b) => b.amount - a.amount)[0];

  return {
    id: largest.id,
    label: largest.description || largest.head,
    dateISO: largest.dateISO,
    head: largest.head,
    counterparty: largest.counterparty,
    flow: largest.flow,
    amount: largest.amount,
    signedImpact: largest.signedNet,
    totalActivity,
    netCash,
    shareOfActivity: totalActivity > 0 ? largest.amount / totalActivity : 0
  };
}

export interface FilterExclusionSnapshot {
  revenue: number;
  outflow: number;
  netCash: number;
  transactionCount: number;
}

export type FilterExclusionMetric = "revenue" | "outflow" | "netCash";

export interface FilterExclusionDelta {
  metric: FilterExclusionMetric;
  before: number;
  after: number;
  delta: number;
}

export interface FilterExclusionImpact {
  before: FilterExclusionSnapshot;
  after: FilterExclusionSnapshot;
  hiddenRecords: number;
  deltas: FilterExclusionDelta[];
}

/**
 * Compares the current filtered/reviewable ledger to the final visible KPI
 * state after review preset, non-operating exclusions, and review decisions.
 */
export function filterExclusionImpact(
  before: FilterExclusionSnapshot,
  after: FilterExclusionSnapshot
): FilterExclusionImpact | null {
  const deltas: FilterExclusionDelta[] = [
    deltaFor("revenue", before, after),
    deltaFor("outflow", before, after),
    deltaFor("netCash", before, after)
  ].filter((delta) => delta.delta !== 0);
  const hiddenRecords = Math.max(0, before.transactionCount - after.transactionCount);

  if (deltas.length === 0 && hiddenRecords === 0) return null;
  return { before, after, hiddenRecords, deltas };
}

function deltaFor(
  metric: FilterExclusionMetric,
  before: FilterExclusionSnapshot,
  after: FilterExclusionSnapshot
): FilterExclusionDelta {
  return {
    metric,
    before: before[metric],
    after: after[metric],
    delta: after[metric] - before[metric]
  };
}
