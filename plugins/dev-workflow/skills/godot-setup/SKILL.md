---
name: godot-setup
description: Use when setting up a new Godot 4.x C#/.NET project for Claude Code agentic development, or bootstrapping MCP servers, local docs indexing, third-party skill curation, custom skills, subagents, and hooks for an existing Godot project. Not for API reference lookups — see the docs-layer setup for that.
---

# Godot 4 (C#) + Claude Code Environment Setup

## Overview

Sets up an agentic development environment for a Godot 4.x C#/.NET project targeting near-AA quality: MCP servers for the editor/runtime and docs, a curated skill set, project-local skills and subagents, and git/build discipline. Verify each phase before moving to the next — where a step is ambiguous or a referenced repo has changed since this was written (July 2026), inspect its current README and adapt rather than failing.

**Guiding philosophy:**
1. Skills are for architecture, conventions, and workflows — not API reference. API reference lives in the local docs index (`references/mcp-and-docs.md`), not in skills. If an installed skill is mostly API regurgitation, disable or delete it during curation.
2. Everything must be verifiable headlessly — `dotnet build` and headless test runs are ground truth, not "the code looks right."
3. Git discipline is mandatory: commit after every completed task. Scene files (`.tscn`) and UIDs are the primary corruption risk.

## Phase 0 — Gather facts (ask the user, don't guess)

Confirm before proceeding: path to the Godot 4.x **.NET/mono** executable (verify with `<godot> --version`, record the exact version — you'll need the matching docs tag later); path to the project (existing or new); `.NET SDK` on PATH (`dotnet --version`, matching the project's `Godot.NET.Sdk` target, .NET 8+ for Godot 4.2+); Node.js (`node --version`, needed for MCP servers via npx); `neuledge/context` installed globally (`npm install -g @neuledge/context`, verify with `context --version`); whether the machine is Windows-native, WSL, or Linux (adjust paths accordingly; prefer forward slashes in JSON configs on Windows).

Refer to the project root as `$PROJECT` throughout.

## Phase 1 — Project scaffold and git

If new, scaffold `$PROJECT` with `src/` (systems/, components/, autoload/, resources/), `scenes/`, `assets/`, `test/`, `docs-local/`, and `.claude/` (skills/, agents/, settings.json). Full layout and gitignore rules: `references/project-and-hooks.md`.

`git init` if needed, apply the Godot + .NET gitignore (never gitignore `*.import` or `*.uid` files — they must be versioned), commit before installing anything else.

## Phases 2–3 — MCP servers and docs indexing

Register `godot-mcp` (editor/runtime) and `context` (local docs search) project-scoped in `.mcp.json`, then build a `neuledge/context` package from godot-docs pinned to the engine version so both prose docs and the full class reference are queryable offline. Full config, verification checklist, and fallbacks: `references/mcp-and-docs.md`.

## Phases 4–6 — Skill curation, custom skills, subagents

Install GodotPrompter and the Randroids test/ship skillset, curate out anything that's pure API-reference regurgitation (present the keep/remove table to the user before deleting), cherry-pick a couple of narrow skills, then write four project-local skills (`csharp-godot-quirks`, `project-conventions`, `verify-before-edit`, `visual-qa`) and three subagents (`systems-dev`, `scene-integrator`, `qa-runner`) that load them. Full repo list, install commands, and skill/subagent bodies: `references/skills-and-agents.md`.

## Phases 7–9 — CLAUDE.md, hooks, correction log, final verification

Write project CLAUDE.md with the verified build/test commands and standing rules (docs-MCP before uncertain APIs, scene-integrator-only `.tscn` edits, build-must-pass-before-done); add a PostToolUse hook running `dotnet build` on `.cs` edits; create `docs-local/correction-log.md` as the harness-improvement loop; run the full verification checklist and write `SETUP-REPORT.md`. Full checklist and CLAUDE.md template: `references/project-and-hooks.md`.

## Quick reference

| Phase | Deliverable | Reference |
|---|---|---|
| 0–1 | Facts confirmed, scaffold + git | `references/project-and-hooks.md` |
| 2–3 | godot-mcp + context MCP, docs package built | `references/mcp-and-docs.md` |
| 4–6 | Curated skills, 4 project skills, 3 subagents | `references/skills-and-agents.md` |
| 7–9 | CLAUDE.md, hooks, correction log, SETUP-REPORT.md | `references/project-and-hooks.md` |

## Common mistakes

- Trusting a Godot C# API call from memory instead of querying the `context` MCP's godot-docs package first — hallucinated PascalCase names are the #1 avoidable compile failure.
- Letting any agent besides `scene-integrator` touch `.tscn` files.
- Keeping installed third-party skills that just restate API signatures — that duplicates the docs index and wastes context; curate them out.
- Declaring a task done without `dotnet build` passing.
