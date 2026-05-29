export interface DashboardCockpitActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
  addEventListener?: (event: string, listener: (event: KeyboardEvent) => void) => void;
}

export interface DashboardCockpitActionBindings {
  root?: DashboardCockpitActionRoot;
  onReviewDecision?: (decision: { itemId: string; excluded: boolean }) => void;
}

export function bindDashboardCockpitActions({
  root = document,
  onReviewDecision
}: DashboardCockpitActionBindings = {}): void {
  const panel = root.querySelector<HTMLElement>("[data-bw-lineage-panel]");
  const panelTitle = root.querySelector<HTMLElement>("[data-bw-lineage-panel-title]");
  const activeBody = root.querySelector<HTMLElement>("[data-bw-lineage-active]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-bw-lineage-close]");
  const triggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-bw-lineage-trigger]")
  );
  const reviewTriggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-bw-review-trigger]")
  );
  let activeTrigger: HTMLButtonElement | null = null;

  if (!panel || !activeBody || !closeButton || (triggers.length === 0 && reviewTriggers.length === 0)) return;

  const close = () => {
    panel.hidden = true;
    activeBody.innerHTML = "";
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", "false");
    for (const trigger of reviewTriggers) trigger.setAttribute("aria-expanded", "false");
    activeTrigger?.focus();
    activeTrigger = null;
  };

  const openTemplate = (trigger: HTMLButtonElement, template: HTMLTemplateElement | Element, title: string) => {
    activeTrigger = trigger;
    activeBody.innerHTML = template.innerHTML;
    panel.hidden = false;
    panelTitle && (panelTitle.textContent = title);
    for (const candidate of triggers) candidate.setAttribute("aria-expanded", "false");
    for (const candidate of reviewTriggers) candidate.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-expanded", "true");
    closeButton.focus();
    bindReviewToggles(activeBody, onReviewDecision);
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      const metric = trigger.dataset.bwLineageTrigger;
      if (!metric) return;

      const template = root.querySelector<HTMLTemplateElement>(
        `[data-bw-lineage-template="${metric}"]`
      );
      if (!template) return;

      openTemplate(trigger, template, "Audit trail");
    });
  }

  for (const trigger of reviewTriggers) {
    trigger.addEventListener("click", () => {
      const template = root.querySelector<HTMLTemplateElement>("[data-bw-review-template]");
      if (!template) return;
      openTemplate(trigger, template, "Review queue");
    });
  }

  closeButton.addEventListener("click", close);
  root.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) close();
  });

  // Trap Tab focus inside the open panel. Focus enters the panel on open (close
  // button) and is restored to the trigger on close; this keeps it from leaking
  // back to the page behind the drawer. Querying focusables keeps it correct as
  // future phases add interactive controls to the drawer body.
  panel.addEventListener?.("keydown", (event) => {
    if (panel.hidden || event.key !== "Tab") return;

    const found =
      typeof panel.querySelectorAll === "function"
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];
    const focusables = found.length > 0 ? found : [closeButton];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const ownerDocument = panel.ownerDocument as Document | undefined;
    const active = (ownerDocument ? ownerDocument.activeElement : null) as HTMLElement | null;
    const outside = !active || !focusables.includes(active);

    if (event.shiftKey) {
      if (active === first || outside) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || outside) {
      event.preventDefault();
      first.focus();
    }
  });
}

function bindReviewToggles(
  activeBody: HTMLElement,
  onReviewDecision: DashboardCockpitActionBindings["onReviewDecision"]
): void {
  if (!onReviewDecision) return;

  const toggles = Array.from(
    activeBody.querySelectorAll<HTMLButtonElement>("[data-bw-review-toggle]")
  );
  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      const itemId = toggle.dataset.bwReviewToggle;
      if (!itemId) return;
      onReviewDecision({
        itemId,
        excluded: toggle.getAttribute("aria-pressed") !== "true"
      });
    });
  }
}

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "summary",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(",");
