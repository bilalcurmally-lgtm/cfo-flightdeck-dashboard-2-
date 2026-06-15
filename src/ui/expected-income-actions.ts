import {
  createExpectedIncomeEvent,
  validateExpectedIncomeEvent,
  type ExpectedIncomeEvent,
  type ExpectedIncomeStatus
} from "../finance/expected-income";

export interface ExpectedIncomeActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
}

export interface ExpectedIncomeActionBindings {
  root?: ExpectedIncomeActionRoot;
  getEvents: () => ExpectedIncomeEvent[];
  setEvents: (events: readonly ExpectedIncomeEvent[]) => void;
  onEventsChanged?: () => void;
}

export function bindExpectedIncomeActions({
  root = document,
  getEvents,
  setEvents,
  onEventsChanged
}: ExpectedIncomeActionBindings): void {
  root.querySelector<HTMLButtonElement>("#expected-income-add")?.addEventListener("click", () => {
    const dueDate = readValue(root, "#expected-income-date");
    const amount = Number(readValue(root, "#expected-income-amount"));
    const label = readValue(root, "#expected-income-label");
    const status = readStatus(root, "#expected-income-status");

    const event = createExpectedIncomeEvent({ dueDate, amount, label, status });
    const problems = validateExpectedIncomeEvent(event);
    if (problems.length > 0) return;

    setEvents([...getEvents(), event]);
    onEventsChanged?.();
  });

  for (const button of Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-expected-income-delete]")
  )) {
    button.addEventListener("click", () => {
      const eventId = button.dataset.expectedIncomeDelete;
      if (!eventId) return;
      setEvents(getEvents().filter((event) => event.id !== eventId));
      onEventsChanged?.();
    });
  }
}

function readValue(root: ExpectedIncomeActionRoot, selector: string): string {
  return root.querySelector<HTMLInputElement>(selector)?.value.trim() ?? "";
}

function readStatus(root: ExpectedIncomeActionRoot, selector: string): ExpectedIncomeStatus {
  const value = root.querySelector<HTMLSelectElement>(selector)?.value;
  if (value === "tentative" || value === "received") return value;
  return "expected";
}