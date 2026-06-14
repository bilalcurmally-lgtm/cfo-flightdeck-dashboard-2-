import type { CashFlow } from "../finance/types";
import type { ClassificationOverride } from "../finance/classification-overrides";

export interface DashboardCockpitActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
  addEventListener?: (event: string, listener: (event: KeyboardEvent) => void) => void;
}

export interface DashboardCockpitActionBindings {
  root?: DashboardCockpitActionRoot;
  onReviewDecision?: (decision: { itemId: string; excluded: boolean }) => void;
  reopenReviewItemId?: string;
  onRecategorize?: (id: string, patch: ClassificationOverride) => void;
  onConfirmCategory?: (id: string) => void;
  onResetCategory?: (id: string) => void;
  onSaveCategoryRule?: (id: string) => void;
  reopenCategoryItemId?: string;
}

export function bindDashboardCockpitActions({
  root = document,
  onReviewDecision,
  reopenReviewItemId,
  onRecategorize,
  onConfirmCategory,
  onResetCategory,
  onSaveCategoryRule,
  reopenCategoryItemId
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
  const nonOperatingTriggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-bw-nonop-trigger]")
  );
  const categoryTriggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-bw-category-trigger]")
  );
  const allTriggers = [
    ...triggers,
    ...reviewTriggers,
    ...nonOperatingTriggers,
    ...categoryTriggers
  ];
  let activeTrigger: HTMLButtonElement | null = null;

  if (!panel || !activeBody || !closeButton || allTriggers.length === 0) return;

  const close = () => {
    panel.hidden = true;
    activeBody.innerHTML = "";
    for (const trigger of allTriggers) trigger.setAttribute("aria-expanded", "false");
    activeTrigger?.focus();
    activeTrigger = null;
  };

  const openTemplate = (trigger: HTMLButtonElement, template: HTMLTemplateElement | Element, title: string) => {
    activeTrigger = trigger;
    activeBody.innerHTML = template.innerHTML;
    panel.hidden = false;
    if (panelTitle) panelTitle.textContent = title;
    panel.setAttribute("aria-label", title);
    closeButton.setAttribute("aria-label", `Close ${title.toLowerCase()}`);
    for (const candidate of allTriggers) candidate.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-expanded", "true");
    closeButton.focus();
    bindReviewToggles(activeBody, onReviewDecision);
    bindCategoryControls(activeBody, {
      onRecategorize,
      onConfirmCategory,
      onResetCategory,
      onSaveCategoryRule
    });
  };

  const openReview = (trigger: HTMLButtonElement) => {
    const template = root.querySelector<HTMLTemplateElement>("[data-bw-review-template]");
    if (!template) return;
    openTemplate(trigger, template, "Review queue");
  };

  const openNonOperating = (trigger: HTMLButtonElement) => {
    const template = root.querySelector<HTMLTemplateElement>("[data-bw-nonop-template]");
    if (!template) return;
    openTemplate(trigger, template, "Non-operating money");
  };

  const openCategory = (trigger: HTMLButtonElement) => {
    const template = root.querySelector<HTMLTemplateElement>("[data-bw-category-template]");
    if (!template) return;
    openTemplate(trigger, template, "Category review");
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
    trigger.addEventListener("click", () => openReview(trigger));
  }

  for (const trigger of nonOperatingTriggers) {
    trigger.addEventListener("click", () => openNonOperating(trigger));
  }

  for (const trigger of categoryTriggers) {
    trigger.addEventListener("click", () => openCategory(trigger));
  }

  // After a toggle re-renders the dashboard, reopen the review drawer so the
  // user keeps their place, and restore focus to the item they just changed.
  if (reopenReviewItemId && reviewTriggers[0]) {
    openReview(reviewTriggers[0]);
    const restored = activeBody.querySelector<HTMLButtonElement>(
      `[data-bw-review-toggle="${reopenReviewItemId}"]`
    );
    (restored ?? closeButton).focus();
  }

  // Same place-keeping for a recategorization: reopen the category drawer and
  // restore focus to the Group select of the row the user just changed.
  if (reopenCategoryItemId && categoryTriggers[0]) {
    openCategory(categoryTriggers[0]);
    const restored = activeBody.querySelector<HTMLElement>(
      `[data-category-id="${reopenCategoryItemId}"][data-role="group-select"]`
    );
    (restored ?? closeButton).focus();
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

function bindCategoryControls(
  activeBody: HTMLElement,
  handlers: Pick<
    DashboardCockpitActionBindings,
    "onRecategorize" | "onConfirmCategory" | "onResetCategory"
    | "onSaveCategoryRule"
  >
): void {
  const { onRecategorize, onConfirmCategory, onResetCategory, onSaveCategoryRule } = handlers;
  if (!onRecategorize && !onConfirmCategory && !onResetCategory && !onSaveCategoryRule) return;

  const flowSelects = Array.from(
    activeBody.querySelectorAll<HTMLSelectElement>('[data-role="flow-select"]')
  );
  for (const select of flowSelects) {
    select.addEventListener("change", () => {
      const id = select.dataset.categoryId;
      if (id) onRecategorize?.(id, { flow: select.value as CashFlow });
    });
  }

  const groupSelects = Array.from(
    activeBody.querySelectorAll<HTMLSelectElement>('[data-role="group-select"]')
  );
  for (const select of groupSelects) {
    select.addEventListener("change", () => {
      const id = select.dataset.categoryId;
      if (id) onRecategorize?.(id, { parent: select.value });
    });
  }

  const confirmButtons = Array.from(
    activeBody.querySelectorAll<HTMLButtonElement>('[data-role="confirm"]')
  );
  for (const button of confirmButtons) {
    button.addEventListener("click", () => {
      const id = button.dataset.categoryId;
      if (id) onConfirmCategory?.(id);
    });
  }

  const resetButtons = Array.from(
    activeBody.querySelectorAll<HTMLButtonElement>('[data-role="reset"]')
  );
  for (const button of resetButtons) {
    button.addEventListener("click", () => {
      const id = button.dataset.categoryId;
      if (id) onResetCategory?.(id);
    });
  }

  const saveRuleButtons = Array.from(
    activeBody.querySelectorAll<HTMLButtonElement>('[data-role="save-rule"]')
  );
  for (const button of saveRuleButtons) {
    button.addEventListener("click", () => {
      const id = button.dataset.categoryId;
      if (id) onSaveCategoryRule?.(id);
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
