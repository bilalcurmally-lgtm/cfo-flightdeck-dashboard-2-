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
  imports: [],
  rules: [],
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
    store.setRules([
      {
        id: "stripe-revenue",
        field: "counterparty",
        contains: "stripe",
        override: { flow: "revenue", parent: "Sales" },
        enabled: true,
      },
    ]);

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

  it("drops unknown top-level snapshot keys on parse", () => {
    const withExtraField = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: WORKSPACE_SNAPSHOT_VERSION,
        categoryOverrides: { [SIG_A]: { parent: "Financing" } },
        decisions: { [SIG_B]: { excluded: true } },
        futureField: 1,
      },
    });

    expect(() => parseProjectFile(withExtraField)).not.toThrow();

    const result = parseProjectFile(withExtraField);
    expect(result).toEqual({
      ok: true,
      snapshot: {
        version: WORKSPACE_SNAPSHOT_VERSION,
        categoryOverrides: { [SIG_A]: { parent: "Financing" } },
        decisions: { [SIG_B]: { excluded: true } },
        imports: [],
        rules: [],
      },
    });
    if (result.ok) {
      expect(result.snapshot).not.toHaveProperty("futureField");
    }
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

describe("project-file v1->v2 migration", () => {
  it("migrates a v1 snapshot file to v2 with empty imports", () => {
    const v1 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 1, categoryOverrides: { sig: { parent: "Food" } }, decisions: {} },
    });
    const result = parseProjectFile(v1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.version).toBe(WORKSPACE_SNAPSHOT_VERSION);
      expect(result.snapshot.imports).toEqual([]);
      expect(result.snapshot.rules).toEqual([]);
      expect(result.snapshot.categoryOverrides.sig).toEqual({ parent: "Food" });
    }
  });

  it("rejects a newer (unknown) version loudly", () => {
    const v3 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 999, categoryOverrides: {}, decisions: {}, imports: [], rules: [] },
    });
    expect(parseProjectFile(v3).ok).toBe(false);
  });

  it("rejects a malformed imports array", () => {
    const bad = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: { version: 2, categoryOverrides: {}, decisions: {}, imports: "nope" },
    });
    expect(parseProjectFile(bad).ok).toBe(false);
  });

  it("round-trips a v2 file with an import", () => {
    const v2 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 2,
        categoryOverrides: {},
        decisions: {},
        imports: [{
          importedAt: "2026-01-01T00:00:00.000Z", sourceName: "x.csv",
          signatureSet: ["txn_a"], kpiSnapshot: { runwayMonths: 5 }, reviewItemSignatures: [],
        }],
      },
    });
    const result = parseProjectFile(v2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshot.imports).toHaveLength(1);
  });

  it("round-trips a v3 file with classification rules", () => {
    const v3 = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 3,
        categoryOverrides: {},
        decisions: {},
        imports: [],
        rules: [{
          id: "stripe-revenue",
          field: "counterparty",
          contains: "stripe",
          override: { flow: "revenue", parent: "Sales" },
          enabled: true,
          label: "Stripe revenue",
        }],
      },
    });

    const result = parseProjectFile(v3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.rules).toEqual([{
        id: "stripe-revenue",
        field: "counterparty",
        contains: "stripe",
        override: { flow: "revenue", parent: "Sales" },
        enabled: true,
        label: "Stripe revenue",
      }]);
    }
  });

  it("rejects malformed classification rules", () => {
    const bad = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 3,
        categoryOverrides: {},
        decisions: {},
        imports: [],
        rules: [{ id: "bad", field: "counterparty", contains: 123, override: {}, enabled: true }],
      },
    });

    expect(parseProjectFile(bad)).toEqual({
      ok: false,
      error: "snapshot.rules must be an array of classification rules",
    });
  });

  it("rejects classification rules with unsupported fields or flows", () => {
    const badField = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 3,
        categoryOverrides: {},
        decisions: {},
        imports: [],
        rules: [{
          id: "bad",
          field: "dateISO",
          contains: "2026",
          override: { parent: "Sales" },
          enabled: true,
        }],
      },
    });
    const badFlow = JSON.stringify({
      kind: BILLU_FILE_KIND,
      snapshot: {
        version: 3,
        categoryOverrides: {},
        decisions: {},
        imports: [],
        rules: [{
          id: "bad",
          field: "counterparty",
          contains: "stripe",
          override: { flow: "income" },
          enabled: true,
        }],
      },
    });

    expect(parseProjectFile(badField)).toEqual({
      ok: false,
      error: "snapshot.rules must be an array of classification rules",
    });
    expect(parseProjectFile(badFlow)).toEqual({
      ok: false,
      error: "snapshot.rules must be an array of classification rules",
    });
  });
});
