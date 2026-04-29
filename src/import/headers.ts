export function normalizeImportedHeaders(values: unknown[]): string[] {
  const seen = new Map<string, number>();

  return values.map((value, index) => {
    const baseHeader = String(value ?? "").trim() || `column_${index + 1}`;
    const count = seen.get(baseHeader) ?? 0;
    seen.set(baseHeader, count + 1);

    return count === 0 ? baseHeader : `${baseHeader}_${count + 1}`;
  });
}
