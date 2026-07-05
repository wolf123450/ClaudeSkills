# Playwright Testing + Demo-to-User Plugin — Design

## Purpose

Add two capabilities to Clint's Claude Code workflow:

1. **`playwright-testing`** — a skill with practical tips/tricks for writing and running Playwright
   tests against a web application, including how to delegate actual test execution to a subagent
   so verbose tool output stays out of the top-level session.
2. **`demoing-work`** — a skill that governs how Claude demonstrates completed work to the human
   user (walking through the golden path and edge cases) and gates "this is done" on an explicit
   human confirmation, rather than Claude self-declaring completion.

Distribution is upgraded from this repo's current convention (a single hand-zipped `.skill` file,
`game-catchup.skill`, committed at the repo root with no source tracked) to a proper **Claude Code
plugin marketplace**: this repo becomes both a marketplace and the source for its own plugins, so
future skill/agent additions can be installed and updated through the normal
`/plugin marketplace add` + `claude plugin update` flow instead of manual zip files.

As part of this migration, the existing `game-catchup.skill` is unpacked and brought into the same
marketplace as its own plugin (`game-catchup`), so the repo has a single, consistent distribution
mechanism instead of one skill on the old zip convention and everything else on the new one. It's
unrelated to Playwright/demo work (it's a Claude.ai research skill for "what did I miss in this
game" recaps), so it gets its own plugin rather than joining `dev-workflow` — consistent with the
"unrelated skills get their own plugin" principle below. The root-level `game-catchup.skill` zip is
removed once its content lives under `plugins/game-catchup/`.

## Non-goals

- Building a new custom Playwright wrapper library or test framework — this is documentation/process
  (skills) plus one subagent definition, not new application code.
- Anything Tauri-specific — `~/.agents/skills/tauri-playwright` already covers WebView-bridge E2E
  testing for Tauri apps. `playwright-testing` is for ordinary web apps opened in a browser.
- Changing any of `game-catchup`'s actual skill content — this is a straight lift-and-shift from
  the zip into the plugin structure, not a rewrite.

## Repo structure

```
ClaudeSkills/
  .claude-plugin/
    marketplace.json
  plugins/
    dev-workflow/
      .claude-plugin/
        plugin.json
      skills/
        playwright-testing/
          SKILL.md
        demoing-work/
          SKILL.md
      agents/
        playwright-runner.md
    game-catchup/
      .claude-plugin/
        plugin.json
      skills/
        game-catchup/
          SKILL.md           # content unpacked from the old game-catchup.skill zip
  README.md                 # new: explains the marketplace + install/update flow
```

Both new skills and the new subagent ship inside one plugin, `dev-workflow`, rather than as
separate plugins — they're both part of "how Claude verifies and demonstrates its own work" and
are expected to evolve together. `game-catchup` is unrelated, so it's migrated in as its own
plugin. Future unrelated skill ideas get their own plugin entries in `marketplace.json` the same
way.

## marketplace.json

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

## plugins/dev-workflow/.claude-plugin/plugin.json

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

## plugins/game-catchup/.claude-plugin/plugin.json

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

`skills/game-catchup/SKILL.md` is an unmodified copy of the `SKILL.md` currently packaged inside
`game-catchup.skill` (frontmatter + workflow content unchanged) — this is a packaging migration
only, not a content revision.

## Skill: playwright-testing

Covers, at the level of practical tips (not a tutorial):

- **Locator strategy**: prefer role/text/label-based locators (`getByRole`, `getByLabel`,
  `getByText`) over brittle CSS/XPath selectors; use `browser_snapshot` (accessibility tree) rather
  than screenshots when an agent needs to find/act on an element.
- **Waiting**: rely on Playwright's built-in auto-waiting and `expect(...).toBeVisible()` /
  `toHaveText()` retry-ability instead of arbitrary `sleep`/`waitForTimeout`. Cross-references the
  existing `systematic-debugging` skill's condition-based-waiting notes for the general principle.
- **Debugging failures**: trace viewer (`trace: 'on-first-retry'`), video capture, `PWDEBUG=1`,
  `--ui` mode, `--debug` flag.
- **Network**: mocking/stubbing via `page.route`, waiting for specific responses instead of
  network-idle (which is unreliable with polling/websockets).
- **Test isolation**: fixtures, avoiding shared/global state, unique test data per test.
- **CI config**: `webServer` block, `reuseExistingServer: !process.env.CI`, headless vs. headed.
- **Delegating execution**: the top-level session should not run Playwright test suites or long
  browser-driving sequences inline — it should dispatch to a subagent (see below) and only bring
  back a compact result summary.

### Delegation logic (documented in SKILL.md, not a script)

```
if 'playwright-runner' is an available agent type (i.e. installed as a project subagent):
    Agent(subagent_type='playwright-runner', prompt=<what to run/verify>)
else:
    Agent(subagent_type='general-purpose', prompt=<self-contained prompt template
          instructing it to run the tests/steps and report back a compact pass/fail summary>)
```

## Agent: playwright-runner

A Claude Code project subagent definition (Markdown + frontmatter, the same format as
`.claude/agents/*.md`), shipped inside the plugin so installing `dev-workflow` makes
`subagent_type: playwright-runner` available in any project that has the plugin installed.

- **Tools**: `Bash`, `Read`, `Grep`, `Glob`, plus the Playwright MCP browser tools
  (`mcp__plugin_playwright_playwright__*`). No `Edit`/`Write` — this agent runs and reports, it
  does not author or fix tests.
- **Job**: given a test command or a set of manual browser steps, execute them and return a
  concise structured report: pass/fail counts, failing test names, key error lines (not raw logs),
  and paths to any trace/screenshot/video artifacts produced. It must not dump full verbose
  Playwright output back to the caller.

## Skill: demoing-work

Governs closing out a change with a human explicitly in the loop:

- **When to invoke**: after implementing a feature or bugfix, once automated checks already pass
  (this repo's existing `verify` / `verification-before-completion` skills cover the automated
  side) — `demoing-work` is the step after that, not a replacement for it.
- **Process**:
  1. Start the app (or identify how the change is exercised, for non-UI changes).
  2. Briefly state what changed.
  3. Walk through the golden path and any relevant edge cases:
     - **UI-facing changes**: drive it live using the browser tools from `playwright-testing`
       (navigate, click, snapshot) so the user can see it working, or direct the user to try it
       themselves in their own browser.
     - **Non-UI changes** (CLI, API, backend logic): narrate the walkthrough with actual command
       output / responses rather than a browser.
  4. Ask an explicit confirmation question (e.g. via `AskUserQuestion`) — "does this look right?"
     — and gate marking the work complete on the user's answer. Never self-declare completion.
- Cross-references `playwright-testing` for the live-browser-driving mechanics when the change is
  UI-facing.

## Install / update flow (documented in repo README.md)

```
/plugin marketplace add wolf123450/ClaudeSkills
/plugin install dev-workflow@claude-skills
/plugin install game-catchup@claude-skills
```

Subsequent changes pushed to the GitHub repo are picked up via the normal `claude plugin update`
flow — no manual re-zipping or redistribution step.

## Distribution mechanics

- Create a new **public** GitHub repository `wolf123450/ClaudeSkills` via `gh repo create`, add it
  as `origin`, and push the existing `master` branch.
- No secrets are involved (skills/agents/marketplace metadata only), so public is fine.
- Remove the root-level `game-catchup.skill` zip once its contents are copied into
  `plugins/game-catchup/skills/game-catchup/SKILL.md` — it's fully superseded by the plugin.

## Testing / verification

- No application code is being written, so there's no automated test suite to run. Verification
  is:
  - `marketplace.json` and both `plugin.json` files are valid JSON and match the schema fields used
    by Anthropic's own official marketplace (verified by inspecting installed examples in
    `~/.claude/plugins/marketplaces/claude-plugins-official`).
  - `game-catchup`'s migrated `SKILL.md` diffs identical (content-wise) against the version
    extracted from the original `game-catchup.skill` zip.
  - After pushing, actually run `/plugin marketplace add wolf123450/ClaudeSkills` and
    `/plugin install dev-workflow@claude-skills` + `/plugin install game-catchup@claude-skills` in
    a session to confirm both plugins install cleanly and both skills + the `playwright-runner`
    agent type become available.
