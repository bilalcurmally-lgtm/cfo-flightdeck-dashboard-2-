import type { DateFormat, PeriodGrain, TransactionRecord } from "./types";

export function parseDate(value: unknown, dateFormat: DateFormat = "dmy"): Date | null {
  if (!value) return null;

  const date = new Date(String(value));
  if (!Number.isNaN(date.getTime())) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  const ymdMatch = String(value).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const match = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;

  const [, part1, part2, part3] = match;
  const year = part3.length === 2 ? Number(`20${part3}`) : Number(part3);

  if (dateFormat === "mdy") return new Date(year, Number(part1) - 1, Number(part2));
  return new Date(year, Number(part2) - 1, Number(part1));
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function detectDateFormat(
  rawRows: Array<Record<string, string>>,
  dateColumnName: string
): DateFormat {
  if (!dateColumnName) return "ymd";

  let ymdScore = 0;
  let dmyScore = 0;
  let mdyScore = 0;
  const sample = rawRows.slice(0, 50);

  for (const row of sample) {
    const value = String(row[dateColumnName] || "").trim();
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(value)) {
      ymdScore += 1;
      continue;
    }

    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) continue;

    const [, part1, part2] = match;
    const p1 = Number(part1);
    const p2 = Number(part2);
    if (p1 > 12 && p2 <= 12) dmyScore += 1;
    else if (p2 > 12 && p1 <= 12) mdyScore += 1;
  }

  if (ymdScore > dmyScore && ymdScore > mdyScore) return "ymd";
  if (dmyScore > mdyScore) return "dmy";
  if (mdyScore > dmyScore) return "mdy";
  return "dmy";
}

export function grainKey(record: TransactionRecord, grain: PeriodGrain): string {
  if (grain === "weekly") return record.periodWeekly;
  if (grain === "monthly") return record.periodMonthly;
  return record.periodDaily;
}
