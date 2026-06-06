import { describe, it, expect } from "vitest";
import {
  BILLU_FILE_KIND,
  parseProjectFile,
  serializeProjectFile,
} from "./project-file";
import {
  WORKSPACE_SNAPSHOT_VERSION,
  createInMemoryWorkspaceStore,
  type WorkspaceSnapshot,
} from "./workspace-store";

const SIG_A = "txn_aaaaaaaaaaaaaaaa";
const SIG_B = "txn_bbbbbbbbbbbbbbbb";

const sampleSnapshot: WorkspaceSnapshot = {
  version: WORKSPACE_SNAPSHOT_VERSION,
  categoryOverrides: {
    [SIG_A]: { parent: "Financing", flow: "revenue" },
  },
  decisions: {
    [SIG_B]: { excluded: true },
  },
};

describe("project-file", () => {
  it("round-trips a snapshot with overrides and decisions", () => {
    const text = serializeProjectFile(sampleSnapshot);
    const parsed = parseProjectFile(text);

    expect(parsed).toEqual({ ok: true, snapshot: sampleSnapshot });
  });

  it("round-trips through in-memory stores via serialize and parse", () => {
    const store = createInMemoryWorkspaceStore();
    store.setCategoryOverride(SIG_A, { parent: "Financing", flow: "revenue" });
    store.setDecision(SIG_B, { excluded: true });

    const originalSnapshot = store.snapshot();
    const parsed = parseProjectFile(serializeProjectFile(originalSnapshot));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const store2 = createInMemoryWorkspaceStore();
    store2.load(parsed.snapshot);

    expect(store2.snapshot()).toEqual(originalSnapshot);
  });

  it("returns deep-copied snapshots that are isolated from later mutation", () => {
    const text = serializeProjectFile(sampleSnapshot);

    const first = parseProjectFile(text);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    first.snapshot.categoryOverrides[SIG_A] = { parent: "Mutated" };
    first.snapshot.decisions[SIG_B] = { excluded: false };

    const second = parseProjectFile(text);
    expect(second).toEqual({ ok: true, snapshot: sampleSnapshot });
  });

  it("rejects corrupt JSON without throwing", () => {
    expect(() => parseProjectFile("{ not json")).not.toThrow();

    const result = parseProjectFile("{ not json");
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.toLowerCase()).toMatch(/json|parse/);
  });

  it("rejects missing or wrong kind without throwing", () => {
    const missingKind = JSON.stringify({ snapshot: sampleSnapshot });
    expect(() => parseProjectFile(missingKind)).not.toThrow();
    expect(parseProjectFile(missingKind)).toEqual({
      ok: false,
      error: "unsupported project file kind: undefined",
    });

    const wrongKind = JSON.stringify({ kind: "other", snapshot: sampleSnapshot });
    expect(() => parseProjectFile(wrongKind)).not.toThrow();
    expect(parseProjectFile(wrongKind)).toEqual({
      ok: false,
      error: "unsupported project file kind: other",
    });
  });

  it("rejects version mismatches without throwing", () => {
    const text = serializeProjectFile(sampleSnapshot);
    const edited = text.replace(
      `"version": ${WORKSPACE_SNAPSHOT_VERSION}`,
      '"version": 999',
    );

    expect(() => parseProjectFile(edited)).not.toThrow();
    expect(parseProjectFile(edited)).toEqual({
      ok: false,
      error: "unsupported snapshot version: 999",
    });
  });

  it("rejects malformed snapshot shapes without throwing", () => {
    const arrayOverrides = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: WORKSPACE_SNAPSHOT_VERSION,
        categoryOverrides: [],
        decisions: {},
      },
    });
    expect(() => parseProjectFile(arrayOverrides)).not.toThrow();
    expect(parseProjectFile(arrayOverrides)).toEqual({
      ok: false,
      error: "snapshot.categoryOverrides must be an object",
    });

    const missingDecisions = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: WORKSPACE_SNAPSHOT_VERSION,
        categoryOverrides: {},
      },
    });
    expect(() => parseProjectFile(missingDecisions)).not.toThrow();
    expect(parseProjectFile(missingDecisions)).toEqual({
      ok: false,
      error: "snapshot.decisions must be an object",
    });

    const badDecision = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: WORKSPACE_SNAPSHOT_VERSION,
        categoryOverrides: {},
        decisions: {
          [SIG_B]: { excluded: "yes" },
        },
      },
    });
    expect(() => parseProjectFile(badDecision)).not.toThrow();
    expect(parseProjectFile(badDecision)).toEqual({
      ok: false,
      error: `snapshot.decisions["${SIG_B}"].excluded must be a boolean`,
    });
  });
});