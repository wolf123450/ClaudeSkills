---
name: claude-code-token-optimization
description: Use when the user wants to cut Claude Code token/context spend, complains sessions are getting expensive, or asks to set up session-hygiene and subagent-delegation discipline — including replicating this setup on a new machine or in a fresh environment.
---

# Claude Code Token Optimization

## Overview

Cache-read replay of accumulated context is ~94% of session cost — cost ≈ context size × number of turns, because every turn re-reads the whole conversation (source: `ccusage` usage analysis). The highest-leverage fixes are keeping sessions short and delegating noisy tool output to subagents, not prompt-level tweaks.

## Process

Apply in order — each step compounds on the last:

1. **Add CLAUDE.md sections.** Append the `Session Hygiene` and `Token Discipline` blocks below to `~/CLAUDE.md` verbatim (create the file if missing; merge rather than duplicate if headings already exist). Before writing, adapt the example commands (`mvn`, `bin/ai/run-tests-*`, etc.) to whatever build/test/lint commands actually exist in this environment — inspect the current project(s) first.
2. **Add the delegation reminder hook.** Merge the `UserPromptSubmit` hook JSON below into `~/.claude/settings.json`. Append to any existing `UserPromptSubmit` array — don't clobber other hooks. The reminder exists because agents follow the CLAUDE.md guidance early in a session and drift after a few turns; re-injecting it every prompt keeps it consistent. Validate the file is still valid JSON afterward, and confirm the hook actually fires (e.g. `claude --debug`, or check the additional context shows up after a prompt).
3. **Optional: install `rtk`.** github.com/rtk-ai/rtk compresses/filters `grep`/`read`/`find` output before it reaches context. Confirm with the user before installing — it's a third-party tool. Known tradeoff: compression can drop log lines relevant to a debugging session; bypass it and re-run raw if results look confusing.
4. **Add the Search Discipline note** below to `~/CLAUDE.md`. Ambiguous searches across tiers (FE/BFF/backend) or similarly-named components trigger broad, expensive greps; a specific path avoids them.
5. **Verify with usage data.** Run `npx ccusage@latest claude daily` now for a baseline, and again after a few days of use. Compare normalized for the amount and type of work done, not raw totals. Look for: reduced cache-read share, higher Haiku share of subagent calls, smaller average context sizes, no drop in task success.

## CLAUDE.md sections (verbatim)

```markdown
## Session Hygiene
Cache-read replay of accumulated context is ~94% of session cost — cost ≈ context size × number of turns, because every turn re-reads the whole conversation. Keeping sessions short and focused beats every other optimization.

- **Switch tasks → `/clear`.** When the user moves to an unrelated task, suggest `/clear` (or a fresh session) rather than carrying the prior task's context forward. Don't let unrelated work pile up in one context.
- **Long single task → summarize and restart.** When context has grown large, write the durable state (decisions made, key file paths, remaining steps) to a short note or the plan file, then restart — don't let one session balloon to 100M+ tokens of replayed context.
- **Don't hoard context "just in case."** Re-reading a file or re-deriving a fact in a fresh session is far cheaper than replaying a bloated context every turn.

---

## Token Discipline (delegate noisy work)

Before running an operation, predict its output size. If it will exceed ~5KB AND the verbatim output won't directly drive your next tool call, delegate to a subagent so the noise stays out of the main context:

- Test/build runs — delegate; ask the subagent to return only failures + counts
- Exploration that needs to read 3+ files before any edit — Explore subagent with `model: "haiku"`
- `find` / wide `grep` expected to return many matches — Explore subagent with `model: "haiku"`
- Reading a file > 500 lines when you only need one section — pass `offset`/`limit`, never full-file
- Summarizing a long doc/file when you need the gist, not the verbatim text — Haiku subagent returns the gist only
- Log / test-output / build-output triage — Haiku subagent returns only failures, counts, and the root-cause line
- Parsing transcripts or large JSON (`jq` over `*.jsonl`) — Haiku subagent returns the extracted answer, not the dump
- Summarizing large DB query result sets — Haiku subagent returns the rows/aggregate that matter

For pure retrieval (read files, summarize, no judgment), pass `model: "haiku"` to the Agent call — Haiku is a fraction of the cost of Sonnet for the same retrieval. Do NOT use Haiku subagents for edits, design decisions, or anything where a subtle miss changes correctness. The main agent must verify before acting.

**No redundant Reads.** Before calling Read, scan back: if you've already read this file in this session AND haven't Edited it since, reuse the earlier content. Only re-read after an Edit, or when targeting a different line range with offset/limit.
```

```markdown
## Search Discipline
- When the user gives a specific path, search only within it — do not broaden.
- When a request is ambiguous across tiers (FE / BFF / backend) or across similarly named components, ask for the specific file/path before launching wide searches.
```

## Hook JSON (merge into `~/.claude/settings.json`)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"UserPromptSubmit\", \"additionalContext\": \"Reminder: keep noisy output out of context by delegating. Exploration across 3+ files or wide grep/find -> Explore subagent (model haiku); test/build/log triage, jq over transcripts, long-doc summaries, and large DB result sets -> Haiku subagent returning only the gist, failures, or extracted answer. For pure retrieval (read and summarize, no judgment) pass model haiku. Apply this for every exploration/retrieval step, not just the first. Never use Haiku for edits, design decisions, or correctness-sensitive work; verify before acting.\"}}'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

If this JSON-escaped `echo` fails on the target shell, use `jq -nc --arg ctx '...' '{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": $ctx}}'` instead — more portable across shells. Hook syntax may have evolved since this was written; if both fail, consult https://docs.claude.com/en/docs/claude-code/hooks and adapt.

## Quick reference

| Step | Touches | Verify |
|---|---|---|
| CLAUDE.md sections | `~/CLAUDE.md` | Sections present, command examples adapted to this environment |
| Reminder hook | `~/.claude/settings.json` | Valid JSON; additional context appears after a prompt |
| `rtk` (optional) | env/project | Only with explicit user approval |
| Search Discipline | `~/CLAUDE.md` | Note present |
| Verification | — | `ccusage` baseline captured, re-checked after a few days |

## Common mistakes

- Overwriting the existing `UserPromptSubmit` hooks array instead of appending an entry to it.
- Leaving placeholder command examples (`mvn`, `bin/ai/run-tests-*`) instead of adapting them to the actual project's build/test/lint commands.
- Skipping the `ccusage` baseline, so there's no way to confirm the change actually reduced cost.
- Installing `rtk` without asking first — it's a third-party tool with a real tradeoff (can drop log lines).
