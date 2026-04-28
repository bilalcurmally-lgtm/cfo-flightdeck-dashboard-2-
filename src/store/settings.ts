export interface AppSettings {
  currency: string;
  cashOnHand: number;
  futureEventsText: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currency: "USD",
  cashOnHand: 0,
  futureEventsText: ""
};

const SETTINGS_KEY = "billu-works-dashboard-v2-settings";

export function loadSettings(storage: Storage | undefined = globalThis.localStorage): AppSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };

  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    return {
      currency: typeof parsed.currency === "string" && parsed.currency ? parsed.currency : "USD",
      cashOnHand:
        typeof parsed.cashOnHand === "number" && Number.isFinite(parsed.cashOnHand)
          ? Math.max(0, parsed.cashOnHand)
          : 0,
      futureEventsText:
        typeof parsed.futureEventsText === "string" ? parsed.futureEventsText : ""
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  settings: AppSettings,
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearSettings(storage: Storage | undefined = globalThis.localStorage): void {
  if (!storage) return;
  storage.removeItem(SETTINGS_KEY);
}
