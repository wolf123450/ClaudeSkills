---
name: claude-code-statusline
description: Use when the user wants to set up, install, or replicate a Claude Code status line showing model name, session token usage, context-window percentage, and 5h/7-day rate-limit usage — including on a new machine or in a fresh environment.
---

# Claude Code Status Line

## Overview

A `statusLine` command in Claude Code settings receives a JSON payload on stdin per render and prints the line shown at the bottom of the session. This skill installs a bash statusline that surfaces the numbers that matter for session-cost awareness: model, cumulative session tokens, context-window used % (traffic-light colored), and 5-hour/7-day rate-limit usage with a countdown to the next 5-hour reset. Pairs well with `claude-code-token-optimization` — the statusline is how you'd notice a session needs `/clear`.

## Process

1. **Copy the script.** Place `statusline-command.sh` (in this skill directory) at `~/.claude/statusline-command.sh`. Requires `bash` and `jq` on PATH — on Windows, Git Bash provides both; invoke via `bash <path>`, not the raw path.
2. **Wire it into settings.** Merge into `~/.claude/settings.json` (don't clobber other top-level keys):
   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "bash /c/Users/<user>/.claude/statusline-command.sh"
     }
   }
   ```
   Adjust the path for the target OS/shell — use the POSIX-style path Git Bash expects on Windows (`/c/Users/...`), or the native path on macOS/Linux.
3. **Make it executable** on macOS/Linux: `chmod +x ~/.claude/statusline-command.sh` (harmless no-op on Windows Git Bash).
4. **Verify.** Start a session and confirm the status line renders `<model> | <N>k tok | ctx:<N>% (<N>% left) | 5h:<N>% (resets <N>h<N>m) 7d:<N>%` at the bottom, with colors: green/yellow/red context and rate-limit thresholds at 50%/75%. The reset countdown only appears once `resets_at` shows up in the payload (not present on the very first render of a session).

## What the script reads

The statusline command receives this shape on stdin (fields used by this script; others are ignored):

```
.model.display_name
.context_window.used_percentage
.context_window.remaining_percentage
.context_window.total_input_tokens
.context_window.total_output_tokens
.rate_limits.five_hour.used_percentage
.rate_limits.five_hour.resets_at
.rate_limits.seven_day.used_percentage
```

Any field can be absent (e.g. rate limits on a plan without them) — the script omits that segment rather than erroring, via `// empty` jq defaults. `resets_at` is a Unix epoch-seconds timestamp; the script converts it to a `<N>h<N>m` countdown at render time using the local `date +%s`.

## Quick reference

| Segment | Shown when | Color rule |
|---|---|---|
| Model | Always | Cyan |
| Session tokens | `total_tokens > 0` | White; abbreviated to k/M |
| Context % | `used_percentage` present | Green `<50`, yellow `50–74`, red `≥75` |
| Rate limits | `five_hour`/`seven_day` present | Dim `<50`, yellow `50–74`, red `≥75` |
| 5h reset countdown | `five_hour.resets_at` present | Same color as the 5h segment; `<N>h<N>m` (or `<N>m` under an hour) |

## Common mistakes

- Pointing `command` at the raw Windows path (`C:\Users\...`) instead of the Git-Bash POSIX path (`/c/Users/...`) — the command runs under `bash`, so it needs a POSIX path.
- Forgetting `jq` isn't installed — the script will silently print nothing useful. Check with `jq --version` before wiring it in.
- Clobbering existing `~/.claude/settings.json` keys (`hooks`, `enabledPlugins`, etc.) instead of merging in just `statusLine`.
