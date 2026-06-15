import {
  WORKSPACE_SNAPSHOT_VERSION,
  type ExclusionDecision,
  type WorkspaceSnapshot,
} from "./workspace-store";
import type { ImportSnapshot } from "./import-history";
import { validateBudgetEntry, type BudgetEntry } from "../finance/budget";
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ClassificationRule } from "../finance/classification-rules";
import { validateExpectedIncomeEvent, type ExpectedIncomeEvent } from "../finance/expected-income";

const SUPPORTED_VERSIONS = [1, 2, 3, 4];
const CLASSIFICATION_RULE_FIELDS = new Set([
  "account",
  "counterparty",
  "description",
  "head",
  "subcategory",
]);

export const BILLU_FILE_KIND = "billu-workspace";

export interface BilluProjectFile {
  kind: typeof BILLU_FILE_KIND;
  snapshot: WorkspaceSnapshot;
}

export type ParseProjectFileResult =
  | { ok: true; snapshot: WorkspaceSnapshot }
  | { ok: false; error: string };

// Shallow-copies each value; assumes flat ClassificationOverride / ExclusionDecision / ClassificationRule shapes — revisit if nested fields are added.
function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides: Object.fromEntries(
      Object.entries(snapshot.categoryOverrides).map(([signature, override]) => [
        signature,
        { ...override },
      ]),
    ),
    decisions: Object.fromEntries(
      Object.entries(snapshot.decisions).map(([signature, decision]) => [
        signature,
        { ...decision },
      ]),
    ),
    imports: (snapshot.imports ?? []).map((imp) => ({
      ...imp,
      signatureSet: [...imp.signatureSet],
      kpiSnapshot: { ...imp.kpiSnapshot },
      reviewItemSignatures: [...imp.reviewItemSignatures],
    })),
    rules: (snapshot.rules ?? []).map((rule) => ({
      ...rule,
      override: { ...rule.override },
    })),
    budgets: (snapshot.budgets ?? []).map((entry) => ({ ...entry })),
    expectedIncomeEvents: (snapshot.expectedIncomeEvents ?? []).map((event) => ({ ...event })),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClassificationOverride(value: unknown): value is ClassificationOverride {
  if (!isPlainObject(value)) {
    return false;
  }

  if (
    "flow" in value &&
    value.flow !== undefined &&
    value.flow !== "revenue" &&
    value.flow !== "outflow"
  ) {
    return false;
  }

  if ("parent" in value && value.parent !== undefined && typeof value.parent !== "string") {
    return false;
  }

  return true;
}

function isExclusionDecision(value: unknown): value is ExclusionDecision {
  return isPlainObject(value) && typeof value.excluded === "boolean";
}

function isImportSnapshot(value: unknown): value is ImportSnapshot {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.importedAt === "string" &&
    typeof value.sourceName === "string" &&
    Array.isArray(value.signatureSet) &&
    value.signatureSet.every((s) => typeof s === "string") &&
    isPlainObject(value.kpiSnapshot) &&
    Array.isArray(value.reviewItemSignatures) &&
    value.reviewItemSignatures.every((s) => typeof s === "string")
  );
}

function isBudgetEntry(value: unknown): value is BudgetEntry {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.month !== "string") return false;
  if (value.scope !== "head" && value.scope !== "subcategory") return false;
  if (typeof value.key !== "string") return false;
  if (value.flow !== "revenue" && value.flow !== "outflow") return false;
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount)) return false;
  if ("note" in value && value.note !== undefined && typeof value.note !== "string") return false;
  return validateBudgetEntry({
    id: value.id,
    month: value.month,
    scope: value.scope,
    key: value.key,
    flow: value.flow,
    amount: value.amount,
    note: typeof value.note === "string" ? value.note : undefined
  }).length === 0;
}

function isExpectedIncomeEvent(value: unknown): value is ExpectedIncomeEvent {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.dueDate !== "string") return false;
  if (typeof value.amount !== "number" || !Number.isFinite(value.amount)) return false;
  if (typeof value.label !== "string") return false;
  return (
    value.status === "expected" ||
    value.status === "tentative" ||
    value.status === "received"
  ) && validateExpectedIncomeEvent({
    id: value.id,
    dueDate: value.dueDate,
    amount: value.amount,
    label: value.label,
    status: value.status
  }).length === 0;
}

