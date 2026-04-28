import type { CashFlow } from "./types";

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const normalized = String(value)
    .replace(/[$£€,]/g, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
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
