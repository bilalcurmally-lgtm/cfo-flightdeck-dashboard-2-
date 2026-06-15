import type { MetricLineage } from "../finance/audit";
import type { CockpitViewModel } from "../finance/cockpit-kpis";
import { deriveAuditedCockpit } from "../finance/audit-derive";
import {
  applyClassificationOverrides,
  type ClassificationOverride
} from "../finance/classification-overrides";
import type { DashboardViewData } from "../finance/dashboard-view";
import type { DashboardFilters } from "../finance/filters";
import { filterTransactions } from "../finance/filters";
import type { FinanceSummary } from "../finance/summary";
import type { MetricContract } from "../finance/metric-contract";
import { getScalarMetricContracts } from "../finance/metric-registry";
import {
  filterExclusionImpact,
  largestTransactionInfluence,
  revenueConcentration,
  topBurnContributors,
  topNetCashContributors
} from "../finance/metric-diagnostics";
import { isOperating } from "../finance/operating-groups";
import { reviewPresetLabel, type ReviewPreset } from "../finance/review-presets";
import type { ReadinessReport } from "../finance/readiness";
import { assessRunwayConfidence, buildRunwayConfidenceInput } from "../finance/runway-confidence";
import type { CsvImportResult, ImportIssue, PeriodGrain, TransactionRecord } from "../finance/types";
import { buildReviewDrawerItems } from "../ui/review-queue";
import type { ReviewDrawerItem } from "../ui/review-drawer";
import { exportDateStamp, safeExportStem } from "./filenames";
import { LEDGER_WORKBOOK_HEADERS, ledgerWorkbookRow } from "./ledger-workbook-row";
import { makeWorkbookBlob, type WorkbookCellValue, type WorkbookSheetDefinition } from "./xlsx-workbook";

const PRIVACY_NOTE =
  "Generated locally in the browser. Transaction data is not uploaded by default.";

export interface AccountantWorkbookInput {
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
  overrides: Map<string, ClassificationOverride>;
  excludedReviewItemIds: ReadonlySet<string>;
  formatMoney: (value: number) => string;
  appliedRuleFeedback?: { rowCount: number; ruleCount: number } | null;
}

export function buildAccountantWorkbook(input: AccountantWorkbookInput): Blob {
  const sheets: WorkbookSheetDefinition[] = [
    { name: "Summary", rows: buildSummaryRows(input) },
    { name: "KPI Audit", rows: buildKpiAuditRows(input) },
    { name: "Normalized Ledger", rows: buildNormalizedLedgerRows(input) },
    { name: "Exclusions And Review", rows: buildExclusionsRows(input) },
    { name: "Rejected Rows", rows: buildRejectedRows(input.result.rejectedRows) },
    { name: "Diagnostics", rows: buildDiagnosticsRows(input) }
  ];
  return makeWorkbookBlob(sheets);
}

export function accountantWorkbookFilename(sourceName: string, generatedAt = new Date()): string {
  return `${safeExportStem(sourceName)}-accountant-workbook-${exportDateStamp(generatedAt)}.xlsx`;
}

