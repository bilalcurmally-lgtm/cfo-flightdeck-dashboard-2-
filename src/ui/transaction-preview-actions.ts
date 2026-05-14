import type { CsvImportResult } from "../finance/types";
import { selectTransaction, type DashboardViewState } from "../store/view-state";

export interface ActiveTransactionPreviewImport {
  result: CsvImportResult;
  sourceName: string;
}

export interface TransactionPreviewActionRoot {
  querySelectorAll<T extends Element = Element>(selector: string): Iterable<T> | ArrayLike<T>;
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface TransactionPreviewActionBindings {
  root?: TransactionPreviewActionRoot;
  getActiveImport: () => ActiveTransactionPreviewImport | null;
  getViewState: () => DashboardViewState;
  setViewState: (state: DashboardViewState) => void;
  renderActiveImport: (activeImport: ActiveTransactionPreviewImport) => void;
}

export function bindTransactionPreviewActions({
  root = document,
  getActiveImport,
  getViewState,
  setViewState,
  renderActiveImport
}: TransactionPreviewActionBindings): void {
  Array.from(root.querySelectorAll<HTMLButtonElement>("[data-transaction-id]")).forEach((button) => {
    button.addEventListener("click", () => {
      const activeImport = getActiveImport();
      if (!activeImport) return;

      const nextViewState = selectTransaction(getViewState(), button.dataset.transactionId ?? "");
      setViewState(nextViewState);
      renderActiveImport(activeImport);
      root.querySelector<HTMLButtonElement>(
        `[data-transaction-id="${nextViewState.selectedTransactionId}"]`
      )?.focus();
    });
  });
}
