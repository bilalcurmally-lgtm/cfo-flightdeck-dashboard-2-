import type { MetricLineage } from "../finance/audit";
import { compareBudgetToActual, type BudgetEntry } from "../finance/budget";
import type { ExpectedIncomeEvent } from "../finance/expected-income";
import { deriveAuditedCockpit } from "../finance/audit-derive";
import type { CockpitViewModel } from "../finance/cockpit-kpis";
import type { DashboardViewData } from "../finance/dashboard-view";
import type { DashboardFilters } from "../finance/filters";
import type { FinanceSummary } from "../finance/summary";
import type { MetricContract } from "../finance/metric-contract";
import {
  getDetailMetricContracts,
  getScalarMetricContracts
} from "../finance/metric-registry";
import {
  filterExclusionImpact,
  largestTransactionInfluence,
  revenueConcentration,
  topBurnContributors,
  topNetCashContributors
} from "../finance/metric-diagnostics";
import { reviewPresetLabel, type ReviewPreset } from "../finance/review-presets";
import type { ReadinessReport } from "../finance/readiness";
import {
  assessRunwayConfidence,
  buildRunwayConfidenceInput,
  type RunwayConfidenceReport
} from "../finance/runway-confidence";
import type { CsvImportResult, PeriodGrain } from "../finance/types";
import { exportDateStamp, safeExportStem } from "./filenames";

const PRIVACY_NOTE =
  "Generated locally in the browser. Transaction data is not uploaded by default.";

export interface DashboardManifestInput {
  sourceName: string;
  generatedAt?: Date;
  currency: string;
  cashOnHand: number;
  trendGrain: PeriodGrain;
  reviewPreset: ReviewPreset;
  filters: DashboardFilters;
  result: CsvImportResult;
  view: DashboardViewData;
  readiness: ReadinessReport;
  hasImportHistory?: boolean;
  appliedRuleFeedback?: { rowCount: number; ruleCount: number } | null;
  budgets?: readonly BudgetEntry[];
  expectedIncomeEvents?: readonly ExpectedIncomeEvent[];
}

export interface ManifestKpi {
  id: string;
  label: string;
  role: string;
  format: string;
  value: number | null;
  decisionQuestion: string;
  formula: string;
  requiredInputs: string[];
  caveats: string[];
  readiness: string;
}

export interface ManifestDetailContract {
  id: string;
  label: string;
  role: string;
  format: string;
  contextValue: number | null;
  decisionQuestion: string;
  formula: string;
  requiredInputs: string[];
  caveats: string[];
  readiness: string;
}

export interface ManifestChartEncoding {
  x?: string;
  y?: string;
  category?: string;
  value?: string;
  series?: string;
}

export interface ManifestChartSpec {
  id: string;
  title: string;
  analyticalQuestion: string;
  chartType: string;
  datasetId: string;
  encoding: ManifestChartEncoding;
  unit: string;
  emptyState: string;
  caveats: string[];
  rowCount: number;
}

export interface ManifestTableSpec {
  id: string;
  title: string;
  analyticalQuestion: string;
  datasetId: string;
  columns: string[];
  rowCount: number;
  emptyState: string;
  caveats: string[];
}

export interface ManifestDiagnosticItem {
  label: string;
  direction?: string;
  amount?: number;
  share?: number;
}

export interface ManifestDiagnostic {
  id: string;
  title: string;
  datasetId: string;
  summary: string;
  topItems: ManifestDiagnosticItem[];
  available: boolean;
}

export interface ManifestSourceRef {
  id: string;
  label: string;
  kind: string;
  rowCount: number;
}

