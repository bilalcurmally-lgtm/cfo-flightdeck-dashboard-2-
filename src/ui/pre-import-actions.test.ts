import { describe, expect, it, vi } from "vitest";
import { bindPreImportActions } from "./pre-import-actions";

describe("bindPreImportActions", () => {
  it("routes pre-import action clicks to the matching handlers", async () => {
    const root = new FakeRoot();
    const importButton = new FakeActionElement("import-file");
    const demoButton = new FakeActionElement("load-excel-demo");
    const sampleButton = new FakeActionElement("load-sample-csv", "/sample-agency.csv");
    const openFilePicker = vi.fn();
    const loadNorthstarDemo = vi.fn();
    const loadSelectedSample = vi.fn();

    const unbind = bindPreImportActions({
      root,
      openFilePicker,
      loadNorthstarDemo,
      loadSelectedSample
    });

    root.click(importButton);
    root.click(demoButton);
    root.click(sampleButton);
    await Promise.resolve();

    expect(openFilePicker).toHaveBeenCalledTimes(1);
    expect(loadNorthstarDemo).toHaveBeenCalledTimes(1);
    expect(loadSelectedSample).toHaveBeenCalledWith("/sample-agency.csv");

    unbind();
  });

  it("unbinds the delegated click listener", () => {
    const root = new FakeRoot();
    const openFilePicker = vi.fn();
    const unbind = bindPreImportActions({
      root,
      openFilePicker,
      loadNorthstarDemo: vi.fn(),
      loadSelectedSample: vi.fn()
    });

    unbind();
    root.click(new FakeActionElement("import-file"));

    expect(openFilePicker).not.toHaveBeenCalled();
  });

  it("ignores disabled actions", () => {
    const root = new FakeRoot();
    const openFilePicker = vi.fn();

    bindPreImportActions({
      root,
      openFilePicker,
      loadNorthstarDemo: vi.fn(),
      loadSelectedSample: vi.fn()
    });

    root.click(new FakeActionElement("import-file", undefined, true));

    expect(openFilePicker).not.toHaveBeenCalled();
  });
});

class FakeRoot {
  private listener: EventListener | null = null;

  addEventListener(_type: "click", listener: EventListener): void {
    this.listener = listener;
  }

  removeEventListener(_type: "click", listener: EventListener): void {
    if (this.listener === listener) this.listener = null;
  }

  click(target: FakeActionElement): void {
    this.listener?.({ target } as unknown as Event);
  }
}

class FakeActionElement {
  readonly dataset: { bwAction: string; bwSamplePath?: string };

  constructor(
    action: string,
    samplePath?: string,
    private readonly disabled = false
  ) {
    this.dataset = {
      bwAction: action,
      ...(samplePath ? { bwSamplePath: samplePath } : {})
    };
  }

  closest(selector: string): FakeActionElement | null {
    return selector === "[data-bw-action]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "aria-disabled" && this.disabled ? "true" : null;
  }

  hasAttribute(name: string): boolean {
    return name === "disabled" && this.disabled;
  }
}
