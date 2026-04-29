import { exportDateStamp, safeExportStem } from "../export/filenames";

export function filteredTransactionsFilename(sourceName: string, createdAt: Date): string {
  return `${safeExportStem(sourceName)}-${exportDateStamp(createdAt)}-filtered-transactions.csv`;
}

export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, "application/json");
}

export function downloadText(filename: string, value: string, type: string): void {
  const blob = new Blob([value], { type });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