export interface FinanceDashboardManifest {
  version: 1;
  generatedAt: string;
  source: {
    name: string;
    rawRows: number;
    acceptedRows: number;
    rejectedRows: number;
  };
  context: {
    currency: string;
    cashOnHand: number;
    trendGrain: PeriodGrain;
    reviewPreset: ReviewPreset;
    reviewPresetLabel: string;
    filters: DashboardFilters;
    hasImportHistory: boolean;
    visibleKpiRowCount: number;
    nonOperatingRowCount: number;
    runwayConfidence: {
      level: RunwayConfidenceReport["level"];
      score: number;
      headline: string;
    };
    planning: {
      budgetCount: number;
      budgetVariance: {
        under: number;
        onTrack: number;
        over: number;
        noBudget: number;
      };
      expectedIncomeCount: number;
      expectedIncomeTentativeCount: number;
      expectedIncomeReceivedCount: number;
    };
  };
  readiness: {
    status: string;
    headline: string;
    signals: Array<{ id: string; severity: string; label: string; detail: string }>;
  };
  kpis: ManifestKpi[];
  detailContracts: ManifestDetailContract[];
  charts: ManifestChartSpec[];
  tables: ManifestTableSpec[];
  diagnostics: ManifestDiagnostic[];
  sources: ManifestSourceRef[];
  caveats: string[];
}

export function buildDashboardManifest(input: DashboardManifestInput): FinanceDashboardManifest {
  const generatedAt = input.generatedAt ?? new Date();
  const summary = input.view.summary;
  const records = input.view.filteredRecords;
  const cockpit = deriveAuditedCockpit({
    summary,
    records,
    rejectedRows: input.result.rejectedRows
  });
  const excludedFromKpi = input.result.records.length - records.length;
  const budgets = input.budgets ?? [];
  const expectedIncomeEvents = input.expectedIncomeEvents ?? [];
  const budgetVarianceRows = compareBudgetToActual(budgets, records);
  const runwayConfidence = assessRunwayConfidence(
    buildRunwayConfidenceInput({
      view: input.view,
      cashOnHand: input.cashOnHand,
      readiness: input.readiness,
      rejectedRowCount: input.result.rejectedRows.length,
      expectedIncomeEvents
    })
  );

  return {
    version: 1,
    generatedAt: generatedAt.toISOString(),
    source: {
      name: input.sourceName,
      rawRows: input.result.rawRows.length,
      acceptedRows: input.result.records.length,
      rejectedRows: input.result.rejectedRows.length
    },
    context: {
      currency: input.currency,
      cashOnHand: input.cashOnHand,
      trendGrain: input.trendGrain,
      reviewPreset: input.reviewPreset,
      reviewPresetLabel: reviewPresetLabel(input.reviewPreset),
      filters: input.filters,
      hasImportHistory: input.hasImportHistory ?? false,
      visibleKpiRowCount: records.length,
      nonOperatingRowCount: input.view.nonOperating.rows.length,
      runwayConfidence: {
        level: runwayConfidence.level,
        score: runwayConfidence.score,
        headline: runwayConfidence.headline
      },
      planning: {
        budgetCount: budgets.length,
        budgetVariance: summarizeBudgetVariance(budgetVarianceRows),
        expectedIncomeCount: expectedIncomeEvents.length,
        expectedIncomeTentativeCount: expectedIncomeEvents.filter(
          (event) => event.status === "tentative"
        ).length,
        expectedIncomeReceivedCount: expectedIncomeEvents.filter(
          (event) => event.status === "received"
        ).length
      }
    },
    readiness: {
      status: input.readiness.status,
      headline: input.readiness.headline,
      signals: input.readiness.signals.map((signal) => ({
        id: signal.id,
        severity: signal.severity,
        label: signal.label,
        detail: signal.detail
      }))
    },
    kpis: getScalarMetricContracts().map((contract) => manifestKpi(contract, cockpit, summary)),
    detailContracts: getDetailMetricContracts().map((contract) =>
      manifestDetailContract(contract, input)
    ),
    charts: buildChartSpecs(input),
    tables: buildTableSpecs(input, excludedFromKpi, budgetVarianceRows),
    diagnostics: [
      ...buildDiagnosticSummaries(input),
      buildRunwayConfidenceDiagnostic(runwayConfidence)
    ],
    sources: buildSourceRefs(input),
    caveats: buildCaveats(input, excludedFromKpi)
  };
}

export function dashboardManifestFilename(sourceName: string, generatedAt = new Date()): string {
  return `${safeExportStem(sourceName)}-dashboard-manifest-${exportDateStamp(generatedAt)}.json`;
}

