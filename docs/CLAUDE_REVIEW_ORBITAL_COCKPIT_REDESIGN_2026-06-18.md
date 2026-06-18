# Claude Review: Orbital Cash Cockpit Redesign

Date: 2026-06-18  
Owner: Codex  
Status: Uncommitted, ready for design/code review

## Review Goal

Review the first full visual redesign pass for Billu.Works Finance Dashboard V2.

The app was previously a calm white/soft-green dashboard. The new direction is an **orbital cash cockpit**: dark graphite, warm ivory readouts, cyan signal lines, amber caution states, coral review states, and dense accountant-grade instrumentation.

This is not meant to be generic neon AI gloss. It should feel like a creative operator built a serious auditable finance cockpit.

## Visual North Star

New generated reference:

- `docs/design-references/orbital-cash-cockpit-concept.png`

Updated reference doc:

- `docs/DESIGN_REFERENCES.md`

Core phrase:

> Functional sci-fi, accountant-legible, no purple AI slop, no white slab.

## Files Changed

Primary implementation:

- `src/styles.css`
  - Replaced light soft-finance tokens with dark cockpit tokens.
  - Added an "Orbital cockpit visual pass" layer near the end of the stylesheet.
  - Restyled shell, hero, import panels, mapping review, cockpit KPI tiles, readiness widget, filters, exports, settings, budget, forecast, tables, diagnostics, transaction detail, and lineage drawer.
  - Added mobile fixes after screenshot QA caught hero/action rail overlap.

- `src/ui/app-shell.ts`
  - Repositioned first-run copy from "private import foundation" toward "auditable cash cockpit".
  - Privacy remains explicit but no longer owns the whole story.

- `docs/DESIGN_REFERENCES.md`
  - Updated design direction from "soft financial cockpit" to "orbital cash cockpit".
  - Preserved the older soft-widget references as density/calm references, not the main direction.

- `docs/design-references/orbital-cash-cockpit-concept.png`
  - Generated image reference for future agents.

## Unrelated Dirty Tree Items

Do not review or clean these as part of this pass unless explicitly asked:

- `.claude/`
- `mcps/`
- `src/finance/__snapshots__/audit-derive.test.ts.snap`
- `docs/CLAUDE_CATCHUP_2026-06-16.md`
- `docs/GROK_COMPOSER_2_5_POST_SHIP_QA_BATCH_2026-06-18.md`

The redesign should be reviewed as its own slice.

## Verification Already Run

All green after the redesign:

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npx vitest run` | 520 passed |
| `npm run build` | Pass |
| `npx playwright test --workers=1` | 26 passed |
| `git diff --check` | Clean, only CRLF warnings |

Manual screenshot QA was also done for:

- first-run welcome/import state
- sample CSV mapping review
- imported dashboard cockpit
- mobile first-run layout

The first mobile pass had hero overlap; Codex fixed it by restoring one-column hero behavior under `780px`.

## Review Checklist

Please review with a design + product lens first, then code quality second.

1. **Does it feel like Billu.Works?**
   - Sci-fi cockpit, but still local-first and accountant-trustworthy.
   - Serious, creative, useful; not toy neon, not generic SaaS dark mode.

2. **Is it accountant-legible?**
   - Tables, inputs, mapping controls, rejected rows, audit drawers, and export controls must stay readable.
   - Do not sacrifice trust/readability for visual flair.

3. **Does the hierarchy work?**
   - Hero should be punchy but not bury the workflow.
   - Cockpit KPIs should feel primary.
   - Filters/settings/forecast should be dense but not visually lost.

4. **Check mobile ergonomics.**
   - First-run hero and action rail should stack cleanly.
   - KPI tiles, lineage drawers, mapping review, and transaction tables should remain usable.
   - Watch for text clipping inside buttons or narrow inputs.

5. **Check visual consistency.**
   - Cyan = signal/ready/action.
   - Amber = caution/non-operating/apply.
   - Coral = review/danger.
   - Ivory = main readouts.
   - Avoid accidental one-note green/cyan mud.

6. **Check CSS maintainability.**
   - The redesign is currently a late stylesheet layer to avoid refactoring renderers.
   - Decide whether that is acceptable for this phase, or whether a follow-up should consolidate tokens/classes.
   - Do not do a giant CSS cleanup in the review unless it is necessary to fix a real defect.

## Suggested Manual QA Script

Run locally:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Then:

1. Open `http://127.0.0.1:5173/`.
2. Inspect first-run state at desktop width.
3. Click `Agency` sample.
4. Inspect mapping review screen.
5. Click `Apply Mapping`.
6. Inspect full dashboard.
7. Open at mobile width or Playwright mobile viewport.
8. Click KPI drawers/readiness drawer and confirm no layout overlap.
9. Try export/settings/forecast sections visually.

Optional screenshot script:

```powershell
@'
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.locator('[data-bw-sample-path="/sample-agency.csv"]').click();
await page.waitForSelector('#apply-mapping');
await page.screenshot({ path: 'claude-redesign-mapping.png', fullPage: true });
await page.locator('#apply-mapping').click();
await page.waitForSelector('.bw-cockpit');
await page.screenshot({ path: 'claude-redesign-dashboard.png', fullPage: true });
const mobile = await browser.newPage({ viewport: { width: 390, height: 1200 }, isMobile: true });
await mobile.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await mobile.screenshot({ path: 'claude-redesign-mobile.png', fullPage: true });
await browser.close();
'@ | node
```

## Optional: Fold In Post-Ship QA

Codex also prepared a Grok QA batch:

- `docs/GROK_COMPOSER_2_5_POST_SHIP_QA_BATCH_2026-06-18.md`

If you have time after the redesign review, treat that doc as a secondary QA checklist. The highest-value parts to combine with this visual review are:

1. Full trust workflow manual QA.
2. Export integrity spot-check after the redesign.
3. Vault consistency audit.

Do not start new product features from that QA doc. The current mission is review, observations, and targeted fixes only.

## Suggested Output

Please come back with:

1. Blocking issues, if any.
2. Non-blocking polish observations.
3. Any recommended CSS/structure cleanup.
4. Whether this is good enough to commit as a first visual pass.
5. If you made edits, list the files and rerun the relevant gates.

Suggested review doc if you write one:

- `docs/CLAUDE_OBSERVATIONS_ORBITAL_COCKPIT_REDESIGN_2026-06-18.md`

