import type { SampleDataset } from "../import/sample-datasets";
import { renderAppbarLoadAction } from "./dashboard-renderers";

export function renderAppShell(_samples: readonly SampleDataset[]): string {
  return `
  <section class="shell" aria-labelledby="page-title">
    <header class="hero">
      <div>
        <p class="eyebrow">Billu.Works Finance Dashboard V2</p>
        <h1 id="page-title">Private finance import, tested before the dashboard grows.</h1>
        <p class="lede">
          Drop in a bank CSV or Excel export. V2 keeps the file in your browser, maps transaction
          rows locally, and shows rejected rows before any CFO-style claims are made.
        </p>
      </div>
      <div class="hero-rail">
        <aside class="privacy-note" aria-label="Privacy promise">
          <strong>Local first</strong>
          <span>No upload, no account, no server-side transaction storage.</span>
        </aside>
        <div class="shell-actions" aria-label="Dashboard actions">
          ${renderAppbarLoadAction()}
          <button id="save-project" type="button" disabled>Save project</button>
          <button id="open-project" type="button" disabled>Open project</button>
          <button id="clear-button" type="button" disabled>Clear</button>
          <button id="reference-button" type="button" aria-expanded="false">Formulas</button>
        </div>
      </div>
    </header>

    <input
      id="csv-file"
      class="bw-sr-only"
      type="file"
      accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      aria-label="Choose a CSV or Excel file"
    />
    <input
      id="project-file"
      class="bw-sr-only"
      type="file"
      accept=".json,.billu.json,application/json"
      aria-label="Open a .billu.json project file"
    />
    <p id="status" class="status" role="status">Waiting for a CSV or Excel file.</p>

    <section id="reference-panel" class="reference-panel" aria-label="Formula reference" hidden></section>
    <section id="results" class="results" aria-live="polite"></section>
  </section>
`;
}
