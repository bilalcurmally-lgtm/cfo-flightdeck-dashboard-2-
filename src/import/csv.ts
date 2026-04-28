import type { ImportedRow } from "../finance/types";

export function parseCsv(text: string): ImportedRow[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      current.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(cell);
      if (current.some((value) => value.trim() !== "")) rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (inQuotes) {
    current.push(cell);
    if (current.some((value) => value.trim() !== "")) rows.push(current);
  } else if (cell.length || current.length) {
    current.push(cell);
    if (current.some((value) => value.trim() !== "")) rows.push(current);
  }

  const headerRowIndex = rows.findIndex((row) => row.some((value) => value.trim() !== ""));
  if (headerRowIndex < 0) return [];

  const headers = rows[headerRowIndex].map(
    (header, index) => header.trim() || `column_${index + 1}`
  );

  return rows.slice(headerRowIndex + 1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, (values[index] || "").trim()]))
  );
}
