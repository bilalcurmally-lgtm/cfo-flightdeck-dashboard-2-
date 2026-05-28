export type PreImportAction = "import-file" | "load-excel-demo" | "load-sample-csv";

export interface PreImportActionRoot {
  addEventListener(type: "click", listener: EventListener): void;
  removeEventListener(type: "click", listener: EventListener): void;
}

interface PreImportActionElement {
  dataset: {
    bwAction?: string;
    bwSamplePath?: string;
  };
  closest(selector: string): PreImportActionElement | null;
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
}

export interface PreImportActionBindings {
  root?: PreImportActionRoot;
  openFilePicker: () => void | Promise<void>;
  loadNorthstarDemo: () => void | Promise<void>;
  loadSelectedSample: (samplePath?: string) => void | Promise<void>;
}

export function bindPreImportActions({
  root = document,
  openFilePicker,
  loadNorthstarDemo,
  loadSelectedSample
}: PreImportActionBindings): () => void {
  const handleClick: EventListener = (event) => {
    const target = event.target as Partial<PreImportActionElement> | null;
    if (!target || typeof target.closest !== "function") return;

    const actionElement = target.closest("[data-bw-action]");
    if (!actionElement || isDisabledAction(actionElement)) return;

    const action = actionElement.dataset.bwAction as PreImportAction | undefined;
    if (action === "import-file") {
      void openFilePicker();
      return;
    }
    if (action === "load-excel-demo") {
      void loadNorthstarDemo();
      return;
    }
    if (action === "load-sample-csv") {
      void loadSelectedSample(actionElement.dataset.bwSamplePath);
    }
  };

  root.addEventListener("click", handleClick);
  return () => {
    root.removeEventListener("click", handleClick);
  };
}

function isDisabledAction(element: PreImportActionElement): boolean {
  return (
    element.getAttribute("aria-disabled") === "true" ||
    element.hasAttribute("disabled")
  );
}
