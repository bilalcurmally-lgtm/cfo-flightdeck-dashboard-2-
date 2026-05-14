import type { CashFlow } from "./types";

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const raw = String(value).trim();
  const isDebit = /\bdr\b\.?$/i.test(raw);
  const normalized = raw
    .replace(/[$£€,]/g, "")
    .replace(/\brs\.?/gi, "")
    .replace(/\b(?:pkr|usd|eur|gbp)\b/gi, "")
    .replace(/\b(?:dr|cr)\b\.?$/i, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();
  const number = Number(normalized);

  if (!Number.isFinite(number)) return null;
  return isDebit ? -Math.abs(number) : number;
}

export function parseSplitDebitCreditAmount(debitValue: unknown, creditValue: unknown): number | null {
  const debit = parseAmount(debitValue);
  const credit = parseAmount(creditValue);

  if (debit === null && credit === null) return null;
  return Math.abs(credit ?? 0) - Math.abs(debit ?? 0);
}

export function classifyFlow(
  typeValue: string,
  amountRaw: number,
  revenueTokens: string[],
  outflowTokens: string[]
): CashFlow {
  if (typeValue) {
    if (revenueTokens.some((token) => typeValue.includes(token))) return "revenue";
    if (outflowTokens.some((token) => typeValue.includes(token))) return "outflow";
  }

  return amountRaw >= 0 ? "revenue" : "outflow";
}