function manifestKpi(
  contract: MetricContract,
  cockpit: CockpitViewModel,
  summary: FinanceSummary
): ManifestKpi {
  return {
    id: contract.id,
    label: contract.label,
    role: contract.role,
    format: contract.format,
    value: contractValue(contract.id, cockpit, summary),
    decisionQuestion: contract.decisionQuestion,
    formula: contract.formula,
    requiredInputs: [...contract.requiredInputs],
    caveats: [...contract.caveats],
    readiness: contract.readiness
  };
}

function manifestDetailContract(
  contract: MetricContract,
  input: DashboardManifestInput
): ManifestDetailContract {
  return {
    id: contract.id,
    label: contract.label,
    role: contract.role,
    format: contract.format,
    contextValue: detailContextValue(contract.id, input),
    decisionQuestion: contract.decisionQuestion,
    formula: contract.formula,
    requiredInputs: [...contract.requiredInputs],
    caveats: [...contract.caveats],
    readiness: contract.readiness
  };
}

function detailContextValue(id: string, input: DashboardManifestInput): number | null {
  const summary = input.view.summary;
  const accepted = input.result.records.length;
  const rejected = input.result.rejectedRows.length;

  switch (id) {
    case "topHeads":
      return summary.topHeads.length;
    case "topSubcategories":
      return summary.topSubcategories.length;
    case "transactionPreview":
      return input.view.selectedRecord ? 1 : 0;
    case "rawRow":
      return input.view.selectedRecord ? 1 : 0;
    case "importQuality":
      return accepted + rejected === 0 ? null : accepted / (accepted + rejected);
    case "accountBalances":
      return summary.accountBalances.length;
    default:
      return null;
  }
}

function contractValue(
  id: string,
  cockpit: CockpitViewModel,
  summary: FinanceSummary
): number | null {
  switch (id) {
    case "netCash":
      return cockpit.netCash;
    case "runwayMonths":
      return cockpit.runwayMonths;
    case "revenue":
      return cockpit.revenue;
    case "outflow":
      return cockpit.outflow;
    case "averageMonthlyOutflow":
      return cockpit.averageMonthlyOutflow;
    case "revenueConcentration":
      return summary.cashHealth.revenueConcentration;
    case "rejectedRows":
      return cockpit.review.rejected;
    case "duplicates":
      return cockpit.review.duplicates;
    case "transfers":
      return cockpit.review.transfers;
    default:
      return null;
  }
}

