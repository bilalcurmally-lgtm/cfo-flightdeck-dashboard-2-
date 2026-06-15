import type { FutureCashEvent } from "./forecast";
import { parseFutureCashEvents } from "./forecast";

export type ExpectedIncomeStatus = "expected" | "tentative" | "received";

export interface ExpectedIncomeEvent {
  id: string;
  dueDate: string;
  amount: number;
  label: string;
  status: ExpectedIncomeStatus;
}

export function createExpectedIncomeEvent(
  input: Omit<ExpectedIncomeEvent, "id"> & { id?: string }
): ExpectedIncomeEvent {
  return {
    id: input.id ?? `income-${Date.now()}`,
    dueDate: input.dueDate,
    amount: Math.max(0, input.amount),
    label: input.label.trim() || "Expected income",
    status: input.status
  };
}

export function validateExpectedIncomeEvent(event: ExpectedIncomeEvent): string[] {
  const problems: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.dueDate)) problems.push("dueDate must be YYYY-MM-DD");
  if (!Number.isFinite(event.amount) || event.amount <= 0) problems.push("amount must be > 0");
  if (!event.label.trim()) problems.push("label is required");
  return problems;
}

export function toFutureCashEvent(event: ExpectedIncomeEvent): FutureCashEvent {
  return {
    dateISO: event.dueDate,
    amount: event.amount,
    label: `${event.label} (${event.status})`
  };
}

export function activeExpectedIncomeEvents(
  events: readonly ExpectedIncomeEvent[]
): ExpectedIncomeEvent[] {
  return events.filter((event) => event.status !== "received");
}

export function resolveForecastEvents(
  structuredEvents: readonly ExpectedIncomeEvent[],
  futureEventsText: string
): {
  events: FutureCashEvent[];
  rejectedEvents: string[];
  structuredCount: number;
  textCount: number;
} {
  const parsed = parseFutureCashEvents(futureEventsText);
  const activeStructured = activeExpectedIncomeEvents(structuredEvents);
  const structured = activeStructured.map(toFutureCashEvent);
  const seen = new Set<string>();
  for (const event of activeStructured) {
    seen.add(eventSignature({ dateISO: event.dueDate, amount: event.amount, label: event.label }));
    seen.add(eventSignature(toFutureCashEvent(event)));
  }
  const textOnly = parsed.events.filter((event) => {
    const signature = eventSignature(event);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  return {
    events: [...structured, ...textOnly],
    rejectedEvents: parsed.rejectedEvents,
    structuredCount: structured.length,
    textCount: textOnly.length
  };
}

function eventSignature(event: Pick<FutureCashEvent, "dateISO" | "amount" | "label">): string {
  return `${event.dateISO}|${event.amount}|${event.label}`;
}
