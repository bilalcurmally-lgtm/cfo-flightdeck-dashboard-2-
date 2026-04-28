export function filteredTransactionsFilename(sourceName: string, createdAt: Date): string {
  const safeName = sourceName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const date = createdAt.toISOString().slice(0, 10);
  return `${safeName || "transactions"}-${date}-filtered-transactions.csv`;
}

export function downloadJson(filename: string, value: unknown): void {
  downloadText(filename, `${JSON.stringify(value, null, 2)}\n`, "application/json");
}

export function downloadText(filename: string, value: string, type: string): void {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
