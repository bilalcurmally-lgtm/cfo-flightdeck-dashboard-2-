export interface DashboardSettingsFormRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export function readCashOnHand(
  root: DashboardSettingsFormRoot = document,
  defaultCashOnHand = 0
): number {
  const value = Number(
    root.querySelector<HTMLInputElement>("#cash-on-hand")?.value ?? defaultCashOnHand
  );
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function readFutureEventsText(
  root: DashboardSettingsFormRoot = document,
  defaultFutureEventsText = ""
): string {
  return (
    root.querySelector<HTMLTextAreaElement>("#future-events")?.value ?? defaultFutureEventsText
  );
}
