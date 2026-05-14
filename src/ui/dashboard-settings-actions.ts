import {
  clearSettings,
  DEFAULT_SETTINGS,
  saveSettings,
  selectCashOnHand,
  selectCurrency,
  selectFutureEventsText,
  type AppSettings
} from "../store/settings";
import { readCashOnHand } from "./dashboard-settings-form";

export interface ActiveSettingsImport {
  result: unknown;
  sourceName: string;
}

export interface DashboardSettingsActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface DashboardSettingsActionBindings<TActiveImport extends ActiveSettingsImport> {
  root?: DashboardSettingsActionRoot;
  getActiveImport: () => TActiveImport | null;
  getSettings: () => AppSettings;
  setSettings: (settings: AppSettings) => void;
  renderActiveImport: (activeImport: TActiveImport) => void;
  save?: typeof saveSettings;
  clear?: typeof clearSettings;
}

export function bindDashboardSettingsActions<TActiveImport extends ActiveSettingsImport>({
  root = document,
  getActiveImport,
  getSettings,
  setSettings,
  renderActiveImport,
  save = saveSettings,
  clear = clearSettings
}: DashboardSettingsActionBindings<TActiveImport>): void {
  const cashInput = root.querySelector<HTMLInputElement>("#cash-on-hand");
  const eventsInput = root.querySelector<HTMLTextAreaElement>("#future-events");
  const currencySelect = root.querySelector<HTMLSelectElement>("#currency-select");
  const resetSettingsButton = root.querySelector<HTMLButtonElement>("#reset-settings");

  cashInput?.addEventListener("input", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const nextSettings = selectCashOnHand(getSettings(), readCashOnHand(root, getSettings().cashOnHand));
    setSettings(nextSettings);
    save(nextSettings);
    renderActiveImport(activeImport);
    root.querySelector<HTMLInputElement>("#cash-on-hand")?.focus();
  });

  eventsInput?.addEventListener("input", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const selectionStart = eventsInput.selectionStart;
    const nextSettings = selectFutureEventsText(getSettings(), eventsInput.value);
    setSettings(nextSettings);
    save(nextSettings);
    renderActiveImport(activeImport);
    const nextInput = root.querySelector<HTMLTextAreaElement>("#future-events");
    nextInput?.focus();
    nextInput?.setSelectionRange(selectionStart, selectionStart);
  });

  currencySelect?.addEventListener("change", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const nextSettings = selectCurrency(getSettings(), currencySelect.value);
    setSettings(nextSettings);
    save(nextSettings);
    renderActiveImport(activeImport);
    root.querySelector<HTMLSelectElement>("#currency-select")?.focus();
  });

  resetSettingsButton?.addEventListener("click", () => {
    const activeImport = getActiveImport();
    if (!activeImport) return;

    const nextSettings = { ...DEFAULT_SETTINGS };
    setSettings(nextSettings);
    clear();
    renderActiveImport(activeImport);
    root.querySelector<HTMLButtonElement>("#reset-settings")?.focus();
  });
}
