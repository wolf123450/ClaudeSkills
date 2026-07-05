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
