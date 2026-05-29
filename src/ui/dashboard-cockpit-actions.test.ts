import { describe, expect, it } from "vitest";
import { bindDashboardCockpitActions, type DashboardCockpitActionRoot } from "./dashboard-cockpit-actions";

describe("bindDashboardCockpitActions", () => {
  it("opens the selected metric lineage and closes it again", () => {
    const revenueTrigger = button();
    const runwayTrigger = button();
    const closeButton = button();
    const panel = element();
    const activeBody = element();
    const revenueTemplate = element("<section>Revenue lineage</section>");
    const runwayTemplate = element("<section>Runway lineage</section>");

    bindDashboardCockpitActions({
      root: root({
        triggers: [revenueTrigger, runwayTrigger],
        templates: { revenue: revenueTemplate, runwayMonths: runwayTemplate },
        panel,
        activeBody,
        closeButton
      })
    });

    revenueTrigger.fire("click");

    expect(panel.hidden).toBe(false);
    expect(activeBody.innerHTML).toBe("<section>Revenue lineage</section>");
    expect(revenueTrigger.attributes["aria-expanded"]).toBe("true");
    expect(runwayTrigger.attributes["aria-expanded"]).toBe("false");
    expect(closeButton.focusCount).toBe(1);

    closeButton.fire("click");

    expect(panel.hidden).toBe(true);
    expect(activeBody.innerHTML).toBe("");
    expect(revenueTrigger.attributes["aria-expanded"]).toBe("false");
    expect(revenueTrigger.focusCount).toBe(1);
  });

  it("traps Tab focus inside the open panel", () => {
    const revenueTrigger = button();
    const closeButton = button();
    const panel = element();
    const activeBody = element();

    bindDashboardCockpitActions({
      root: root({
        triggers: [revenueTrigger],
        templates: { revenue: element("<section>Revenue lineage</section>") },
        panel,
        activeBody,
        closeButton
      })
    });

    revenueTrigger.fire("click");
    expect(closeButton.focusCount).toBe(1);

    let prevented = 0;
    const preventDefault = () => {
      prevented += 1;
    };

    // Tab and Shift+Tab both keep focus on the only focusable (the close button).
    panel.fire("keydown", { key: "Tab", shiftKey: false, preventDefault });
    panel.fire("keydown", { key: "Tab", shiftKey: true, preventDefault });
    expect(prevented).toBe(2);
    expect(closeButton.focusCount).toBe(3);

    // Non-Tab keys are ignored by the trap.
    panel.fire("keydown", { key: "a", shiftKey: false, preventDefault });
    expect(prevented).toBe(2);

    // When closed, the trap is inert.
    closeButton.fire("click");
    panel.fire("keydown", { key: "Tab", shiftKey: false, preventDefault });
    expect(prevented).toBe(2);
  });

  it("opens the review drawer and reports include/exclude toggles", () => {
    const reviewTrigger = button();
    const closeButton = button();
    const panel = element();
    const title = element();
    const activeBody = element();
    const reviewTemplate = element(
      '<section><button data-bw-review-toggle="transfer:out:in" aria-pressed="false">Exclude</button></section>'
    );
    const decisions: Array<{ itemId: string; excluded: boolean }> = [];

    bindDashboardCockpitActions({
      root: root({
        triggers: [],
        reviewTrigger,
        templates: {},
        reviewTemplate,
        panel,
        panelTitle: title,
        activeBody,
        closeButton
      }),
      onReviewDecision: (decision) => decisions.push(decision)
    });

    reviewTrigger.fire("click");

    expect(panel.hidden).toBe(false);
    expect(title.textContent).toBe("Review queue");
    expect(activeBody.innerHTML).toContain("data-bw-review-toggle");
    expect(reviewTrigger.attributes["aria-expanded"]).toBe("true");

    const toggle = activeBody.children[0];
    toggle.fire("click");

    expect(decisions).toEqual([{ itemId: "transfer:out:in", excluded: true }]);
  });
});

interface FakeRootParts {
  triggers: FakeElement[];
  templates: Record<string, FakeElement>;
  reviewTrigger?: FakeElement;
  reviewTemplate?: FakeElement;
  panel: FakeElement;
  panelTitle?: FakeElement;
  activeBody: FakeElement;
  closeButton: FakeElement;
}

function root(parts: FakeRootParts): DashboardCockpitActionRoot {
  for (const trigger of parts.triggers) {
    trigger.dataset.bwLineageTrigger = trigger === parts.triggers[0] ? "revenue" : "runwayMonths";
  }

  return {
    querySelector: (selector: string) => {
      if (selector === "[data-bw-lineage-panel]") return parts.panel;
      if (selector === "[data-bw-lineage-panel-title]") return parts.panelTitle ?? null;
      if (selector === "[data-bw-lineage-active]") return parts.activeBody;
      if (selector === "[data-bw-lineage-close]") return parts.closeButton;
      if (selector === "[data-bw-review-template]") return parts.reviewTemplate ?? null;
      const templateMatch = selector.match(/\[data-bw-lineage-template="(.+)"\]/);
      return templateMatch ? parts.templates[templateMatch[1]] ?? null : null;
    },
    querySelectorAll: (selector: string) =>
      selector === "[data-bw-lineage-trigger]"
        ? parts.triggers
        : selector === "[data-bw-review-trigger]" && parts.reviewTrigger
          ? [parts.reviewTrigger]
          : [],
    addEventListener: () => {}
  } as unknown as DashboardCockpitActionRoot;
}

type Listener = (payload?: unknown) => void;

interface FakeElement {
  hidden: boolean;
  innerHTML: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  children: FakeElement[];
  textContent: string;
  focusCount: number;
  addEventListener: (event: string, listener: Listener) => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  querySelectorAll: (selector: string) => FakeElement[];
  focus: () => void;
  fire: (event: string, payload?: unknown) => void;
}

function element(innerHTML = ""): FakeElement {
  const listeners = new Map<string, Listener>();
  let currentInnerHTML = innerHTML;
  const fake: FakeElement = {
    hidden: true,
    get innerHTML() {
      return currentInnerHTML;
    },
    set innerHTML(value: string) {
      currentInnerHTML = value;
      fake.children = parseChildren(value);
    },
    dataset: {},
    attributes: {},
    children: parseChildren(innerHTML),
    textContent: "",
    focusCount: 0,
    addEventListener: (event, listener) => listeners.set(event, listener),
    setAttribute: (name, value) => {
      fake.attributes[name] = value;
    },
    getAttribute: (name) => fake.attributes[name] ?? null,
    querySelectorAll: (selector) =>
      selector === "[data-bw-review-toggle]" ? fake.children : [],
    focus: () => {
      fake.focusCount += 1;
    },
    fire: (event, payload) => listeners.get(event)?.(payload)
  };
  return fake;
}

function button(): FakeElement {
  return element();
}

function parseChildren(innerHTML: string): FakeElement[] {
  const match = innerHTML.match(/data-bw-review-toggle="([^"]+)".*?aria-pressed="([^"]+)"/);
  if (!match) return [];
  const child = button();
  child.dataset.bwReviewToggle = match[1];
  child.attributes["aria-pressed"] = match[2];
  return [child];
}