function buildChartSpecs(input: DashboardManifestInput): ManifestChartSpec[] {
  const summary = input.view.summary;
  const trendPeriods = summary.periodTrend.length;
  const forecastWeeks = input.view.forecast.weeks.length;
  const topHeads = summary.topHeads.length;
  const topSubcategories = summary.topSubcategories.length;
  const accountBalances = summary.accountBalances.length;

  return [
    {
      id: "cashTrend",
      title: "Cash Trend",
      analyticalQuestion: "How did revenue, outflow, and net cash move over time?",
      chartType: "grouped-bar",
      datasetId: "periodTrend",
      encoding: {
        x: "period",
        y: "amount",
        series: "metric"
      },
      unit: input.currency,
      emptyState: "No periods in the visible trend window.",
      caveats: [
        `Grain follows the cockpit trend setting (${input.trendGrain}).`,
        "Uses KPI-visible transactions after filters, review preset, and exclusions."
      ],
      rowCount: trendPeriods
    },
    {
      id: "forecast13Week",
      title: "13-Week Forecast",
      analyticalQuestion: "Where is cash likely to land over the next thirteen weeks?",
      chartType: "line",
      datasetId: "forecastWeeks",
      encoding: {
        x: "weekStartISO",
        y: "projectedCash"
      },
      unit: input.currency,
      emptyState: "Forecast unavailable until cash on hand and history are set.",
      caveats: [
        "Projects from average weekly net plus any manual future events.",
        `Manual events accepted: ${input.view.forecast.events.length}; rejected lines: ${input.view.forecast.rejectedEvents.length}.`
      ],
      rowCount: forecastWeeks
    },
    {
      id: "topHeads",
      title: "Top Heads",
      analyticalQuestion: "Which heads drive the most cash activity?",
      chartType: "horizontal-bar",
      datasetId: "topHeads",
      encoding: {
        category: "head",
        value: "amount",
        series: "flow"
      },
      unit: input.currency,
      emptyState: "No head activity in the visible scope.",
      caveats: ["Ranked by absolute amount within the visible KPI scope."],
      rowCount: topHeads
    },
    {
      id: "topSubcategories",
      title: "Top Subcategories",
      analyticalQuestion: "Which subcategories concentrate spend or revenue?",
      chartType: "horizontal-bar",
      datasetId: "topSubcategories",
      encoding: {
        category: "subcategory",
        value: "amount",
        series: "flow"
      },
      unit: input.currency,
      emptyState: "No subcategory activity in the visible scope.",
      caveats: ["Subcategory labels depend on import mapping quality."],
      rowCount: topSubcategories
    },
    {
      id: "accountBalances",
      title: "Account Balances",
      analyticalQuestion: "How is cash distributed across accounts?",
      chartType: "bar",
      datasetId: "accountBalances",
      encoding: {
        category: "account",
        value: "balance"
      },
      unit: input.currency,
      emptyState: "No account balances derived from the visible ledger.",
      caveats: [
        "Balances may be inferred from net activity when running balances are absent."
      ],
      rowCount: accountBalances
    }
  ];
}

function summarizeBudgetVariance(
  rows: ReturnType<typeof compareBudgetToActual>
): { under: number; onTrack: number; over: number; noBudget: number } {
  return rows.reduce(
    (counts, row) => {
      switch (row.status) {
        case "under":
          counts.under += 1;
          break;
        case "on-track":
          counts.onTrack += 1;
          break;
        case "over":
          counts.over += 1;
          break;
        case "no-budget":
          counts.noBudget += 1;
          break;
      }
      return counts;
    },
    { under: 0, onTrack: 0, over: 0, noBudget: 0 }
  );
}

function buildTableSpecs(
  input: DashboardManifestInput,
  excludedFromKpi: number,
  budgetVarianceRows: ReturnType<typeof compareBudgetToActual>
): ManifestTableSpec[] {
  const visibleCount = input.view.filteredRecords.length;
  const rejectedCount = input.result.rejectedRows.length;
  const categoryReviewPending = input.view.categoryReview.items.filter((item) => !item.acted).length;

  return [
    {
      id: "visibleTransactions",
      title: "Visible Transactions",
      analyticalQuestion: "Which ledger rows are in the current KPI scope?",
      datasetId: "filteredRecords",
      columns: [
        "dateISO",
        "account",
        "flow",
        "head",
        "subcategory",
        "counterparty",
        "amount",
        "signedNet"
      ],
      rowCount: visibleCount,
      emptyState: "No transactions match the current filters and review scope.",
      caveats: [
        "Manifest carries table metadata only; use Transactions CSV or Accountant Workbook for row dumps."
      ]
    },
    {
      id: "exclusionsAndReview",
      title: "Exclusions And Review",
      analyticalQuestion: "Which rows were kept out of KPI totals and why?",
      datasetId: "excludedRecords",
      columns: [
        "dateISO",
        "head",
        "flow",
        "exclusionReason",
        "reviewItemKind",
        "categoryReviewReasons"
      ],
      rowCount: Math.max(excludedFromKpi, categoryReviewPending),
      emptyState: "No exclusions or pending review items in the current scope.",
      caveats: [
        "Counts approximate out-of-scope ledger rows plus pending category-review items."
      ]
    },
    {
      id: "rejectedRows",
      title: "Rejected Import Rows",
      analyticalQuestion: "Which raw import rows failed validation?",
      datasetId: "rejectedRows",
      columns: ["rowNumber", "reason", "rawColumns"],
      rowCount: rejectedCount,
      emptyState: "No rejected import rows for this source.",
      caveats: ["Rejected rows never enter normalized ledger KPIs."]
    },
    {
      id: "kpiAudit",
      title: "KPI Audit",
      analyticalQuestion: "What does each cockpit KPI mean and what value is shown?",
      datasetId: "metricContracts",
      columns: [
        "id",
        "label",
        "role",
        "value",
        "formula",
        "decisionQuestion",
        "caveats",
        "readiness"
      ],
      rowCount: getScalarMetricContracts().length,
      emptyState: "Metric contracts unavailable.",
      caveats: ["Values mirror the visible cockpit scope, not the full import."]
    },
    {
      id: "budgetVsActual",
      title: "Budget Vs Actual",
      analyticalQuestion: "How do monthly budgets compare with imported actuals?",
      datasetId: "budgetVariance",
      columns: [
        "month",
        "scope",
        "key",
        "flow",
        "budgeted",
        "actual",
        "variance",
        "variancePercent",
        "status"
      ],
      rowCount: budgetVarianceRows.length,
      emptyState: "No budgets defined; add rows in Local Settings.",
      caveats: [
        "Compares manual workspace budgets against KPI-visible transactions.",
        "Unbudgeted actuals in budgeted months appear with status no-budget."
      ]
    }
  ];
}

