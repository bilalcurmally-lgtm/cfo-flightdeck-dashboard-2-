import { describe, expect, it } from "vitest";
import { rec } from "../finance/classification-overrides.test";
import { buildDashboardView } from "../finance/dashboard-view";
import { DEFAULT_FILTERS } from "../finance/filters";
import { assessReadiness, buildReadinessInput } from "../finance/readiness";
import type { CsvImportResult, ImportIssue, TransactionRecord } from "../finance/types";
import {
  buildDashboardManifest,
  dashboardManifestFilename,
  type DashboardManifestInput
} from "./dashboard-manifest";
import { metricContracts } from "../finance/metric-registry";

describe("buildDashboardManifest", () => {
  it("builds the top-level manifest shape", () => {
    const manifest = buildDashboardManifest(fixture());

    expect(manifest.version).toBe(1);
    expect(manifest.generatedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(manifest.source).toMatchObject({
      name: "sample.csv",
      rawRows: 1,
      acceptedRows: 1,
      rejectedRows: 0
    });
    expect(manifest.context).toMatchObject({
      currency: "USD",
      cashOnHand: 5000,
      trendGrain: "monthly",
      reviewPreset: "all",
      hasImportHistory: false,
      visibleKpiRowCount: 1
    });
    expect(manifest.readiness.status).toBeTruthy();
    expect(manifest.kpis).toHaveLength(metricContracts.length);
    expect(manifest.charts).toHaveLength(5);
    expect(manifest.tables).toHaveLength(4);
    expect(manifest.diagnostics).toHaveLength(5);
    expect(manifest.sources.length).toBeGreaterThanOrEqual(5);
    expect(manifest.caveats[0]).toContain("Generated locally");
  });

  it("maps KPI contract values from the visible cockpit scope", () => {
    const manifest = buildDashboardManifest(fixture());

    expect(manifest.kpis.find((kpi) => kpi.id === "netCash")).toMatchObject({
      label: "Net Cash",
      role: "primary",
      format: "currency",
      value: 100,
      decisionQuestion: expect.any(String),
      formula: "revenue - outflow"
    });
    expect(manifest.kpis.find((kpi) => kpi.id === "rejectedRows")?.value).toBe(0);
  });

  it("keeps readiness parity with buildReadinessInput", () => {
    const input = fixture({ hasImportHistory: true });
    const expected = assessReadiness(
      buildReadinessInput({
        view: input.view,
        rejectedRowCount: input.result.rejectedRows.length,
        cashOnHand: input.cashOnHand,
        hasImportHistory: true
      })
    );
    const manifest = buildDashboardManifest(input);

    expect(manifest.readiness).toEqual({
      status: expected.status,
      headline: expected.headline,
      signals: expected.signals.map((signal) => ({
        id: signal.id,
        severity: signal.severity,
        label: signal.label,
        detail: signal.detail
      }))
    });
  });

  it("includes chart specs with required fields", () => {
    const manifest = buildDashboardManifest(fixture());
    const chartIds = manifest.charts.map((chart) => chart.id);

    expect(chartIds).toEqual([
      "cashTrend",
      "forecast13Week",
      "topHeads",
      "topSubcategories",
      "accountBalances"
    ]);

    for (const chart of manifest.charts) {
      expect(chart.title).toBeTruthy();
      expect(chart.analyticalQuestion).toBeTruthy();
      expect(chart.chartType).toBeTruthy();
      expect(chart.datasetId).toBeTruthy();
      expect(chart.encoding).toBeTruthy();
      expect(chart.unit).toBe("USD");
      expect(chart.emptyState).toBeTruthy();
      expect(chart.caveats.length).toBeGreaterThan(0);
      expect(chart.rowCount).toBeGreaterThanOrEqual(0);
    }
  });

  it("summarizes diagnostics without dumping full ledger rows", () => {
    const records = [
      rec({ id: "client", flow: "revenue", head: "Client", amount: 2500, signedNet: 2500 }),
      rec({ id: "rent", flow: "outflow", head: "Rent", amount: 500, signedNet: -500 })
    ];
    const manifest = buildDashboardManifest(
      fixture({
        result: importResult(records)
      })
    );

    expect(manifest.diagnostics.find((item) => item.id === "netCashContributors")).toMatchObject({
      available: true,
      topItems: expect.any(Array)
    });
    expect(JSON.stringify(manifest)).not.toContain('"dateISO":"2026-05-04"');
  });

  it("reflects rejected row counts in source and table specs", () => {
    const manifest = buildDashboardManifest(
      fixture({
        result: importResult([record()], [
          {
            rowNumber: 4,
            reason: "Missing amount",
            row: { Date: "2026-05-05", Amount: "", Head: "Client" }
          }
        ])
      })
    );

    expect(manifest.source.rejectedRows).toBe(1);
    expect(manifest.tables.find((table) => table.id === "rejectedRows")).toMatchObject({
      rowCount: 1
    });
    expect(manifest.sources.find((source) => source.id === "rejectedRows")).toMatchObject({
      rowCount: 1
    });
  });
});

describe("dashboardManifestFilename", () => {
  it("creates a stable dashboard manifest filename", () => {
    expect(
      dashboardManifestFilename("Sample Finance.csv", new Date("2026-06-15T00:00:00Z"))
    ).toBe("sample-finance-dashboard-manifest-2026-06-15.json");
  });
});

function fixture(overrides: Partial<DashboardManifestInput> = {}): DashboardManifestInput {
  const result = overrides.result ?? importResult([record()]);
  const view =
    overrides.view ??
    buildDashboardView({
      result,
      filters: DEFAULT_FILTERS,
      trendGrain: "monthly",
      reviewPreset: overrides.reviewPreset ?? "all",
      selectedTransactionId: "",
      cashOnHand: overrides.cashOnHand ?? 5000,
      futureEventsText: ""
    });
  const cashOnHand = overrides.cashOnHand ?? 5000;

  return {
    sourceName: "sample.csv",
    generatedAt: new Date("2026-06-15T12:00:00.000Z"),
    currency: "USD",
    cashOnHand,
    trendGrain: "monthly",
    reviewPreset: "all",
    filters: DEFAULT_FILTERS,
    result,
    view,
    readiness: assessReadiness(
      buildReadinessInput({
        view,
        rejectedRowCount: result.rejectedRows.length,
        cashOnHand,
        hasImportHistory: overrides.hasImportHistory ?? false
      })
    ),
    hasImportHistory: overrides.hasImportHistory ?? false,
    ...overrides
  };
}

function importResult(
  records: TransactionRecord[],
  rejectedRows: ImportIssue[] = []
): CsvImportResult {
  return {
    rawRows: records.map((entry) => ({ Date: entry.dateISO, Amount: String(entry.amount) })),
    records,
    rejectedRows,
    mapping: { date: "Date", amount: "Amount", head: "Head" },
    dateFormat: "ymd"
  };
}

function record(): TransactionRecord {
  return rec({
    id: "txn-1",
    flow: "revenue",
    head: "Client",
    amount: 100,
    signedNet: 100
  });
}