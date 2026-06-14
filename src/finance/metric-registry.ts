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
  }
];

export function getMetricContract(id: string): MetricContract | undefined {
  return metricContracts.find((contract) => contract.id === id);
}

export function getMetricsByRole(role: MetricRole): MetricContract[] {
  return metricContracts.filter((contract) => contract.role === role);
}
