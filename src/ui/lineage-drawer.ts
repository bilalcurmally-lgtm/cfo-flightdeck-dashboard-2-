import type { AuditMetric, CalcNode, MetricLineage, RowRef } from "../finance/audit";
import { getMetricContract } from "../finance/metric-registry";
import type { MetricContract } from "../finance/metric-contract";
import { escapeHtml } from "./html";

/**
 * Phase B1 — pure content renderer for a metric's audit lineage.
 *
 * Given a {@link MetricLineage} (produced upstream in Phase A1), render the
 * "show your work" drawer body: the formula, a plain-English sentence, any
 * assumptions, and the evidence — a direct rows table (revenue archetype) or a
 * calc tree (runway / net-cash archetype). Pure and escaped; the open/close
 * shell and click wiring live in the cockpit action layer.
 *
 * Unit handling: the metric headline is formatted per-metric (runway is months,
 * everything else is money). Inside the A1 calc trees every descendant value is
 * monetary (cash on hand, average burn, monthly buckets, revenue, outflow), so
 * the tree body and row amounts are formatted with `formatMoney`.
 */
export interface LineageFormatters {
  formatMoney: (value: number) => string;
  formatRunway: (months: number | null) => string;
}

const METRIC_LABELS: Record<AuditMetric, string> = {
  revenue: "Revenue",
  outflow: "Outflow",
  netCash: "Net cash",
  averageMonthlyOutflow: "Average monthly outflow",
  runwayMonths: "Runway"
};

const OP_LABELS: Record<CalcNode["op"], string> = {
  sum: "+",
  subtract: "−",
  avg: "avg",
  divide: "÷",
  count: "count",
  identity: "="
};

export function renderLineageDrawer(lineage: MetricLineage, formatters: LineageFormatters): string {
  const label = METRIC_LABELS[lineage.metric];
  const contract = getMetricContract(lineage.metric);

  return `
    <section class="bw-lineage" role="region" aria-label="${escapeHtml(`${label} lineage`)}">
      <header class="bw-lineage__head">
        <span class="bw-lineage__metric">${escapeHtml(label)}</span>
        <span class="bw-lineage__value">${escapeHtml(renderHeadlineValue(lineage, formatters))}</span>
      </header>
      ${renderDecisionQuestion(contract)}
      <p class="bw-lineage__formula">${escapeHtml(lineage.formulaText)}</p>
      <p class="bw-lineage__plain">${escapeHtml(lineage.plainEnglish)}</p>
      ${renderAssumptions(lineage, formatters)}
      ${renderEvidence(lineage, formatters)}
      ${renderExcluded(lineage)}
      ${renderCaveats(contract)}
    </section>
  `;
}

/**
 * The metric contract's decision question — the "why this number matters" line
 * from the registry, shown above the formula so the reader knows what call the
 * number is meant to inform before they read how it was computed.
 */
function renderDecisionQuestion(contract: MetricContract | undefined): string {
  if (!contract) return "";
  return `<p class="bw-lineage__question">${escapeHtml(contract.decisionQuestion)}</p>`;
}

/**
 * The metric contract's caveats — limitations a reader should keep in mind before
 * trusting the number. Rendered as a quiet closing section under the audit trail.
 */
function renderCaveats(contract: MetricContract | undefined): string {
  if (!contract || contract.caveats.length === 0) return "";
  const items = contract.caveats
    .map((caveat) => `<li class="bw-lineage__caveat">${escapeHtml(caveat)}</li>`)
    .join("");
  return `
    <div class="bw-lineage__caveats">
      <span class="bw-lineage__section-label">Good to know</span>
      <ul class="bw-lineage__caveat-list">${items}</ul>
    </div>
  `;
}

function renderHeadlineValue(lineage: MetricLineage, formatters: LineageFormatters): string {
  if (lineage.metric === "runwayMonths") return formatters.formatRunway(lineage.value);
  return lineage.value === null ? "—" : formatters.formatMoney(lineage.value);
}

function renderAssumptions(lineage: MetricLineage, formatters: LineageFormatters): string {
  if (lineage.assumptions.length === 0) return "";
  const items = lineage.assumptions
    .map((assumption) => {
      const value =
        typeof assumption.value === "number"
          ? formatters.formatMoney(assumption.value)
          : assumption.value;
      return `
        <li class="bw-lineage__assumption">
          <span class="bw-lineage__assumption-label">${escapeHtml(assumption.label)}</span>
          <span class="bw-lineage__assumption-value">${escapeHtml(value)}</span>
          <span class="bw-lineage__assumption-source">${escapeHtml(assumption.source)}</span>
        </li>
      `;
    })
    .join("");
  return `
    <div class="bw-lineage__assumptions">
      <span class="bw-lineage__section-label">Assumptions</span>
      <ul class="bw-lineage__assumption-list">${items}</ul>
    </div>
  `;
}

