import {
  WORKSPACE_SNAPSHOT_VERSION,
  type ExclusionDecision,
  type WorkspaceSnapshot,
} from "./workspace-store";
import type { ClassificationOverride } from "../finance/classification-overrides";

export const BILLU_FILE_KIND = "billu-workspace";

export interface BilluProjectFile {
  kind: typeof BILLU_FILE_KIND;
  snapshot: WorkspaceSnapshot;
}

export type ParseProjectFileResult =
  | { ok: true; snapshot: WorkspaceSnapshot }
  | { ok: false; error: string };

function cloneSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  return {
    version: snapshot.version,
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
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClassificationOverride(value: unknown): value is ClassificationOverride {
  if (!isPlainObject(value)) {
    return false;
  }

  if ("flow" in value && value.flow !== undefined && typeof value.flow !== "string") {
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

function parseSnapshot(value: unknown): WorkspaceSnapshot | string {
  if (!isPlainObject(value)) {
    return "snapshot must be an object";
  }

  if (typeof value.version !== "number") {
    return "snapshot.version must be a number";
  }

  if (value.version !== WORKSPACE_SNAPSHOT_VERSION) {
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

  return {
    version: value.version,
    categoryOverrides,
    decisions,
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