export function safeExportStem(sourceName: string): string {
  return sourceName
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "finance";
}

export function exportDateStamp(generatedAt: Date): string {
  return generatedAt.toISOString().slice(0, 10);
}
