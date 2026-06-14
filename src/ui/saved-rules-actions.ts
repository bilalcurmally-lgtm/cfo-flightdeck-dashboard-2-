import type { ClassificationRule } from "../finance/classification-rules";

export interface SavedRulesActionRoot {
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
}

export type SavedRuleAction = "toggle" | "delete";

export interface SavedRulesActionBindings {
  root?: SavedRulesActionRoot;
  getRules: () => ClassificationRule[];
  setRules: (rules: readonly ClassificationRule[]) => void;
  onRulesChanged?: (action: SavedRuleAction, ruleId: string) => void;
}

export function bindSavedRulesActions({
  root = document,
  getRules,
  setRules,
  onRulesChanged
}: SavedRulesActionBindings): void {
  const toggles = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-rule-toggle]"));
  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      const ruleId = toggle.dataset.ruleToggle;
      if (!ruleId) return;

      setRules(
        getRules().map((rule) =>
          rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
        )
      );
      onRulesChanged?.("toggle", ruleId);
    });
  }

  const deletes = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-rule-delete]"));
  for (const button of deletes) {
    button.addEventListener("click", () => {
      const ruleId = button.dataset.ruleDelete;
      if (!ruleId) return;

      setRules(getRules().filter((rule) => rule.id !== ruleId));
      onRulesChanged?.("delete", ruleId);
    });
  }
}