function buildSummaryRows(input: AccountantWorkbookInput): WorkbookCellValue[][] {
  const generatedAt = input.generatedAt ?? new Date();
  const overridden = applyClassificationOverrides(input.result.records, input.overrides);
  const reviewFiltered = filterTransactions(overridden, input.filters);
  const visibleIds = new Set(input.view.filteredRecords.map((record) => record.id));
  const excludedFromKpi = overridden.filter((record) => !visibleIds.has(record.id)).length;
  const rows: WorkbookCellValue[][] = [
    ["Field", "Value"],
    ["Generated At", generatedAt.toISOString()],
    ["Source File", input.sourceName],
    ["Currency", input.currency],
    ["Cash On Hand", input.cashOnHand],
    ["Review Preset", reviewPresetLabel(input.reviewPreset)],
    ["Trend Grain", input.trendGrain],
    ["Filter: Flow", input.filters.flow],
    ["Filter: Account", input.filters.account],
    ["Filter: Head", input.filters.head],
    ["Filter: Subcategory", input.filters.subcategory],
    ["Filter: Counterparty", input.filters.counterparty],
    ["Filter: Date From", input.filters.dateFrom],
    ["Filter: Date To", input.filters.dateTo],
    ["Raw Import Rows", input.result.rawRows.length],
    ["Accepted Rows", input.result.records.length],
    ["Rejected Rows", input.result.rejectedRows.length],
    ["Visible KPI Rows", input.view.filteredRecords.length],
    ["Excluded From KPI Rows", excludedFromKpi],
    ["Non-Operating Rows", input.view.nonOperating.rows.length],
    ["Readiness Status", input.readiness.status],
    ["Readiness Headline", input.readiness.headline]
  ];

  const runwayConfidence = assessRunwayConfidence(
    buildRunwayConfidenceInput({
      view: input.view,
      cashOnHand: input.cashOnHand,
      readiness: input.readiness,
      rejectedRowCount: input.result.rejectedRows.length
    })
  );
  rows.push(
    ["Runway Confidence Level", runwayConfidence.level],
    ["Runway Confidence Score", runwayConfidence.score],
    ["Runway Confidence Headline", runwayConfidence.headline]
  );

  if (input.appliedRuleFeedback && input.appliedRuleFeedback.rowCount > 0) {
    rows.push([
      "Saved Rules Applied",
      `${input.appliedRuleFeedback.rowCount} rows via ${input.appliedRuleFeedback.ruleCount} rules`
    ]);
  }

  rows.push(["", ""]);
  rows.push(["Signal Id", "Severity", "Label", "Detail"]);
  for (const signal of input.readiness.signals) {
    rows.push([signal.id, signal.severity, signal.label, signal.detail]);
  }

  rows.push(["", ""]);
  rows.push(["Privacy", PRIVACY_NOTE]);
  rows.push(["Review Filtered Rows", reviewFiltered.length]);
  return rows;
}

function buildKpiAuditRows(input: AccountantWorkbookInput): WorkbookCellValue[][] {
  const cockpit = deriveAuditedCockpit({
    summary: input.view.summary,
    records: input.view.filteredRecords,
    rejectedRows: input.result.rejectedRows
  });

  const header = [
    "Metric Id",
    "Label",
    "Role",
    "Value",
    "Format",
    "Decision Question",
    "Formula",
    "Required Inputs",
    "Caveats",
    "Readiness Expectation",
    "Plain English",
    "Direct Row Count",
    "Excluded Row Count",
    "Assumptions"
  ];

  return [
    header,
    ...getScalarMetricContracts().map((contract) =>
      kpiAuditRow(contract, cockpit, input.view.summary)
    )
  ];
}

function kpiAuditRow(
  contract: MetricContract,
  cockpit: CockpitViewModel,
  summary: FinanceSummary
): WorkbookCellValue[] {
  const lineage = lineageForContract(contract.id, summary);
  const value = contractValue(contract.id, cockpit, summary);

  return [
    contract.id,
    contract.label,
    contract.role,
    value ?? "",
    contract.format,
    contract.decisionQuestion,
    contract.formula,
    contract.requiredInputs.join(", "),
    contract.caveats.join(" "),
    contract.readiness,
    lineage?.plainEnglish ?? "",
    lineage?.direct.length ?? 0,
    lineage?.excluded.length ?? 0,
    formatAssumptions(lineage)
  ];
}

function contractValue(
  id: string,
  cockpit: CockpitViewModel,
  summary: FinanceSummary
): WorkbookCellValue {
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
      return "";
  }
}

function lineageForContract(id: string, summary: FinanceSummary): MetricLineage | undefined {
  switch (id) {
    case "netCash":
      return summary.lineage.netCash;
    case "revenue":
      return summary.lineage.revenue;
    case "outflow":
      return summary.lineage.outflow;
    case "averageMonthlyOutflow":
      return summary.cashHealth.lineage.averageMonthlyOutflow;
    case "runwayMonths":
      return summary.cashHealth.lineage.runwayMonths;
    default:
      return undefined;
  }
}

function formatAssumptions(lineage: MetricLineage | undefined): string {
  if (!lineage || lineage.assumptions.length === 0) return "";
  return lineage.assumptions
    .map((assumption) => `${assumption.label}=${assumption.value} (${assumption.source})`)
    .join("; ");
}