function isClassificationRule(value: unknown): value is ClassificationRule {
  if (!isPlainObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.field !== "string" || !CLASSIFICATION_RULE_FIELDS.has(value.field)) {
    return false;
  }
  if (typeof value.contains !== "string") return false;
  if (typeof value.enabled !== "boolean") return false;
  if ("label" in value && value.label !== undefined && typeof value.label !== "string") {
    return false;
  }
  return isClassificationOverride(value.override);
}

function parseSnapshot(value: unknown): WorkspaceSnapshot | string {
  if (!isPlainObject(value)) return "snapshot must be an object";
  if (typeof value.version !== "number") return "snapshot.version must be a number";
  if (!SUPPORTED_VERSIONS.includes(value.version)) {
    return `unsupported snapshot version: ${value.version}`;
  }
  if (!("categoryOverrides" in value) || !isPlainObject(value.categoryOverrides)) {
    return "snapshot.categoryOverrides must be an object";
  }
  if (!("decisions" in value) || !isPlainObject(value.decisions)) {
    return "snapshot.decisions must be an object";
  }

  const categoryOverrides: Record<string, ClassificationOverride> = {};
  for (const [signature, override] of Object.entries(value.categoryOverrides)) {
    if (!isClassificationOverride(override)) {
      return `snapshot.categoryOverrides["${signature}"] has an invalid shape`;
    }
    categoryOverrides[signature] = override;
  }

  const decisions: Record<string, ExclusionDecision> = {};
  for (const [signature, decision] of Object.entries(value.decisions)) {
    if (!isExclusionDecision(decision)) {
      return `snapshot.decisions["${signature}"].excluded must be a boolean`;
    }
    decisions[signature] = decision;
  }

  let imports: ImportSnapshot[] = [];
  if ("imports" in value && value.imports !== undefined) {
    if (!Array.isArray(value.imports) || !value.imports.every(isImportSnapshot)) {
      return "snapshot.imports must be an array of import records";
    }
    imports = value.imports as ImportSnapshot[];
  }

  let rules: ClassificationRule[] = [];
  if ("rules" in value && value.rules !== undefined) {
    if (!Array.isArray(value.rules) || !value.rules.every(isClassificationRule)) {
      return "snapshot.rules must be an array of classification rules";
    }
    rules = value.rules as ClassificationRule[];
  }

  let budgets: BudgetEntry[] = [];
  if ("budgets" in value && value.budgets !== undefined) {
    if (!Array.isArray(value.budgets) || !value.budgets.every(isBudgetEntry)) {
      return "snapshot.budgets must be an array of budget entries";
    }
    budgets = value.budgets as BudgetEntry[];
  }

  let expectedIncomeEvents: ExpectedIncomeEvent[] = [];
  if ("expectedIncomeEvents" in value && value.expectedIncomeEvents !== undefined) {
    if (
      !Array.isArray(value.expectedIncomeEvents) ||
      !value.expectedIncomeEvents.every(isExpectedIncomeEvent)
    ) {
      return "snapshot.expectedIncomeEvents must be an array of expected income events";
    }
    expectedIncomeEvents = value.expectedIncomeEvents as ExpectedIncomeEvent[];
  }

  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides,
    decisions,
    imports,
    rules,
    budgets,
    expectedIncomeEvents
  };
}

export function serializeProjectFile(snapshot: WorkspaceSnapshot): string {
  const file: BilluProjectFile = {
    kind: BILLU_FILE_KIND,
    snapshot: cloneSnapshot(snapshot),
  };

  return JSON.stringify(file, null, 2);
}

export function parseProjectFile(text: string): ParseProjectFileResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid JSON: could not parse project file" };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: "project file must be a JSON object" };
  }

  if (parsed.kind !== BILLU_FILE_KIND) {
    return { ok: false, error: `unsupported project file kind: ${String(parsed.kind)}` };
  }

  if (!("snapshot" in parsed)) {
    return { ok: false, error: "project file is missing snapshot" };
  }

  const snapshotResult = parseSnapshot(parsed.snapshot);
  if (typeof snapshotResult === "string") {
    return { ok: false, error: snapshotResult };
  }

  return { ok: true, snapshot: cloneSnapshot(snapshotResult) };
}
