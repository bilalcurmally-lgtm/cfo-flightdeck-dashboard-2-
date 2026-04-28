import { parseDate, startOfWeek, toIsoDate } from "./date";
import type { TransactionRecord } from "./types";

export interface FutureCashEvent {
  dateISO: string;
  amount: number;
  label: string;
}

export interface ForecastWeek {
  weekStartISO: string;
  baselineNet: number;
  eventNet: number;
  projectedCash: number;
}

export interface ForecastResult {
  averageWeeklyNet: number;
  events: FutureCashEvent[];
  rejectedEvents: string[];
  weeks: ForecastWeek[];
}

export function build13WeekForecast(
  records: TransactionRecord[],
  cashOnHand: number,
  events: FutureCashEvent[] = [],
  startDate = new Date()
): ForecastResult {
  const averageWeeklyNet = calculateAverageWeeklyNet(records);
  const forecastStart = startOfWeek(startDate);
  let projectedCash = cashOnHand;

  const weeks = Array.from({ length: 13 }, (_, index) => {
    const weekStart = new Date(forecastStart);
    weekStart.setDate(forecastStart.getDate() + index * 7);
    const weekStartISO = toIsoDate(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const eventNet = events
      .filter((event) => {
        const eventDate = parseDate(event.dateISO, "ymd");
        return eventDate && eventDate >= weekStart && eventDate <= weekEnd;
      })
      .reduce((total, event) => total + event.amount, 0);

    projectedCash += averageWeeklyNet + eventNet;

    return {
      weekStartISO,
      baselineNet: averageWeeklyNet,
      eventNet,
      projectedCash
    };
  });

  return {
    averageWeeklyNet,
    events,
    rejectedEvents: [],
    weeks
  };
}

export function parseFutureCashEvents(text: string): Pick<ForecastResult, "events" | "rejectedEvents"> {
  const events: FutureCashEvent[] = [];
  const rejectedEvents: string[] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;

    const [datePart, amountPart, ...labelParts] = line.split(",").map((part) => part.trim());
    const date = parseDate(datePart, "ymd");
    const amount = Number(amountPart);
    const label = labelParts.join(", ") || "Manual event";

    if (!date || !Number.isFinite(amount)) {
      rejectedEvents.push(`Line ${index + 1}: ${line}`);
      continue;
    }

    events.push({
      dateISO: toIsoDate(date),
      amount,
      label
    });
  }

  return { events, rejectedEvents };
}

function calculateAverageWeeklyNet(records: TransactionRecord[]): number {
  const weeks = new Map<string, number>();

  for (const record of records) {
    weeks.set(record.periodWeekly, (weeks.get(record.periodWeekly) ?? 0) + record.signedNet);
  }

  if (!weeks.size) return 0;
  return [...weeks.values()].reduce((total, net) => total + net, 0) / weeks.size;
}
