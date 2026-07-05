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
