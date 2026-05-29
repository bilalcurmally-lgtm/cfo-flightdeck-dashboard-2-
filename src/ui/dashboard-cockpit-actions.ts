export interface DashboardCockpitActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
  querySelectorAll<T extends Element = Element>(selector: string): NodeListOf<T> | T[];
  addEventListener?: (event: string, listener: (event: KeyboardEvent) => void) => void;
}

export interface DashboardCockpitActionBindings {
  root?: DashboardCockpitActionRoot;
}

export function bindDashboardCockpitActions({
  root = document
}: DashboardCockpitActionBindings = {}): void {
  const panel = root.querySelector<HTMLElement>("[data-bw-lineage-panel]");
  const activeBody = root.querySelector<HTMLElement>("[data-bw-lineage-active]");
  const closeButton = root.querySelector<HTMLButtonElement>("[data-bw-lineage-close]");
  const triggers = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-bw-lineage-trigger]")
  );
  let activeTrigger: HTMLButtonElement | null = null;

  if (!panel || !activeBody || !closeButton || triggers.length === 0) return;

  const close = () => {
    panel.hidden = true;
    activeBody.innerHTML = "";
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", "false");
    activeTrigger?.focus();
    activeTrigger = null;
  };

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      const metric = trigger.dataset.bwLineageTrigger;
      if (!metric) return;

      const template = root.querySelector<HTMLTemplateElement>(
        `[data-bw-lineage-template="${metric}"]`
      );
      if (!template) return;

      activeTrigger = trigger;
      activeBody.innerHTML = template.innerHTML;
      panel.hidden = false;
      for (const candidate of triggers) candidate.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-expanded", "true");
      closeButton.focus();
    });
  }

  closeButton.addEventListener("click", close);
  root.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) close();
  });
}
