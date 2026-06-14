import type { WorkspaceStore } from "../workspace/workspace-store";
import { parseProjectFile, serializeProjectFile } from "../workspace/project-file";
import { exportDateStamp } from "../export/filenames";
import { downloadText } from "./downloads";

export interface ProjectFileActionRoot {
  querySelector<T extends Element = Element>(selector: string): T | null;
}

export interface ProjectFileActionBindings {
  root?: ProjectFileActionRoot;
  status: { textContent: string | null };
  /** Read lazily — the durable store replaces the in-memory one after open. */
  getStore: () => WorkspaceStore;
  /** Re-render after a project file is loaded so restored state re-applies. */
  onLoaded: () => void;
  serialize?: typeof serializeProjectFile;
  parse?: typeof parseProjectFile;
  download?: (filename: string, text: string, mediaType: string) => void;
  readFile?: (file: File) => Promise<string>;
  now?: () => Date;
}

export function projectFileName(createdAt: Date): string {
  return `billu-workspace-${exportDateStamp(createdAt)}.billu.json`;
}

export function bindProjectFileActions({
  root = document,
  status,
  getStore,
  onLoaded,
  serialize = serializeProjectFile,
  parse = parseProjectFile,
  download = downloadText,
  readFile = (file) => file.text(),
  now = () => new Date()
}: ProjectFileActionBindings): void {
  root.querySelector<HTMLButtonElement>("#save-project")?.addEventListener("click", () => {
    download(projectFileName(now()), serialize(getStore().snapshot()), "application/json");
    status.textContent = "Saved your workspace to a .billu.json project file.";
  });

  const fileInput = root.querySelector<HTMLInputElement>("#project-file");

  root.querySelector<HTMLButtonElement>("#open-project")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    let text: string;
    try {
      text = await readFile(file);
    } catch {
      status.textContent = "Could not read that project file. Workspace unchanged.";
      fileInput.value = "";
      return;
    }

    const result = parse(text);
    if (!result.ok) {
      // Loud, non-destructive: keep the current workspace exactly as it is.
      status.textContent = `Could not open project file: ${result.error}. Workspace unchanged.`;
      fileInput.value = "";
      return;
    }

    getStore().load(result.snapshot);
    fileInput.value = "";
    status.textContent = "Project file loaded — your workspace was restored.";
    onLoaded();
  });
}
