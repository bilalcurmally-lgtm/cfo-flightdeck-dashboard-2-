import type { ClassificationOverride } from "../finance/classification-overrides";
import type { ImportSnapshot } from "./import-history";

export interface ExclusionDecision {
  excluded: boolean;
}

export const WORKSPACE_SNAPSHOT_VERSION = 2;

export interface WorkspaceSnapshot {
  version: number;
  categoryOverrides: Record<string, ClassificationOverride>;
  decisions: Record<string, ExclusionDecision>;
  imports: ImportSnapshot[];
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
}

// Shallow-copies each override/decision value; assumes flat ClassificationOverride / ExclusionDecision shapes — revisit if nested fields are added.
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
  };
}

function emptySnapshot(): WorkspaceSnapshot {
  return {
    version: WORKSPACE_SNAPSHOT_VERSION,
    categoryOverrides: {},
    decisions: {},
    imports: [],
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
  };
}