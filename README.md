# Billu.Works Finance Dashboard V2

This repo is the new dashboard workspace for the Billu.Works privacy-first finance tool.

## Product Direction

Build a useful local-first finance dashboard for freelancers, consultants, solo founders, small agencies, and small companies.

Core promise:

- Import CSV and Excel files locally.
- Keep transaction data in the browser by default.
- No AI pushed into the main workflow.
- No account required for the free tool.
- Clear formulas and auditable calculations.
- Practical enough for a solo pro, credible enough for accountant review.

## Relationship To V1

V1 lives in `cfo-flightdeck-dashboard` and remains the stable dashboard that can update the current Vercel deployment.

V2 should borrow proven ideas from V1 intentionally:

- CSV/Excel parsing and mapping approach
- finance calculation tests
- cash runway model
- 13-week forecast concept
- data-quality warnings
- privacy copy
- export/reviewer workflow

V2 can also learn from `Sagargupta16/Financial-Dashboard`, but should not merge that repo history or copy large code blocks blindly.

## First Build Rule

Do not start by merging apps. Start by defining the finance model, import model, and privacy promise, then bring over working modules one by one with tests.

See `docs/BILLU_WORKS_V2_ROADMAP.md`.
