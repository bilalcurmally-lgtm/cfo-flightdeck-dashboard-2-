import { describe, it, expect } from "vitest";
import {
  bindProjectFileActions,
  projectFileName,
  type ProjectFileActionRoot
} from "./project-file-actions";
import {
  createInMemoryWorkspaceStore,
  type WorkspaceSnapshot,
  type WorkspaceStore
} from "../workspace/workspace-store";
import { parseProjectFile, serializeProjectFile } from "../workspace/project-file";

const SIG = "txn_aaaaaaaaaaaaaaaa";

function seededStore(): { store: WorkspaceStore; loaded: WorkspaceSnapshot[] } {
  const inner = createInMemoryWorkspaceStore();
  inner.setCategoryOverride(SIG, { parent: "Financing", flow: "revenue" });
  const loaded: WorkspaceSnapshot[] = [];
  const store: WorkspaceStore = {
    ...inner,
    load: (snapshot) => {
      loaded.push(snapshot);
      inner.load(snapshot);
    }
  };
  return { store, loaded };
}

interface FakeEl {
  disabled: boolean;
  value: string;
  files: unknown[] | null;
  clicks: number;
  addEventListener: (event: string, listener: () => void | Promise<void>) => void;
  fire: (event: string) => void | Promise<void>;
  click: () => void;
}

function el(): FakeEl {
  const listeners = new Map<string, () => void | Promise<void>>();
  return {
    disabled: false,
    value: "",
    files: null,
    clicks: 0,
    addEventListener: (event, listener) => listeners.set(event, listener),
    fire: (event) => listeners.get(event)?.(),
    click() {
      this.clicks += 1;
    }
  };
}

function root(map: Record<string, FakeEl>): ProjectFileActionRoot {
  return {
    querySelector: (selector: string) => map[selector] ?? null
  } as unknown as ProjectFileActionRoot;
}

describe("bindProjectFileActions", () => {
  it("filenames the project file with a date stamp", () => {
    expect(projectFileName(new Date("2026-06-06T12:00:00.000Z"))).toBe(
      "billu-workspace-2026-06-06.billu.json"
    );
  });

  it("saves the current workspace snapshot as a .billu.json download", () => {
    const { store } = seededStore();
    const els = { "#save-project": el(), "#open-project": el(), "#project-file": el() };
    const downloads: Array<{ filename: string; text: string; mediaType: string }> = [];

    bindProjectFileActions({
      root: root(els),
      status: { textContent: "" },
      getStore: () => store,
      onLoaded: () => {},
      download: (filename, text, mediaType) => downloads.push({ filename, text, mediaType }),
      readFile: async () => "",
      now: () => new Date("2026-06-06T12:00:00.000Z")
    });

    els["#save-project"].fire("click");

    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe("billu-workspace-2026-06-06.billu.json");
    // Round-trips back to the seeded override.
    const parsed = parseProjectFile(downloads[0].text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.snapshot.categoryOverrides[SIG]).toEqual({
        parent: "Financing",
        flow: "revenue"
      });
    }
  });

  it("opening the picker clicks the hidden file input", () => {
    const { store } = seededStore();
    const els = { "#save-project": el(), "#open-project": el(), "#project-file": el() };

    bindProjectFileActions({
      root: root(els),
      status: { textContent: "" },
      getStore: () => store,
      onLoaded: () => {},
      download: () => {},
      readFile: async () => ""
    });

    els["#open-project"].fire("click");
    expect(els["#project-file"].clicks).toBe(1);
  });

  it("loads a valid project file into the store and notifies the caller", async () => {
    const { store, loaded } = seededStore();
    const els = { "#save-project": el(), "#open-project": el(), "#project-file": el() };
    let loadedCalls = 0;
    const status = { textContent: "" };

    const fileText = serializeProjectFile({
      version: 1,
      categoryOverrides: { [SIG]: { parent: "Internal" } },
      decisions: {}
    });

    bindProjectFileActions({
      root: root(els),
      status,
      getStore: () => store,
      onLoaded: () => {
        loadedCalls += 1;
      },
      download: () => {},
      readFile: async () => fileText
    });

    els["#project-file"].files = [{ name: "ws.billu.json" }];
    await els["#project-file"].fire("change");

    expect(loaded).toHaveLength(1);
    expect(loaded[0].categoryOverrides[SIG]).toEqual({ parent: "Internal" });
    expect(loadedCalls).toBe(1);
    expect(els["#project-file"].value).toBe("");
    expect(status.textContent).toMatch(/restored|loaded/i);
  });

  it("rejects a corrupt project file loudly and leaves the store untouched", async () => {
    const { store, loaded } = seededStore();
    const els = { "#save-project": el(), "#open-project": el(), "#project-file": el() };
    let loadedCalls = 0;
    const status = { textContent: "" };

    bindProjectFileActions({
      root: root(els),
      status,
      getStore: () => store,
      onLoaded: () => {
        loadedCalls += 1;
      },
      download: () => {},
      readFile: async () => "{ not valid json"
    });

    els["#project-file"].files = [{ name: "broken.billu.json" }];
    await els["#project-file"].fire("change");

    expect(loaded).toHaveLength(0);
    expect(loadedCalls).toBe(0);
    expect(status.textContent ?? "").toMatch(/could not|unchanged|invalid/i);
    expect(els["#project-file"].value).toBe("");
  });
});
