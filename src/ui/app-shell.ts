import type { SampleDataset } from "../import/sample-datasets";
import { escapeHtml } from "./html";

export function renderAppShell(samples: SampleDataset[]): string {
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
      <aside class="privacy-note" aria-label="Privacy promise">
        <strong>Local first</strong>
        <span>No upload, no account, no server-side transaction storage.</span>
      </aside>
    </header>

    <section class="import-panel" aria-labelledby="import-title">
      <div>
        <h2 id="import-title">Import File</h2>
        <p>CSV and Excel files are parsed locally, then paused for mapping review before calculations render.</p>
      </div>
      <div class="actions">
        <label class="file-button">
          <input id="csv-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          Choose File
        </label>
        <label class="sample-picker">
          <span>Sample</span>
          <select id="sample-select">
            ${samples.map((sample) => renderSampleOption(sample)).join("")}
          </select>
        </label>
        <button id="sample-button" type="button">Load Sample</button>
        <button id="clear-button" type="button" disabled>Clear</button>
        <button id="reference-button" type="button" aria-expanded="false">Formulas</button>
      </div>
      <p id="status" class="status" role="status">Waiting for a CSV or Excel file.</p>
    </section>

    <section id="reference-panel" class="reference-panel" aria-label="Formula reference" hidden></section>
    <section id="results" class="results" aria-live="polite"></section>
  </section>
`;
}

function renderSampleOption(sample: SampleDataset): string {
  return `<option value="${escapeHtml(sample.path)}">${escapeHtml(sample.label)}</option>`;
}
