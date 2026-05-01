export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatRunway(runwayMonths: number | null): string {
  if (runwayMonths === null) return "Not enough data";
  return `${runwayMonths.toFixed(1)} months`;
}
