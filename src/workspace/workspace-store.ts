import type { BudgetEntry } from "../finance/budget";
import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ClassificationRule } from "../finance/classification-rules";
import type { ExpectedIncomeEvent } from "../finance/expected-income";
import { recordImport, type ImportSnapshot } from "./import-history";

export interface ExclusionDecision {
  excluded: boolean;
}

export const WORKSPACE_SNAPSHOT_VERSION = 4;

export interface WorkspaceSnapshot {
  version: number;
  categoryOverrides: Record<string, ClassificationOverride>;
  decisions: Record<string, ExclusionDecision>;
  imports: ImportSnapshot[];
  rules: ClassificationRule[];
  budgets: BudgetEntry[];
  expectedIncomeEvents: ExpectedIncomeEvent[];
}

export interface WorkspaceStore {
  getCategoryOverride(signature: string): ClassificationOverride | undefined;
  setCategoryOverride(signature: string, override: ClassificationOverride): void;
  clearCategoryOverride(signature: string): void;
  getDecision(signature: string): ExclusionDecision | undefined;
  setDecision(signature: string, decision: ExclusionDecision): void;
  clearDecision(signature: string): void;
  snapshot(): WorkspaceSnapshot;
  load(snapshot: WorkspaceSnapshot): void;
  addImport(snapshot: ImportSnapshot, options?: { cap?: number }): void;
  getRules(): ClassificationRule[];
  setRules(rules: readonly ClassificationRule[]): void;
  getBudgets(): BudgetEntry[];
  setBudgets(budgets: readonly BudgetEntry[]): void;
  getExpectedIncomeEvents(): ExpectedIncomeEvent[];
  setExpectedIncomeEvents(events: readonly ExpectedIncomeEvent[]): void;
}

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

function emptySnapshot(): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides: {},
    decisions: {},
    imports: [],
    rules: [],
    budgets: [],
    expectedIncomeEvents: [],
  };
}

export function createInMemoryWorkspaceStore(initial?: WorkspaceSnapshot): WorkspaceStore {
  let state = initial ? cloneSnapshot(initial) : emptySnapshot();

  return {
    getCategoryOverride(signature) {
      const override = state.categoryOverrides[signature];
      return override ? { ...override } : undefined;
    },

    setCategoryOverride(signature, override) {
      state.categoryOverrides[signature] = { ...override };
    },

    clearCategoryOverride(signature) {
      delete state.categoryOverrides[signature];
    },

    getDecision(signature) {
      const decision = state.decisions[signature];
      return decision ? { ...decision } : undefined;
    },

    setDecision(signature, decision) {
      state.decisions[signature] = { ...decision };
    },

    clearDecision(signature) {
      delete state.decisions[signature];
    },

    snapshot() {
      return cloneSnapshot(state);
    },

    load(snapshot) {
      state = cloneSnapshot(snapshot);
    },

    addImport(snapshot, options) {
      state.imports = recordImport(state.imports, snapshot, options);
    },

    getRules() {
      return state.rules.map((rule) => ({ ...rule, override: { ...rule.override } }));
    },

    setRules(rules) {
      state.rules = rules.map((rule) => ({ ...rule, override: { ...rule.override } }));
    },

    getBudgets() {
      return state.budgets.map((entry) => ({ ...entry }));
    },

    setBudgets(budgets) {
      state.budgets = budgets.map((entry) => ({ ...entry }));
    },

    getExpectedIncomeEvents() {
      return state.expectedIncomeEvents.map((event) => ({ ...event }));
    },

    setExpectedIncomeEvents(events) {
      state.expectedIncomeEvents = events.map((event) => ({ ...event }));
    },
  };
}