function renderEvidence(lineage: MetricLineage, formatters: LineageFormatters): string {
  // Calc-tree archetype (runway, net cash) takes precedence: it explains the math.
  if (lineage.derived) return renderCalcTree(lineage, lineage.derived, formatters);
  // Direct-rows archetype (revenue, outflow): the rows are the evidence.
  if (lineage.direct.length > 0) return renderRowsTable(lineage.direct, formatters);
  return `<p class="bw-lineage__empty">No contributing rows in the current import.</p>`;
}

function renderCalcTree(
  lineage: MetricLineage,
  root: CalcNode,
  formatters: LineageFormatters
): string {
  // The root value is the metric headline (may be non-money, e.g. runway months);
  // every descendant in the A1 trees is monetary.
  const children = root.children ?? [];
  const childrenHtml = children
    .map((child) => renderCalcNode(child, formatters))
    .join("");
  return `
    <div class="bw-lineage__tree-wrap">
      <span class="bw-lineage__section-label">How it is calculated</span>
      <ul class="bw-lineage__tree">
        <li class="bw-lineage__node bw-lineage__node--root">
          <span class="bw-lineage__node-op">${escapeHtml(OP_LABELS[root.op])}</span>
          <span class="bw-lineage__node-label">${escapeHtml(root.label)}</span>
          <span class="bw-lineage__node-value">${escapeHtml(renderHeadlineValue(lineage, formatters))}</span>
          ${childrenHtml ? `<ul class="bw-lineage__tree">${childrenHtml}</ul>` : ""}
        </li>
      </ul>
    </div>
  `;
}

function renderCalcNode(node: CalcNode, formatters: LineageFormatters): string {
  // A leaf node that owns rows (e.g. a monthly outflow bucket) becomes an
  // expandable disclosure: the summary shows the count, expanding reveals the
  // underlying rows that foot to the node value. Keyboard-native via <details>.
  const rowsNote = node.rows && node.rows.length > 0
    ? `<details class="bw-lineage__node-rows">
        <summary class="bw-lineage__node-rows-summary">${escapeHtml(`${node.rows.length} row${node.rows.length === 1 ? "" : "s"}`)}</summary>
        ${renderBucketRows(node.rows, formatters)}
      </details>`
    : "";
  const childrenHtml = node.children && node.children.length > 0
    ? `<ul class="bw-lineage__tree">${node.children.map((child) => renderCalcNode(child, formatters)).join("")}</ul>`
    : "";
  return `
    <li class="bw-lineage__node">
      <span class="bw-lineage__node-op">${escapeHtml(OP_LABELS[node.op])}</span>
      <span class="bw-lineage__node-label">${escapeHtml(node.label)}</span>
      <span class="bw-lineage__node-value">${escapeHtml(formatters.formatMoney(node.value))}</span>
      ${rowsNote}
      ${childrenHtml}
    </li>
  `;
}

function renderBucketRows(rows: RowRef[], formatters: LineageFormatters): string {
  const items = rows
    .map(
      (row) => `
        <li class="bw-lineage__bucket-row">
          <span class="bw-lineage__bucket-date">${escapeHtml(row.dateISO)}</span>
          <span class="bw-lineage__bucket-head">${escapeHtml(row.head)}</span>
          <span class="bw-lineage__bucket-amount">${escapeHtml(formatters.formatMoney(row.amount))}</span>
        </li>
      `
    )
    .join("");
  return `<ul class="bw-lineage__bucket-rows">${items}</ul>`;
}

function renderRowsTable(rows: RowRef[], formatters: LineageFormatters): string {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td class="bw-lineage__cell">${escapeHtml(row.dateISO)}</td>
          <td class="bw-lineage__cell">${escapeHtml(row.head)}</td>
          <td class="bw-lineage__cell">${escapeHtml(row.flow)}</td>
          <td class="bw-lineage__cell bw-lineage__cell--amount">${escapeHtml(formatters.formatMoney(row.amount))}</td>
        </tr>
      `
    )
    .join("");
  return `
    <div class="bw-lineage__rows-wrap">
      <span class="bw-lineage__section-label">Contributing rows (${rows.length})</span>
      <table class="bw-lineage__rows">
        <thead>
          <tr>
            <th class="bw-lineage__cell">Date</th>
            <th class="bw-lineage__cell">Head</th>
            <th class="bw-lineage__cell">Flow</th>
            <th class="bw-lineage__cell bw-lineage__cell--amount">Amount</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderExcluded(lineage: MetricLineage): string {
  if (lineage.excluded.length === 0) return "";
  const items = lineage.excluded
    .map(
      (exclusion) => `
        <li class="bw-lineage__excluded-item">
          <span class="bw-lineage__excluded-id">${escapeHtml(exclusion.id)}</span>
          <span class="bw-lineage__excluded-reason">${escapeHtml(exclusion.reason)}</span>
          <span class="bw-lineage__excluded-confidence">${escapeHtml(exclusion.confidence)}</span>
        </li>
      `
    )
    .join("");
  return `
    <div class="bw-lineage__excluded">
      <span class="bw-lineage__section-label">Excluded</span>
      <ul class="bw-lineage__excluded-list">${items}</ul>
    </div>
  `;
}