function buildRunwayConfidenceDiagnostic(
  report: RunwayConfidenceReport
): ManifestDiagnostic {
  return {
    id: "runwayConfidence",
    title: "Runway Confidence",
    datasetId: "filteredRecords",
    summary: report.headline,
    topItems: report.reasons.slice(0, 4).map((reason) => ({
      label: reason.label,
      direction: reason.severity
    })),
    available: true
  };
}

function buildDiagnosticSummaries(input: DashboardManifestInput): ManifestDiagnostic[] {
  const records = input.view.filteredRecords;
  const netCash = topNetCashContributors(records);
  const burn = topBurnContributors(records);
  const concentration = revenueConcentration(records);
  const largest = largestTransactionInfluence(records);
  const filterImpact = filterExclusionImpact(input.view.reviewSummary, input.view.summary);

  return [
    {
      id: "netCashContributors",
      title: "Net Cash Contributors",
      datasetId: "filteredRecords",
      summary: `${netCash.positives.length} positive and ${netCash.negatives.length} negative head-level contributors.`,
      topItems: [
        ...netCash.positives.slice(0, 3).map((item) => ({
          label: item.label,
          direction: "positive",
          amount: item.amount
        })),
        ...netCash.negatives.slice(0, 3).map((item) => ({
          label: item.label,
          direction: "negative",
          amount: item.amount
        }))
      ],
      available: netCash.positives.length + netCash.negatives.length > 0
    },
    {
      id: "burnContributors",
      title: "Burn Contributors",
      datasetId: "filteredRecords",
      summary: `${burn.heads.length} head and ${burn.subcategories.length} subcategory burn drivers.`,
      topItems: [
        ...burn.heads.slice(0, 3).map((item) => ({
          label: item.label,
          amount: item.amount,
          share: item.share
        })),
        ...burn.subcategories.slice(0, 2).map((item) => ({
          label: item.label,
          amount: item.amount,
          share: item.share
        }))
      ],
      available: burn.heads.length + burn.subcategories.length > 0
    },
    {
      id: "revenueConcentration",
      title: "Revenue Concentration",
      datasetId: "filteredRecords",
      summary: `${concentration.heads.length} head and ${concentration.counterparties.length} counterparty revenue sources.`,
      topItems: [
        ...concentration.heads.slice(0, 3).map((item) => ({
          label: item.label,
          amount: item.amount,
          share: item.share
        })),
        ...concentration.counterparties.slice(0, 2).map((item) => ({
          label: item.label,
          amount: item.amount,
          share: item.share
        }))
      ],
      available: concentration.heads.length + concentration.counterparties.length > 0
    },
    {
      id: "largestTransactionInfluence",
      title: "Largest Transaction Influence",
      datasetId: "filteredRecords",
      summary: largest
        ? `${largest.label} on ${largest.dateISO} (${largest.flow}) drives ${Math.round(largest.shareOfActivity * 100)}% of gross activity.`
        : "No transactions in the visible scope.",
      topItems: largest
        ? [
            {
              label: largest.label,
              direction: largest.flow,
              amount: largest.amount,
              share: largest.shareOfActivity
            }
          ]
        : [],
      available: largest !== null
    },
    {
      id: "filterExclusionImpact",
      title: "Filter And Exclusion Impact",
      datasetId: "reviewSummary",
      summary: filterImpact
        ? `${filterImpact.hiddenRecords} rows hidden; ${filterImpact.deltas.length} headline KPI deltas recorded.`
        : "No comparable before/after KPI scope for the current exclusions.",
      topItems:
        filterImpact?.deltas.slice(0, 4).map((delta) => ({
          label: delta.metric,
          direction: delta.delta >= 0 ? "up" : "down",
          amount: delta.delta
        })) ?? [],
      available: filterImpact !== null
    }
  ];
}

