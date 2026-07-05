---
name: demoing-work
description: Use when implementation work is complete and automated checks (tests, verify, verification-before-completion) pass, before telling the user the work is done. Walks the user through the golden path and relevant edge cases live, then gates completion on the user's explicit confirmation rather than self-declaring the work finished. Use for both UI-facing changes (demo live in the app) and non-UI changes (narrated CLI/API walkthrough).
---

# Demoing Work to the User

Automated checks (`verify`, `verification-before-completion`, test suites) confirm the code does what it's supposed to. This skill is the step after that: getting an actual human to look at the result and say yes before the work counts as done. Automated passing tests are necessary but not sufficient — a human should see the feature work.

## When to use this

After finishing a feature or bugfix and its automated verification passes, before saying "done", before committing to a shared branch, before opening a PR. Not a substitute for `verify`/`verification-before-completion` — run those first; this comes after.

## Process

1. **Start the app** (or identify how the change is exercised, for non-UI changes). Use whatever this project's normal run/dev-server command is.
2. **State briefly what changed** — one or two sentences, not a changelog.
3. **Walk through the golden path and relevant edge cases**:
   - **UI-facing changes**: drive it live. Use the Playwright MCP browser tools (`browser_navigate`, `browser_snapshot`, `browser_click`, etc. — see the `playwright-testing` skill, and its `playwright-runner` subagent, for the mechanics) to show the feature working, or tell the user exactly what to click in their own browser if they'd rather try it themselves.
   - **Non-UI changes** (CLI, API, backend logic): narrate the walkthrough with real command output or API responses — actually run the command and show the result, don't describe what it would do.
   - Cover at least one edge case relevant to the change, not just the happy path — that's usually where regressions hide.
4. **Ask for explicit confirmation.** Use `AskUserQuestion` (or a direct question if the tool isn't available) — something like "Does this look right?" or "Does this match what you expected?" — and wait for the answer.
5. **Gate completion on the answer.** If the user confirms, the work is done. If they don't, treat their feedback as new requirements and keep iterating — don't argue that the automated tests already passed.

## What "done" means here

Claude does not get to unilaterally decide a user-facing change is complete. A green test suite is evidence to bring to the demo, not a replacement for it. Never write "this is complete" or similar to the user before this human-confirmation step has actually happened in the conversation.

## Edge cases

**Non-interactive/headless environment (no user available synchronously):** If the user is not present to respond in real time (e.g. an autonomous/background run), capture screenshots or a short recorded walkthrough as an artifact and present it for asynchronous review — but still explicitly ask for confirmation before considering the work closed out, rather than declaring success unreviewed.

**Small/low-risk changes:** The demo can be proportionally short — a one-line confirmation question with a single screenshot is fine for a copy tweak. Scale the depth of the walkthrough to the size of the change, not a fixed ritual.

**Change has no observable behavior difference (e.g. pure refactor):** Say so plainly instead of forcing a demo — confirm via the automated checks and a brief explanation of what was restructured, and note there's nothing new to visually demo.