function buildNormalizedLedgerRows(input: AccountantWorkbookInput): WorkbookCellValue[][] {
  const header = [...LEDGER_WORKBOOK_HEADERS, "Override Applied", "Operating"];
  const sorted = [...input.view.filteredRecords].sort(
    (left, right) => left.dateISO.localeCompare(right.dateISO) || left.id.localeCompare(right.id)
  );

  return [
    header,
    ...sorted.map((record) => [
      ...ledgerWorkbookRow(record),
      input.overrides.has(record.id) ? "yes" : "no",
      isOperating(record) ? "yes" : "no"
    ])
  ];
}

const EXCLUSION_HEADERS = [
  ...LEDGER_WORKBOOK_HEADERS,
  "Exclusion Reason",
  "Review Item Id",
  "Review Item Kind",
  "Category Review Reasons",
  "Confidence"
] as const;

function buildExclusionsRows(input: AccountantWorkbookInput): WorkbookCellValue[][] {
  const rows = deriveExclusionRows(input);
  const sorted = [...rows].sort(
    (left, right) =>
      left.reason.localeCompare(right.reason) ||
      left.record.dateISO.localeCompare(right.record.dateISO) ||
      left.record.id.localeCompare(right.record.id)
  );

  return [
    [...EXCLUSION_HEADERS],
    ...sorted.map((row) => [
      ...ledgerWorkbookRow(row.record),
      row.reason,
      row.reviewItemId,
      row.reviewItemKind,
      row.categoryReviewReasons,
      row.confidence
    ])
  ];
}

interface ExclusionRow {
  record: TransactionRecord;
  reason: string;
  reviewItemId: string;
  reviewItemKind: string;
  categoryReviewReasons: string;
  confidence: string;
}

function deriveExclusionRows(input: AccountantWorkbookInput): ExclusionRow[] {
  const overridden = applyClassificationOverrides(input.result.records, input.overrides);
  const reviewFiltered = filterTransactions(overridden, input.filters);
  const reviewFilteredIds = new Set(reviewFiltered.map((record) => record.id));
  const visibleIds = new Set(input.view.filteredRecords.map((record) => record.id));
  const baseIds = new Set(input.view.baseFilteredRecords.map((record) => record.id));
  const reviewExcludedIds = new Set(input.view.excludedTransactionIds ?? []);
  const reviewItems = buildReviewDrawerItems({
    summary: input.view.reviewSummary,
    rejectedRows: input.result.rejectedRows,
    excludedReviewItemIds: input.excludedReviewItemIds,
    formatMoney: input.formatMoney
  });
  const reviewItemByRecordId = mapReviewItemsByRecordId(reviewItems);
  const categoryById = new Map(
    input.view.categoryReview.items.map((item) => [item.id, item] as const)
  );
  const rows: ExclusionRow[] = [];
  const seen = new Set<string>();

  for (const record of overridden) {
    const reason = exclusionReason(record, {
      reviewFilteredIds,
      visibleIds,
      baseIds,
      reviewExcludedIds
    });
    if (!reason) continue;

    const reviewMatch = reviewItemByRecordId.get(record.id);
    rows.push({
      record,
      reason,
      reviewItemId: reviewMatch?.id ?? "",
      reviewItemKind: reviewMatch?.kind ?? "",
      categoryReviewReasons: categoryById.get(record.id)?.reasons.join(", ") ?? "",
      confidence: reviewMatch?.confidence ?? "medium"
    });
    seen.add(record.id);
  }

  for (const item of input.view.categoryReview.items) {
    if (item.acted || seen.has(item.id)) continue;
    const reviewMatch = reviewItemByRecordId.get(item.id);
    rows.push({
      record: item.record,
      reason: "needs category review",
      reviewItemId: reviewMatch?.id ?? "",
      reviewItemKind: reviewMatch?.kind ?? "category",
      categoryReviewReasons: item.reasons.join(", "),
      confidence: reviewMatch?.confidence ?? "medium"
    });
  }

  return rows;
}