function buildSourceRefs(input: DashboardManifestInput): ManifestSourceRef[] {
  const summary = input.view.summary;
  return [
    {
      id: "rawImport",
      label: input.sourceName,
      kind: "csvImport",
      rowCount: input.result.rawRows.length
    },
    {
      id: "normalizedLedger",
      label: "Accepted import rows",
      kind: "transactionRecords",
      rowCount: input.result.records.length
    },
    {
      id: "filteredRecords",
      label: "KPI-visible ledger",
      kind: "transactionRecords",
      rowCount: input.view.filteredRecords.length
    },
    {
      id: "periodTrend",
      label: "Period trend",
      kind: "aggregates",
      rowCount: summary.periodTrend.length
    },
    {
      id: "forecastWeeks",
      label: "13-week forecast",
      kind: "forecast",
      rowCount: input.view.forecast.weeks.length
    },
    {
      id: "rejectedRows",
      label: "Rejected import rows",
      kind: "importIssues",
      rowCount: input.result.rejectedRows.length
    }
  ];
}

function buildCaveats(input: DashboardManifestInput, excludedFromKpi: number): string[] {
  const caveats = [
    PRIVACY_NOTE,
    "Manifest describes the dashboard surface; it does not include full ledger row dumps.",
    `Review preset: ${reviewPresetLabel(input.reviewPreset)}.`,
    `${excludedFromKpi} accepted rows are outside the visible KPI scope.`
  ];

  if (input.appliedRuleFeedback && input.appliedRuleFeedback.rowCount > 0) {
    caveats.push(
      `Saved rules applied to ${input.appliedRuleFeedback.rowCount} rows via ${input.appliedRuleFeedback.ruleCount} rules.`
    );
  }

  const budgetCount = input.budgets?.length ?? 0;
  if (budgetCount > 0) {
    caveats.push(`${budgetCount} manual budget row${budgetCount === 1 ? "" : "s"} in workspace.`);
  }

  const expectedIncomeCount = input.expectedIncomeEvents?.length ?? 0;
  if (expectedIncomeCount > 0) {
    const tentative = (input.expectedIncomeEvents ?? []).filter(
      (event) => event.status === "tentative"
    ).length;
    caveats.push(
      `${expectedIncomeCount} structured expected-income event${expectedIncomeCount === 1 ? "" : "s"}; ${tentative} tentative.`
    );
  }

  const lineageCaveat = lineageAssumptionNote(input.view.summary);
  if (lineageCaveat) caveats.push(lineageCaveat);

  return caveats;
}

function lineageAssumptionNote(summary: FinanceSummary): string | null {
  const assumptions = [
    summary.lineage.netCash,
    summary.lineage.revenue,
    summary.lineage.outflow,
    summary.cashHealth.lineage.runwayMonths
  ]
    .filter((lineage): lineage is MetricLineage => lineage !== undefined)
    .flatMap((lineage) => lineage.assumptions);

  if (assumptions.length === 0) return null;
  return `KPI lineage relies on ${assumptions.length} explicit assumption(s) in the visible scope.`;
}