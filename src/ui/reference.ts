export function renderReferencePanelContent(): string {
  return `
    <div class="panel-heading">
      <div>
        <h2>Formula Reference</h2>
        <p>Short version of the local calculations, export rules, and privacy promise.</p>
      </div>
      <span>auditable math</span>
    </div>
    <div class="reference-grid">
      <article>
        <h3>Import</h3>
        <p>Date and amount are required. Flow uses a mapped type column when available; otherwise positive values are revenue and negative values are outflow.</p>
      </article>
      <article>
        <h3>Dashboard</h3>
        <p>Revenue and outflow sum absolute amounts by flow. Net cash is revenue minus outflow. Filters change visible calculations only.</p>
      </article>
      <article>
        <h3>Cash Health</h3>
        <p>Average monthly burn is the average monthly outflow. Runway is cash on hand divided by average monthly burn.</p>
      </article>
      <article>
        <h3>Forecast</h3>
        <p>The 13-week forecast starts from cash on hand, adds average weekly net, and includes manual future cash events.</p>
      </article>
      <article>
        <h3>Exports</h3>
        <p>Transactions CSV and reviewer JSON keep the full reviewed import. Trend CSV exports the visible filtered trend.</p>
      </article>
      <article>
        <h3>Privacy</h3>
        <p>Files are parsed in the browser by default. Local settings stay in browser storage and can be cleared with site data.</p>
      </article>
    </div>
  `;
}
