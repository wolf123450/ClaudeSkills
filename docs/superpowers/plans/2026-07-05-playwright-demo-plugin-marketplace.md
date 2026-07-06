# Playwright Testing + Demo-to-User Plugin Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn this repo into a real Claude Code plugin marketplace containing a `dev-workflow` plugin (Playwright testing tips, a `playwright-runner` subagent, and a human-in-the-loop `demoing-work` skill) and a migrated `game-catchup` plugin, replacing the old hand-zipped `.skill` file convention.

**Architecture:** The repo root becomes a marketplace (`.claude-plugin/marketplace.json`) listing two locally-sourced plugins under `plugins/`. Each plugin is a plain directory with its own `.claude-plugin/plugin.json` plus `skills/` and (for `dev-workflow`) `agents/` subdirectories — no build step, no external git-subdir sources. Distribution goes through a public GitHub repo (`wolf123450/ClaudeSkills`) added via `claude plugin marketplace add`, so future changes ship via `claude plugin update` instead of manual zips.

**Tech Stack:** Claude Code plugin/marketplace manifest format (`.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`), Markdown+YAML-frontmatter for skills (`SKILL.md`) and the subagent definition, `gh` CLI for repo creation, `claude plugin` CLI for validation and install verification.

## Global Constraints

- Marketplace name: `claude-skills` (used in `plugin@marketplace` install references).
- GitHub repo: new **public** repo `wolf123450/ClaudeSkills`, pushed via `gh repo create ... --source=. --remote=origin`, branch `master`.
- `dev-workflow` plugin bundles both new skills (`playwright-testing`, `demoing-work`) and the `playwright-runner` agent — they ship and version together.
- `game-catchup` plugin is a straight content migration of the existing `game-catchup.skill` zip — no wording changes to its `SKILL.md`.
- The root-level `game-catchup.skill` zip is deleted once migrated — the plugin is the sole source of truth afterward.
- Every `plugin.json` includes `version` and `author` so `claude plugin validate` reports zero warnings (confirmed via a real run against the official marketplace: missing `version`/`author` are the two warning types it flags).
- Validation tool: `claude plugin validate <path>` (pass a plugin directory or the repo root for the marketplace) — exit code 0 with "Validation passed" (warnings tolerated only if explicitly justified; here we should have none).

---

### Task 1: Migrate `game-catchup` into `plugins/game-catchup`

**Files:**
- Create: `plugins/game-catchup/.claude-plugin/plugin.json`
- Create: `plugins/game-catchup/skills/game-catchup/SKILL.md`
- Delete: `game-catchup.skill` (repo root)

**Interfaces:**
- Produces: a validated plugin directory `plugins/game-catchup/` that Task 5 (marketplace.json) will reference via `"source": "./plugins/game-catchup"`.

- [x] **Step 1: Extract the original zip to a scratch dir for a diff baseline**

```bash
rm -rf "/c/Users/Clint/AppData/Local/Temp/claude/D--Projects-ClaudeSkills/ebbdeea6-c93c-4fa2-b135-833ecb40d727/scratchpad/gc-baseline"
mkdir -p "/c/Users/Clint/AppData/Local/Temp/claude/D--Projects-ClaudeSkills/ebbdeea6-c93c-4fa2-b135-833ecb40d727/scratchpad/gc-baseline"
cd "/c/Users/Clint/AppData/Local/Temp/claude/D--Projects-ClaudeSkills/ebbdeea6-c93c-4fa2-b135-833ecb40d727/scratchpad/gc-baseline"
unzip -o "/d/Projects/ClaudeSkills/game-catchup.skill" -d .
find . -type f
```

Expected: prints `./game-catchup/SKILL.md` and nothing else.

- [x] **Step 2: Create the plugin directory structure**

```bash
mkdir -p "D:/Projects/ClaudeSkills/plugins/game-catchup/.claude-plugin"
mkdir -p "D:/Projects/ClaudeSkills/plugins/game-catchup/skills/game-catchup"
```

