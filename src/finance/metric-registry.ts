import type { MetricContract, MetricRole } from "./metric-contract";

/**
 * Source-of-truth definitions for the cockpit's finance metrics. Ids align with
 * the live `CockpitViewModel` / cash-health fields so contracts can later be
 * joined to rendered values. This is the "what does this number mean" layer that
 * complements the existing lineage ("how was it computed").
 */
export const metricContracts: readonly MetricContract[] = [
  {
    id: "netCash",
    label: "Net Cash",
    role: "primary",
    decisionQuestion: "Did the business end the period with more or less cash?",
    formula: "revenue - outflow",
    format: "currency",
    requiredInputs: ["revenue", "outflow"],
    caveats: [
      "Excludes transactions flagged as non-operating or internal transfers.",
      "Unresolved review items can shift this number once classified."
    ],
    readiness: "Needs a classified ledger with transfers and non-operating rows resolved."
  },
  {
    id: "runwayMonths",
    label: "Runway",
    role: "primary",
    decisionQuestion: "How many months can we operate before cash runs out?",
    formula: "cashOnHand / averageMonthlyOutflow",
    format: "months",
    requiredInputs: ["cashOnHand", "averageMonthlyOutflow"],
    caveats: [
      "Assumes future burn matches the recent average monthly outflow.",
      "Undefined when cash on hand is unknown or burn is zero."
    ],
    readiness: "Requires a cash-on-hand assumption and at least one month of outflow history."
  },
  {
    id: "revenue",
    label: "Revenue",
    role: "driver",
    decisionQuestion: "How much money came in this period?",
    formula: "sum(amount where flow = revenue)",
    format: "currency",
    requiredInputs: ["normalizedLedger"],
    caveats: ["Excludes inflows reclassified as transfers or non-operating."],
    readiness: "Needs inflow rows classified by flow and head."
  },
  {
    id: "outflow",
    label: "Outflow",
    role: "driver",
    decisionQuestion: "How much money went out this period?",
    formula: "sum(amount where flow = outflow)",
    format: "currency",
    requiredInputs: ["normalizedLedger"],
    caveats: ["Excludes outflows reclassified as transfers or non-operating."],
    readiness: "Needs outflow rows classified by flow and head."
  },
  {
    id: "averageMonthlyOutflow",
    label: "Average Monthly Burn",
    role: "driver",
    decisionQuestion: "What is our typical monthly cash burn?",
    formula: "totalOutflow / monthsObserved",
    format: "currency",
    requiredInputs: ["outflow", "monthsObserved"],
    caveats: [
      "A short or partial history can over- or under-state the average.",
      "One-off large outflows skew the average without a longer window."
    ],
    readiness: "More reliable with several full months of history."
  },
  {
    id: "revenueConcentration",
    label: "Revenue Concentration",
    role: "guardrail",
    decisionQuestion: "How dependent are we on a single revenue source?",
    formula: "topCounterpartyRevenue / revenue",
    format: "ratio",
    requiredInputs: ["revenue", "counterparty"],
    caveats: ["Only meaningful once counterparties are assigned to inflows."],
    readiness: "Needs inflows attributed to counterparties."
  },
  {
    id: "rejectedRows",
    label: "Rejected Rows",
    role: "guardrail",
    decisionQuestion: "How much of the import failed to parse and was dropped?",
    formula: "count(rejected import rows)",
    format: "count",
    requiredInputs: ["importQuality"],
    caveats: ["Rejected rows are absent from every KPI until fixed and re-imported."],
    readiness: "Available immediately after import."
  },
  {
    id: "duplicates",
    label: "Duplicates",
    role: "guardrail",
    decisionQuestion: "Are repeated transactions inflating the totals?",
    formula: "count(duplicate groups)",
    format: "count",
    requiredInputs: ["diagnostics"],
    caveats: ["Duplicate detection is heuristic and may flag legitimate repeats."],
    readiness: "Available once the ledger is normalized."
  },
  {
    id: "transfers",
    label: "Transfers",
    role: "guardrail",
    decisionQuestion: "Are internal movements being counted as real cash flow?",
    formula: "count(transfer candidates)",
    format: "count",
    requiredInputs: ["diagnostics"],
    caveats: ["Transfer candidates are suggestions until confirmed in review."],
    readiness: "Available once the ledger is normalized."
  },
  {
    id: "topHeads",
    label: "Top Heads",
    role: "detail",
    decisionQuestion: "Which heads drive the most cash activity in the visible scope?",
    formula: "rank heads by sum(amount) within filtered KPI records",
    format: "count",
    requiredInputs: ["filteredRecords", "head"],
    caveats: [
      "Rankings follow the active filter and review preset.",
      "Non-operating and excluded rows are omitted from the visible scope."
    ],
    readiness: "Needs classified heads on normalized ledger rows."
  },
  {
    id: "topSubcategories",
    label: "Top Subcategories",
    role: "detail",
    decisionQuestion: "Which subcategories concentrate spend or revenue?",
    formula: "rank head/subcategory pairs by sum(amount) within filtered KPI records",
    format: "count",
    requiredInputs: ["filteredRecords", "head", "subcategory"],
    caveats: [
      "Subcategory labels depend on import mapping quality.",
      "Rankings change when filters or review exclusions change."
    ],
    readiness: "Needs subcategories assigned on normalized ledger rows."
  },
  {
    id: "transactionPreview",
    label: "Transaction Preview",
    role: "detail",
    decisionQuestion: "What does the currently selected ledger row look like?",
    formula: "selected visible transaction record",
    format: "count",
    requiredInputs: ["filteredRecords", "selectedTransactionId"],
    caveats: ["Preview reflects post-override classifications in the current session."],
    readiness: "Select a visible transaction to inspect a single row."
  },
  {
    id: "rawRow",
    label: "Raw Row",
    role: "detail",
    decisionQuestion: "What did the importer see before normalization?",
    formula: "source raw import row mapped to the selected transaction",
    format: "count",
    requiredInputs: ["rawImport", "selectedTransactionId"],
    caveats: [
      "Raw values may differ from normalized amounts after parsing and classification.",
      "Unavailable when the source row cannot be matched."
    ],
    readiness: "Select a transaction with a traceable raw import row."
  },
  {
    id: "importQuality",
    label: "Import Quality",
    role: "detail",
    decisionQuestion: "How clean and complete was the import parse?",
    formula: "acceptedRows / (acceptedRows + rejectedRows); quality warnings",
    format: "ratio",
    requiredInputs: ["rawImport", "importQuality", "warnings"],
    caveats: [
      "Rejected rows never enter KPI totals until fixed and re-imported.",
      "Warnings are heuristic and may include informational notices."
    ],
    readiness: "Available immediately after import."
  },
  {
    id: "accountBalances",
    label: "Account Balances",
    role: "detail",
    decisionQuestion: "How is cash distributed across accounts in the visible scope?",
    formula: "per-account balance from running balance or net activity",
    format: "count",
    requiredInputs: ["filteredRecords", "account"],
    caveats: [
      "Balances may be inferred from net activity when running balances are absent.",
      "Account totals follow the same visible KPI scope as the cockpit."
    ],
    readiness: "Needs account labels on normalized ledger rows."
  }
];

export function getMetricContract(id: string): MetricContract | undefined {
  return metricContracts.find((contract) => contract.id === id);
}

export function getMetricsByRole(role: MetricRole): MetricContract[] {
  return metricContracts.filter((contract) => contract.role === role);
}

/** Cockpit KPI cards and scalar exports — excludes non-scalar detail/reporting contracts. */
export function getScalarMetricContracts(): MetricContract[] {
  return metricContracts.filter((contract) => contract.role !== "detail");
}

export function getDetailMetricContracts(): MetricContract[] {
  return getMetricsByRole("detail");
}
