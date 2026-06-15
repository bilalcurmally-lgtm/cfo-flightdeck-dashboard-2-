import { createBudgetEntry, validateBudgetEntry, type BudgetEntry } from "../finance/budget";

export interface BudgetActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
}

export interface BudgetActionBindings {
  root?: BudgetActionRoot;
  getBudgets: () => BudgetEntry[];
  setBudgets: (budgets: readonly BudgetEntry[]) => void;
  onBudgetsChanged?: () => void;
}

export function bindBudgetActions({
  root = document,
  getBudgets,
  setBudgets,
  onBudgetsChanged
}: BudgetActionBindings): void {
  root.querySelector<HTMLButtonElement>("#budget-add")?.addEventListener("click", () => {
    const month = readValue(root, "#budget-month");
    const scope = readSelect(root, "#budget-scope", "head");
    const key = readValue(root, "#budget-key");
    const flow = readSelect(root, "#budget-flow", "outflow");
    const amount = Number(readValue(root, "#budget-amount"));
    const note = readValue(root, "#budget-note");

    const entry = createBudgetEntry({
      month,
      scope: scope === "subcategory" ? "subcategory" : "head",
      key,
      flow: flow === "revenue" ? "revenue" : "outflow",
      amount,
      note
    });
    const problems = validateBudgetEntry(entry);
    if (problems.length > 0) return;

    setBudgets([...getBudgets(), entry]);
    onBudgetsChanged?.();
  });

  for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-budget-delete]"))) {
    button.addEventListener("click", () => {
      const budgetId = button.dataset.budgetDelete;
      if (!budgetId) return;
      setBudgets(getBudgets().filter((entry) => entry.id !== budgetId));
      onBudgetsChanged?.();
    });
  }
}

function readValue(root: BudgetActionRoot, selector: string): string {
  return root.querySelector<HTMLInputElement>(selector)?.value.trim() ?? "";
}

function readSelect(root: BudgetActionRoot, selector: string, fallback: string): string {
  return root.querySelector<HTMLSelectElement>(selector)?.value ?? fallback;
}