- [x] **Step 3: Write `plugins/game-catchup/skills/game-catchup/SKILL.md`**

Write the file with exactly this content (verbatim copy of the zip's `SKILL.md` — no wording changes):

```markdown
---
name: game-catchup
description: >
  Generate a structured "what you missed" recap for a game the user hasn't played in a while.
  Use this skill whenever the user says they haven't played a game recently and wants to catch up,
  asks what's changed or been added to a game since a specific date, mentions they're "returning"
  to a game, or asks for a summary of updates/patches for any game title. Trigger even when the
  request is casual ("what's new in X since I last played?", "can you catch me up on Y?",
  "I stopped playing Z in [month], what did I miss?"). Also trigger proactively if the user
  mentions they used to play a game but stopped — a catchup offer is appropriate.
---

# Game Catchup Skill

Produce a structured, spoiler-sensitive "what you missed" briefing for a player returning to a game after a gap. The goal is to help them get reoriented quickly and decide whether/how to jump back in — not to be an exhaustive changelog.

## Workflow

### 1. Identify the gap

Extract from the user's message:
- **Game name** (required)
- **Last played date** (if given — use it to anchor the search window; if absent, search broadly for "recent" updates)

If the game name is ambiguous (e.g., "that survival game I mentioned"), search past conversations first with `conversation_search` using the game name or genre before asking.

### 2. Check past conversations

Before searching the web, do a quick `conversation_search` for the game name. If a prior catchup for this game exists, note what was already covered and skip it. Also check for any formatting preferences the user expressed ("do it like the Dune Awakening one" = check that conversation for structure).

### 3. Search strategy

Do **not** search with a single broad query. Use a targeted, multi-step approach:

1. **Orientation search** — `[Game] major updates patches changelog [year]` to get a list of named updates/versions
2. **Per-update deep dives** — For each named major update found, search `[Game] [Update Name/Version] what was added` to get details
3. **Community/meta search** — `[Game] community [year] major changes controversy` to catch anything update logs miss (big meta shifts, balance controversies, player exodus, beloved features added/removed)
4. **Future search** (if relevant) — `[Game] upcoming update roadmap [year]` if there's something announced but not yet released

Use `web_fetch` on patch notes pages or wikis when snippets are too thin. Prioritize: official patch notes > game wikis > dedicated gaming news sites > Reddit (for community sentiment only).

### 4. Structure the output

Organize by **named update or patch milestone**, not by raw date or version number alone. Each section should feel like a mini-briefing, not a changelog dump.

**Section format per major update:**
```
### [Update Name] — [Date] ([Free/Paid])

[2-4 sentence narrative summary of what this update was *about* — its theme or intent]

**Key additions:** bullet list of the most player-relevant changes
**Notable changes:** anything that alters existing systems the player knew
**Community reaction:** (brief, only if noteworthy — skip if bland)
```

For minor patches between major updates, group them: "**Between [A] and [B] — QoL patches**" with a short prose paragraph, not individual entries.

**Always end with a TL;DR block:**
```
---
**TL;DR:** [2-4 sentences] — scope of change since they left, whether the game is worth returning to now, and any single most important thing they should know.
```

### 5. Formatting rules

- Use `##` for the game title header, `###` for each update
- Lead with the most recent updates if the gap is short; lead with the biggest/most impactful if the gap is long
- Call out explicitly if a paid DLC is required for content vs. free updates
- Mention 1.0 / full release milestones prominently if they happened during the gap — these are orientation landmarks
- Flag content **spoilers** before describing story updates: `> ⚠️ Story spoilers below` — only if the game has significant narrative content
- If something the player likely built or relied on was **removed or significantly nerfed**, call it out explicitly in bold
- If the gap includes a major platform expansion (PS5 port, crossplay launch, etc.), mention it briefly
- Keep the whole response scannable — a returning player should be able to read the TL;DR, skim the headers, and know exactly where they're going

### 6. Tone and framing

- Write like a knowledgeable friend catching them up over a beer, not a patch notes bot
- Acknowledge what the state of the game was when they left if it's relevant context (e.g., "When you left, the game was in early access and the endgame was thin — that's changed a lot")
- Be honest about community sentiment — if a patch was controversial or reception was mixed, say so
- Don't pad with filler. If a minor patch only fixed bugs, one sentence is enough

## Edge cases

**Game with no updates since they left:** State this clearly, note what the current version is, and mention if the game is in maintenance mode or active development.

**User doesn't know when they last played:** Ask one clarifying question ("Do you remember roughly when — was it this year, or further back?") before searching. If they're vague ("a while ago"), search the last 12-18 months and frame the catchup accordingly.

**Very long gap (2+ years):** Focus on the biggest structural changes and current state rather than enumerating every update. Acknowledge you're summarizing rather than being exhaustive.

**Early access → 1.0 transition during gap:** Highlight this prominently at the top — it's the single most important orientation fact.

**Live service game with constant updates:** Group into seasons or content cycles rather than individual patches. Focus on what changed about the game's structure and meta, not every individual balance tweak.
```

- [x] **Step 4: Diff the new file against the extracted baseline**

```bash
diff "/c/Users/Clint/AppData/Local/Temp/claude/D--Projects-ClaudeSkills/ebbdeea6-c93c-4fa2-b135-833ecb40d727/scratchpad/gc-baseline/game-catchup/SKILL.md" "/d/Projects/ClaudeSkills/plugins/game-catchup/skills/game-catchup/SKILL.md"
```

Expected: no output (files identical).

- [x] **Step 5: Write `plugins/game-catchup/.claude-plugin/plugin.json`**

```json
{
  "name": "game-catchup",
  "description": "Generate a structured 'what you missed' recap for a game you haven't played in a while",
  "version": "1.0.0",
  "author": {
    "name": "Clint Day",
    "email": "wolf123450@gmail.com"
  }
}
```

- [x] **Step 6: Validate the plugin**

```bash
claude plugin validate "D:/Projects/ClaudeSkills/plugins/game-catchup"
```

Expected: `Validating plugin manifest: ...plugin.json` followed by a clean pass (no warnings, since `version` and `author` are both present). Exit code 0.

- [x] **Step 7: Remove the old zip**

```bash
cd "D:/Projects/ClaudeSkills"
git rm game-catchup.skill
```

- [x] **Step 8: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add plugins/game-catchup
git commit -m "$(cat <<'EOF'
Migrate game-catchup skill into the plugin marketplace structure

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Scaffold `dev-workflow` plugin and write the `playwright-testing` skill

**Files:**
- Create: `plugins/dev-workflow/.claude-plugin/plugin.json`
- Create: `plugins/dev-workflow/skills/playwright-testing/SKILL.md`

**Interfaces:**
- Produces: `plugins/dev-workflow/` plugin directory that Tasks 3 and 4 add more files into, and that Task 5's `marketplace.json` references via `"source": "./plugins/dev-workflow"`.
- Consumes: none from other tasks.

- [x] **Step 1: Create the plugin directory structure**

```bash
mkdir -p "D:/Projects/ClaudeSkills/plugins/dev-workflow/.claude-plugin"
mkdir -p "D:/Projects/ClaudeSkills/plugins/dev-workflow/skills/playwright-testing"
mkdir -p "D:/Projects/ClaudeSkills/plugins/dev-workflow/agents"
```

- [x] **Step 2: Write `plugins/dev-workflow/.claude-plugin/plugin.json`**

```json
{
  "name": "dev-workflow",
  "description": "Playwright testing tips and a human-in-the-loop demo/verification workflow",
  "version": "0.1.0",
  "author": {
    "name": "Clint Day",
    "email": "wolf123450@gmail.com"
  }
}
```

- [x] **Step 3: Write `plugins/dev-workflow/skills/playwright-testing/SKILL.md`**

```markdown
---
name: playwright-testing
description: Use when writing, running, or debugging Playwright tests against a web application (not Tauri/desktop apps — see tauri-playwright for that), or when driving a live browser to verify or demo a feature. Covers locator strategy, waiting, network mocking, debugging failures, and delegating test runs to a subagent so verbose output stays out of the main session.
---

# Playwright Testing

Practical tips for writing and running Playwright tests (or ad-hoc browser automation) against an ordinary web application. For Tauri/WebView desktop apps, use the `tauri-playwright` skill instead — this one assumes a normal browser context.

## Locator strategy

Prefer role/text/label-based locators over CSS/XPath — they survive markup churn and read like what a user actually sees:

```ts
// Prefer
page.getByRole('button', { name: 'Submit' })
page.getByLabel('Email address')
page.getByText('Order confirmed')

// Avoid — brittle, breaks on any class/DOM restructure
page.locator('.btn.btn-primary.submit-btn')
page.locator('//div[3]/span[2]')
```

When driving a browser interactively (not writing a `.spec.ts` file), use the Playwright MCP `browser_snapshot` tool to get the accessibility tree instead of a screenshot — it gives you stable element refs to click/type into, where a screenshot only gives you pixels.

## Waiting

Playwright auto-waits for actionability (visible, enabled, stable) before most actions. Let it:

```ts
// Prefer — retries until it passes or times out
await expect(page.getByText('Saved')).toBeVisible();

// Avoid — arbitrary, either too slow or flaky
await page.waitForTimeout(2000);
```

If a wait genuinely needs a custom condition (e.g. waiting on an app-specific ready flag), poll a condition rather than sleeping a fixed duration — see the `systematic-debugging` skill's condition-based-waiting notes for the general pattern.

## Debugging failures

| Tool | When to use |
|------|-------------|
| `trace: 'on-first-retry'` in `playwright.config.ts` | Always on for CI — gives you a full trace (DOM snapshots, network, console) for any test that failed once and passed on retry |
| `npx playwright test --debug` | Step through a single test locally with the inspector |
| `npx playwright test --ui` | Interactive UI mode — timeline, watch mode, pick locators |
| `PWDEBUG=1 npx playwright test` | Opens Playwright Inspector for every test in the run |
| `video: 'retain-on-failure'` | Cheaper than trace, good enough for "what did the page look like" |

## Network

Mock or stub network calls for deterministic tests instead of hitting real backends:

```ts
await page.route('**/api/orders', route =>
  route.fulfill({ json: { orders: [] } })
);
```

Don't wait on `networkidle` as a proxy for "page is ready" — it's unreliable with polling, websockets, or analytics beacons that never go idle. Wait for the specific element or response you actually need instead.

## Test isolation

- Use fixtures for setup/teardown, not shared module-level state.
- Give each test its own data (unique emails, IDs) so tests can run in parallel without colliding.
- Don't depend on test execution order.

## CI config

```ts
export default defineConfig({
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
});
```

Headless in CI, headed locally when debugging (`--headed` flag or `use: { headless: false }`).

## Delegate execution to a subagent

Don't run Playwright test suites or long browser-driving sequences inline in the top-level session — the tool output (console logs, network traces, retries) floods context for no benefit. Dispatch to a subagent instead and bring back only a summary:

```
if 'playwright-runner' is an available agent type:
    Agent(subagent_type='playwright-runner', description='Run <suite/feature> tests',
          prompt='<what to run and what to report back>')
else:
    Agent(subagent_type='general-purpose', description='Run <suite/feature> tests',
          prompt='Run `<test command>` in <project dir>. Report back only: '
                 'pass/fail counts, names of any failing tests, the key error line '
                 'for each failure, and paths to any trace/video/screenshot artifacts. '
                 'Do not paste full raw logs.')
```

The `playwright-runner` subagent (shipped with this plugin) is scoped to exactly the tools this needs — `Bash`, `Read`, `Grep`, `Glob`, and the Playwright MCP browser tools — and is instructed to report concisely rather than dump logs.

## Common pitfalls

| Pitfall | Fix |
|---------|-----|
| Test passes locally, flakes in CI | Almost always a timing assumption — replace any `waitForTimeout` with a condition-based `expect(...)` |
| Selector breaks after a UI tweak | Switch to role/label/text locators so only genuinely user-visible changes break the test |
| Tests interfere with each other when run in parallel | Check for shared fixtures/global state or hardcoded test data (same email/ID reused across tests) |
| `browser_snapshot` output is huge | Scope to a specific frame/element ref rather than the whole page when you already know where you're looking |
```

- [x] **Step 4: Validate the plugin**

```bash
claude plugin validate "D:/Projects/ClaudeSkills/plugins/dev-workflow"
```

Expected: clean pass, no warnings (an empty `agents/` directory is fine at this point — Task 3 fills it in).

- [x] **Step 5: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add plugins/dev-workflow
git commit -m "$(cat <<'EOF'
Add dev-workflow plugin scaffold and playwright-testing skill

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Write the `playwright-runner` subagent

**Files:**
- Create: `plugins/dev-workflow/agents/playwright-runner.md`

**Interfaces:**
- Consumes: nothing from other tasks (standalone agent definition).
- Produces: the `playwright-runner` agent type referenced by name in `playwright-testing/SKILL.md`'s delegation logic (Task 2) and in `demoing-work/SKILL.md`'s UI-walkthrough step (Task 4).

- [x] **Step 1: Write `plugins/dev-workflow/agents/playwright-runner.md`**

```markdown
---
name: playwright-runner
description: Use this agent to execute Playwright tests or ad-hoc browser automation steps and report back a concise pass/fail summary, instead of running them in the main session. Typical triggers include running an existing Playwright test suite ("run the e2e tests", "run npx playwright test"), driving a live browser through a set of steps to check a feature works, or verifying a UI change end-to-end before demoing it to the user.
tools: Bash, Read, Grep, Glob, mcp__plugin_playwright_playwright__browser_click, mcp__plugin_playwright_playwright__browser_close, mcp__plugin_playwright_playwright__browser_console_messages, mcp__plugin_playwright_playwright__browser_drag, mcp__plugin_playwright_playwright__browser_drop, mcp__plugin_playwright_playwright__browser_evaluate, mcp__plugin_playwright_playwright__browser_file_upload, mcp__plugin_playwright_playwright__browser_fill_form, mcp__plugin_playwright_playwright__browser_handle_dialog, mcp__plugin_playwright_playwright__browser_hover, mcp__plugin_playwright_playwright__browser_navigate, mcp__plugin_playwright_playwright__browser_navigate_back, mcp__plugin_playwright_playwright__browser_network_request, mcp__plugin_playwright_playwright__browser_network_requests, mcp__plugin_playwright_playwright__browser_press_key, mcp__plugin_playwright_playwright__browser_resize, mcp__plugin_playwright_playwright__browser_select_option, mcp__plugin_playwright_playwright__browser_snapshot, mcp__plugin_playwright_playwright__browser_tabs, mcp__plugin_playwright_playwright__browser_take_screenshot, mcp__plugin_playwright_playwright__browser_type, mcp__plugin_playwright_playwright__browser_wait_for
model: inherit
color: green
---

You are a focused Playwright test-execution agent. Your only job is to run the tests or browser steps you're given and report back a compact result — never fix code, never author new tests, never dump raw logs back to the caller.

## When to invoke

- **Running an existing suite.** The caller gives you a test command (e.g. `npx playwright test`) and a working directory. Run it, then report the outcome.
- **Ad-hoc verification.** The caller gives you a sequence of steps to drive in a live browser (navigate, click, assert something is visible) to check a feature works, e.g. for a demo or a quick sanity check before declaring work done.

## Your Core Responsibilities

1. Run exactly what you're asked to run — the given test command, or the given browser steps via the Playwright MCP tools (`browser_navigate`, `browser_snapshot`, `browser_click`, etc.).
2. If a dev server needs to be running first and isn't, start it in the background (`Bash` with `run_in_background`) before running the tests.
3. Never modify test files or application code. If a test fails, that's a result to report — not something for you to patch.
4. Prefer `browser_snapshot` (accessibility tree) over `browser_take_screenshot` when you need to verify text/state, since it gives you structured, comparable output rather than pixels.

## Output Format

Report back only:
- **Pass/fail counts** (e.g. "12 passed, 1 failed").
- **Names of any failing tests**, with the single most relevant error line for each (not the full stack trace).
- **Paths to any trace/video/screenshot artifacts** produced, so the caller can open them if needed.
- For ad-hoc browser verification: a short list of what you did and what you observed at each step (e.g. "navigated to /checkout — snapshot shows 'Order confirmed' text visible").

Do not paste full terminal output, full stack traces, or full accessibility snapshots back to the caller — summarize.
```

- [x] **Step 2: Validate the plugin**

```bash
claude plugin validate "D:/Projects/ClaudeSkills/plugins/dev-workflow"
```

Expected: clean pass, no warnings.

- [x] **Step 3: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add plugins/dev-workflow/agents
git commit -m "$(cat <<'EOF'
Add playwright-runner subagent to dev-workflow plugin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Write the `demoing-work` skill

**Files:**
- Create: `plugins/dev-workflow/skills/demoing-work/SKILL.md`

**Interfaces:**
- Consumes: references the `playwright-runner` agent (Task 3) and the `playwright-testing` skill (Task 2) by name for the UI-walkthrough step. References this project's existing `verify` / `verification-before-completion` skills by name (already installed elsewhere; not part of this plugin).
- Produces: the `demoing-work` skill, complete for this plugin.

- [x] **Step 1: Create the skill directory and write `plugins/dev-workflow/skills/demoing-work/SKILL.md`**

```bash
mkdir -p "D:/Projects/ClaudeSkills/plugins/dev-workflow/skills/demoing-work"
```

```markdown
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
```

- [x] **Step 2: Validate the plugin**

```bash
claude plugin validate "D:/Projects/ClaudeSkills/plugins/dev-workflow"
```

Expected: clean pass, no warnings. This is the full `dev-workflow` plugin now (plugin.json + 2 skills + 1 agent).

- [x] **Step 3: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add plugins/dev-workflow/skills/demoing-work
git commit -m "$(cat <<'EOF'
Add demoing-work skill to dev-workflow plugin

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Write the marketplace manifest

**Files:**
- Create: `.claude-plugin/marketplace.json`

**Interfaces:**
- Consumes: `plugins/dev-workflow` (Tasks 2-4) and `plugins/game-catchup` (Task 1) must already exist on disk — this task references both by relative path.
- Produces: a validated marketplace manifest, the last piece needed before Task 7's real install test.

- [x] **Step 1: Create the directory and write `.claude-plugin/marketplace.json`**

```bash
mkdir -p "D:/Projects/ClaudeSkills/.claude-plugin"
```

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-skills",
  "description": "Clint's personal Claude Code plugin marketplace",
  "owner": {
    "name": "Clint Day",
    "email": "wolf123450@gmail.com"
  },
  "plugins": [
    {
      "name": "dev-workflow",
      "description": "Playwright testing tips and a human-in-the-loop demo/verification workflow for Claude Code",
      "source": "./plugins/dev-workflow",
      "category": "development"
    },
    {
      "name": "game-catchup",
      "description": "Generate a structured 'what you missed' recap for a game you haven't played in a while",
      "source": "./plugins/game-catchup",
      "category": "productivity"
    }
  ]
}
```

- [x] **Step 2: Validate the whole marketplace**

```bash
claude plugin validate "D:/Projects/ClaudeSkills"
```

Expected: `Validating marketplace manifest: ...marketplace.json` followed by a clean pass covering both plugin entries, no warnings, exit code 0.

- [x] **Step 3: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add .claude-plugin
git commit -m "$(cat <<'EOF'
Add marketplace manifest listing dev-workflow and game-catchup plugins

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Write the repo README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the final marketplace name (`claude-skills`) and plugin names (`dev-workflow`, `game-catchup`) from Task 5.
- Produces: user-facing install/update instructions; no other task depends on this one.

- [x] **Step 1: Write `README.md`**

```markdown
# ClaudeSkills

Clint's personal Claude Code plugin marketplace — skills and agents distributed as installable,
auto-updating plugins instead of hand-zipped `.skill` files.

## Plugins

- **`dev-workflow`** — Playwright testing tips (`playwright-testing` skill), a `playwright-runner`
  subagent that executes Playwright tests/browser steps and reports back a compact summary, and a
  `demoing-work` skill for walking the user through completed work and gating "done" on their
  explicit confirmation.
- **`game-catchup`** — Generates a structured "what you missed" recap for a game you haven't
  played in a while.

## Install

```
/plugin marketplace add wolf123450/ClaudeSkills
/plugin install dev-workflow@claude-skills
/plugin install game-catchup@claude-skills
```

(Or via the `claude` CLI: `claude plugin marketplace add wolf123450/ClaudeSkills`, then
`claude plugin install dev-workflow@claude-skills`.)

## Updating

```
/plugin marketplace update claude-skills
```

Or just wait — Claude Code periodically checks configured marketplaces for updates. Since plugins
live in this git repo, any commit pushed here is what the next update pulls; no manual re-zipping
or redistribution step.

## Adding a new plugin

1. Create `plugins/<name>/.claude-plugin/plugin.json` (`name`, `description`, `version`, `author`).
2. Add its skills under `plugins/<name>/skills/<skill-name>/SKILL.md` and/or agents under
   `plugins/<name>/agents/<agent-name>.md`.
3. Add an entry to `.claude-plugin/marketplace.json`'s `plugins` array with
   `"source": "./plugins/<name>"`.
4. Run `claude plugin validate .` from the repo root to confirm it's picked up cleanly before
   committing.
```

- [x] **Step 2: Commit**

```bash
cd "D:/Projects/ClaudeSkills"
git add README.md
git commit -m "$(cat <<'EOF'
Add README documenting the plugin marketplace install/update flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Push to GitHub and verify the marketplace installs end-to-end

**Files:** none (no new files — this is repo/remote setup plus a live CLI verification pass).

**Interfaces:**
- Consumes: the complete repo state from Tasks 1-6 (marketplace.json + both validated plugins + README).
- Produces: a live, pushed marketplace that `claude plugin install` can pull from — the final deliverable of this plan.

- [x] **Step 1: Create the GitHub repo and push**

```bash
cd "D:/Projects/ClaudeSkills"
gh repo create wolf123450/ClaudeSkills --public --source=. --remote=origin
git push -u origin master
```

Expected: `gh repo create` reports the new repo URL; `git push` reports `master -> master` with no errors.

- [x] **Step 2: Add the marketplace from the pushed repo**

```bash
claude plugin marketplace add wolf123450/ClaudeSkills
```

Expected: confirmation that the `claude-skills` marketplace was added (matching the `name` field in `marketplace.json`).

- [x] **Step 3: Install both plugins**

```bash
claude plugin install dev-workflow@claude-skills
claude plugin install game-catchup@claude-skills
```

Expected: both report successful installation.

- [x] **Step 4: Confirm they're listed**

```bash
claude plugin list
```

Expected: output includes both `dev-workflow@claude-skills` and `game-catchup@claude-skills`.

- [x] **Step 5: Note the restart requirement**

Restart the current interactive Claude Code session (this CLI-based install happened out-of-band
from any running session's already-loaded skill/agent list). After restart, confirm the
`playwright-testing`, `demoing-work`, and `game-catchup` skills and the `playwright-runner` agent
type appear in the session's available skills/agents.

No commit in this task — nothing in the working tree changes; this task only pushes existing
commits and performs live verification.
