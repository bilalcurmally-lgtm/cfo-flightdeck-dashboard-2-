export type MetricRole = "primary" | "driver" | "guardrail" | "detail";

export type MetricFormat = "currency" | "months" | "count" | "ratio";

export const METRIC_ROLES: readonly MetricRole[] = [
  "primary",
  "driver",
  "guardrail",
  "detail"
];

export interface MetricContract {
  /** Stable id; aligns with cockpit/audit field names so it can be wired to live values. */
  id: string;
  label: string;
  role: MetricRole;
  /** The operator decision this metric is meant to answer. */
  decisionQuestion: string;
  /** Plain-language formula, not executable. */
  formula: string;
  format: MetricFormat;
  /** Inputs the metric depends on; ids of other metrics or ledger fields. */
  requiredInputs: readonly string[];
  /** Limitations a reader should keep in mind before trusting the number. */
  caveats: readonly string[];
  /** What the data must look like for this metric to be trustworthy. */
  readiness: string;
}

export function isMetricRole(value: string): value is MetricRole {
  return (METRIC_ROLES as readonly string[]).includes(value);
}

/**
 * Returns a list of human-readable problems with a contract. An empty list
 * means the contract is well-formed.
 */
export function validateMetricContract(contract: MetricContract): string[] {
  const problems: string[] = [];
  if (contract.label.trim() === "") problems.push("label is required");
  if (contract.decisionQuestion.trim() === "")
    problems.push("decisionQuestion is required");
  if (contract.formula.trim() === "") problems.push("formula is required");
  if (!isMetricRole(contract.role)) problems.push("role is invalid");
  if (contract.requiredInputs.length === 0)
    problems.push("requiredInputs must list at least one input");
  return problems;
}
