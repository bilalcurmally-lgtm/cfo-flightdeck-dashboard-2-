import { describe, expect, it } from "vitest";
import type { CsvImportResult } from "../finance/types";
import { createDashboardViewState, type DashboardViewState } from "../store/view-state";
import {
  bindTransactionPreviewActions,
  type TransactionPreviewActionRoot
} from "./transaction-preview-actions";

describe("bindTransactionPreviewActions", () => {
  it("selects a transaction, rerenders, and restores focus", () => {
    const buttons = [button("txn-1"), button("txn-2")];
    let viewState: DashboardViewState = createDashboardViewState();
    const rendered: string[] = [];

    bindTransactionPreviewActions({
      root: root(buttons),
      getActiveImport: () => ({ result: importResult(), sourceName: "sample.csv" }),
      getViewState: () => viewState,
      setViewState: (nextViewState) => {
        viewState = nextViewState;
      },
      renderActiveImport: (activeImport) => {
        rendered.push(activeImport.sourceName);
      }
    });

    buttons[1].fire("click");

    expect(viewState.selectedTransactionId).toBe("txn-2");
    expect(rendered).toEqual(["sample.csv"]);
    expect(buttons[1].focusCount).toBe(1);
  });

  it("ignores clicks when no import is active", () => {
    const buttons = [button("txn-1")];
    let viewState: DashboardViewState = createDashboardViewState();

    bindTransactionPreviewActions({
      root: root(buttons),
      getActiveImport: () => null,
      getViewState: () => viewState,
      setViewState: (nextViewState) => {
        viewState = nextViewState;
      },
      renderActiveImport: () => {
        throw new Error("render should not run without an active import");
      }
    });

    buttons[0].fire("click");
    expect(viewState.selectedTransactionId).toBe("");
  });
});

function root(buttons: FakeButton[]): TransactionPreviewActionRoot {
  return {
    querySelectorAll: (selector: string) => (selector === "[data-transaction-id]" ? buttons : []),
    querySelector: (selector: string) =>
      buttons.find((button) => selector === `[data-transaction-id="${button.dataset.transactionId}"]`) ?? null
  } as unknown as TransactionPreviewActionRoot;
}

interface FakeButton {
  dataset: { transactionId: string };
  focusCount: number;
  addEventListener: (event: string, listener: () => void) => void;
  fire: (event: string) => void;
  focus: () => void;
}

function button(transactionId: string): FakeButton {
  const listeners = new Map<string, () => void>();
  const fakeButton = {
    dataset: { transactionId },
    focusCount: 0,
    addEventListener: (event: string, listener: () => void) => {
      listeners.set(event, listener);
    },
    fire: (event: string) => {
      listeners.get(event)?.();
    },
    focus: () => {
      fakeButton.focusCount += 1;
    }
  };
  return fakeButton;
}

function importResult(): CsvImportResult {
  return {
    rawRows: [],
    records: [],
    rejectedRows: [],
    mapping: { date: "Date", amount: "Amount" },
    dateFormat: "ymd"
  };
}