function exclusionReason(
  record: TransactionRecord,
  context: {
    reviewFilteredIds: Set<string>;
    visibleIds: Set<string>;
    baseIds: Set<string>;
    reviewExcludedIds: Set<string>;
  }
): string | null {
  if (context.visibleIds.has(record.id)) return null;
  if (!context.reviewFilteredIds.has(record.id)) return "dashboard filter";
  if (!isOperating(record)) return "non-operating";
  if (context.reviewExcludedIds.has(record.id)) return "review exclusion";
  if (context.baseIds.has(record.id)) return "review preset";
  return "excluded from KPI";
}

function mapReviewItemsByRecordId(
  items: readonly ReviewDrawerItem[]
): Map<string, ReviewDrawerItem> {
  const map = new Map<string, ReviewDrawerItem>();
  for (const item of items) {
    for (const rowId of item.rowIds) {
      map.set(rowId, item);
    }
  }
  return map;
}

function buildRejectedRows(rejectedRows: readonly ImportIssue[]): WorkbookCellValue[][] {
  const dynamicColumns = [
    ...new Set(rejectedRows.flatMap((issue) => Object.keys(issue.row)))
  ].sort((left, right) => left.localeCompare(right));
  const header = ["Row Number", "Reason", ...dynamicColumns];
  const rows = rejectedRows.map((issue) => [
    issue.rowNumber,
    issue.reason,
    ...dynamicColumns.map((column) => issue.row[column] ?? "")
  ]);
  return [header, ...rows];
}

function buildDiagnosticsRows(input: AccountantWorkbookInput): WorkbookCellValue[][] {
  const rows: WorkbookCellValue[][] = [];
  const records = input.view.filteredRecords;

  appendSection(rows, "Net Cash Contributors", ["Direction", "Label", "Flow", "Amount"], () => {
    const contributors = topNetCashContributors(records);
    return [
      ...contributors.positives.map((item) => ["positive", item.label, item.flow, item.amount]),
      ...contributors.negatives.map((item) => ["negative", item.label, item.flow, item.amount])
    ];
  });

  appendSection(rows, "Burn Contributors", ["Group Type", "Label", "Amount", "Share"], () => {
    const burn = topBurnContributors(records);
    return [
      ...burn.heads.map((item) => ["head", item.label, item.amount, item.share]),
      ...burn.subcategories.map((item) => ["subcategory", item.label, item.amount, item.share])
    ];
  });

  appendSection(rows, "Revenue Concentration", ["Group Type", "Label", "Amount", "Share"], () => {
    const concentration = revenueConcentration(records);
    return [
      ...concentration.heads.map((item) => ["head", item.label, item.amount, item.share]),
      ...concentration.counterparties.map((item) => [
        "counterparty",
        item.label,
        item.amount,
        item.share
      ])
    ];
  });

  const largest = largestTransactionInfluence(records);
  if (largest) {
    appendSection(rows, "Largest Transaction", ["Field", "Value"], () => [
      ["Id", largest.id],
      ["Label", largest.label],
      ["Date", largest.dateISO],
      ["Head", largest.head],
      ["Counterparty", largest.counterparty],
      ["Flow", largest.flow],
      ["Amount", largest.amount],
      ["Signed Impact", largest.signedImpact],
      ["Share Of Activity", largest.shareOfActivity],
      ["Net Cash", largest.netCash]
    ]);
  }

  const filterImpact = filterExclusionImpact(input.view.reviewSummary, input.view.summary);
  if (filterImpact) {
    appendSection(rows, "Filter Exclusion Impact", ["Metric", "Before", "After", "Delta"], () =>
      filterImpact.deltas.map((delta) => [delta.metric, delta.before, delta.after, delta.delta])
    );
    rows.push(["Hidden Records", filterImpact.hiddenRecords]);
  }

  return rows.length > 0 ? rows : [["Diagnostics", "No diagnostics available"]];
}

function appendSection(
  target: WorkbookCellValue[][],
  title: string,
  header: WorkbookCellValue[],
  dataRows: () => WorkbookCellValue[][]
): void {
  if (target.length > 0) target.push([""]);
  target.push([title]);
  target.push(header);
  target.push(...dataRows());
}