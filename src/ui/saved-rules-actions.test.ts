import { describe, expect, it } from "vitest";
import type { ClassificationRule } from "../finance/classification-rules";
import { bindSavedRulesActions, type SavedRulesActionRoot } from "./saved-rules-actions";

function rule(overrides: Partial<ClassificationRule> = {}): ClassificationRule {
  return {
    id: "stripe-revenue",
    field: "counterparty",
    contains: "stripe",
    override: { flow: "revenue", parent: "Sales" },
    enabled: true,
    ...overrides
  };
}

describe("bindSavedRulesActions", () => {
  it("toggles a saved rule and reports the change", () => {
    let rules = [rule()];
    const toggle = button({ ruleToggle: "stripe-revenue" });
    const changes: string[] = [];

    bindSavedRulesActions({
      root: root({ toggles: [toggle] }),
      getRules: () => rules,
      setRules: (next) => {
        rules = [...next];
      },
      onRulesChanged: (action, id) => changes.push(`${action}:${id}`)
    });

    toggle.fire("click");

    expect(rules[0].enabled).toBe(false);
    expect(changes).toEqual(["toggle:stripe-revenue"]);
  });

  it("deletes a saved rule and reports the change", () => {
    let rules = [rule(), rule({ id: "rent-outflow", contains: "rent" })];
    const deleteButton = button({ ruleDelete: "stripe-revenue" });
    const changes: string[] = [];

    bindSavedRulesActions({
      root: root({ deletes: [deleteButton] }),
      getRules: () => rules,
      setRules: (next) => {
        rules = [...next];
      },
      onRulesChanged: (action, id) => changes.push(`${action}:${id}`)
    });

    deleteButton.fire("click");

    expect(rules.map((item) => item.id)).toEqual(["rent-outflow"]);
    expect(changes).toEqual(["delete:stripe-revenue"]);
  });
});

interface FakeButton {
  dataset: Record<string, string>;
  addEventListener: (event: string, listener: () => void) => void;
  fire: (event: string) => void;
}

function root({
  toggles = [],
  deletes = []
}: {
  toggles?: FakeButton[];
  deletes?: FakeButton[];
}): SavedRulesActionRoot {
  return {
    querySelectorAll: (selector: string) =>
      selector === "[data-rule-toggle]"
        ? toggles
        : selector === "[data-rule-delete]"
          ? deletes
          : []
  } as unknown as SavedRulesActionRoot;
}

function button(dataset: Record<string, string>): FakeButton {
  const listeners = new Map<string, () => void>();
  return {
    dataset,
    addEventListener: (event, listener) => listeners.set(event, listener),
    fire: (event) => listeners.get(event)?.()
  };
}
