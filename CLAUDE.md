# Project Guidance

## Vault Rule

Keep the project vault up to date in every working session.

- At the end of any meaningful dashboard session, update or add a `docs/SESSION_HANDOFF_YYYY-MM-DD.md` handoff note before calling the work done.
- The handoff must include current git state, what changed, verification run, and the first next-session priorities.
- If a gstack checkpoint is also created, link or name it in the handoff note.
- Do not rely only on chat history, commits, or gstack checkpoints; the in-repo docs are the durable project vault.

## Chrome Tab Rule

When the user asks to inspect, coordinate with, or take over an already-open Chrome tab, use the Codex Chrome Extension through the Chrome skill first.

- Claim the existing tab via the extension session and interact through `tab.playwright` / browser runtime tooling.
- Do not use Windows SendKeys, clipboard relays, screen-coordinate clicking, screenshot-only workflows, or other ad hoc browser-control workarounds unless the Chrome Extension path has actually failed after a proper check.
- This matters most for Claude Design / browser-collaboration sessions, where the user expects Codex to work directly in the open Chrome tab.

## Design System

Always read `DESIGN.md` before making visual or UI decisions.

All font choices, colors, spacing, surface treatment, and aesthetic direction are defined there. Do not deviate without explicit user approval. In QA or review mode, flag UI code that does not match `DESIGN.md`.
