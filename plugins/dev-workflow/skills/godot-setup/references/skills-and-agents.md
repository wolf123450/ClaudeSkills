# Phases 4–6 — Skill curation, custom skills, subagents

## Phase 4 — Install and curate third-party skills

### 4a. GodotPrompter (architecture & how-to skills — the keeper)

Repo: https://github.com/jame581/GodotPrompter

```
claude plugins marketplace add jame581/skillsmith
claude plugins install godot-prompter@skillsmith
```

(If the marketplace path fails, clone the repo and add it as a local marketplace per its README.)

**Curation pass (required):** list every installed skill. For each one, classify:

- **KEEP** — architectural/workflow knowledge: project setup, architecture patterns, scene composition, state machines, multiplayer architecture, save systems, optimization methodology, input architecture, addon integration (LimboAI etc.).
- **REMOVE/DISABLE** — API reference regurgitation: anything whose body is primarily "here is the signature of X and its parameters," now covered by `docs-local/`.

Present the keep/remove table to the user for approval before deleting anything. When in doubt, keep — a skill that mixes architecture with some API detail stays.

### 4b. Randroids-Dojo/Godot-Claude-Skills (the test/ship loop)

Repo: https://github.com/Randroids-Dojo/Godot-Claude-Skills

```
/plugin marketplace add Randroids-Dojo/Godot-Claude-Skills
/plugin install godot
```

Provides GdUnit4 testing, PlayGodot E2E automation, export/CI workflows. Keep it whole — it's workflow knowledge, not doc duplication.

Follow its guidance to install **GdUnit4** (C# support) into the project now: add the addon, add the GdUnit4 NuGet test packages to a `test/` csproj if the current GdUnit4 C# setup requires it (check its docs — this has changed between versions), and verify with one trivial C# test running headlessly:

```bash
dotnet build
<godot> --headless --path $PROJECT -s res://addons/gdUnit4/bin/GdUnitCmdTool.gd --run-tests
```

(Adjust the invocation to whatever the current GdUnit4 C# runner requires; record the final working command in CLAUDE.md.)

### 4c. Single-skill cherry-picks

Copy these individual skills into `$PROJECT/.claude/skills/` (fetch from their repos, review before installing, strip anything that's pure API reference per the philosophy in the main skill):

1. `godot-setup-csharp` from https://github.com/majiayu000/claude-skill-registry (path: `skills/data/godot-setup-csharp/`) — `.csproj` configuration, GDScript↔C# interop, `[GlobalClass]` resource patterns. Keep the setup/interop workflow content.
2. The `.tscn` format/scene-design knowledge: check https://github.com/fenixnix/Godot-Skills (`godot-tscn-format`, `godot-packedscene`) and https://github.com/alexmeckes/godot-claude-skills (`godot-scene-design`). Merge the *practices* (corruption avoidance, `ext_resource`/`sub_resource` hygiene, collision layer conventions, pooling patterns) into ONE local skill named `tscn-hygiene`. Discard raw format-spec content — the format is documented in `docs-local` and readable by example from the project's own scene files.

### 4d. Mine godogen for the visual QA loop

Repo: https://github.com/htdt/godogen — do NOT install the whole pipeline. Extract:

- Its visual QA skill (screenshot capture from the running game + vision analysis). Adapt it into a local skill `visual-qa` (Phase 5d below) that composes with the godot-mcp `run_project` flow. Screenshots can be reviewed directly (vision-capable); external API keys from godogen's setup are optional and should only be wired if the user provides keys.
- Note its asset-generation skill structure in `docs-local/asset-pipeline-notes.md` for later — not part of this setup.

## Phase 5 — Custom project skills (write these)

Create each under `$PROJECT/.claude/skills/<name>/SKILL.md`. Follow skill best practices: frontmatter `name` + a **pushy** `description` (all when-to-trigger info in the description, since undertriggering is the common failure), body under 500 lines, overflow into `references/` files loaded lazily.

### 5a. `csharp-godot-quirks`

Description (frontmatter): "Godot 4 C#-specific pitfalls and idioms. Use whenever writing, reviewing, or debugging ANY C# script in this project — even small edits — and especially when touching signals, disposal, exports, or hot loops."

Seed the body with (verify each via the context MCP's godot-docs package before writing — do not trust memory):

- `public partial class` is mandatory for Godot-derived types (source generators).
- API mapping: snake_case → PascalCase; signals → C# events; connect via `Node.EventName += Handler` and emit via `EmitSignal(SignalName.X, ...)`.
- `[Export]` / `[Signal]` / `[GlobalClass]` attribute requirements and their source-generator constraints (e.g., signal delegates must end in `EventHandler`).
- Marshalling cost crossing the C#/engine boundary — cache node references, avoid per-frame `GetNode`, prefer plain C# collections in hot loops over Godot Variant collections.
- Lifetime: engine owns Node memory; `IsInstanceValid`, `QueueFree` vs C# references, event handler leaks on freed nodes (disconnect in `_ExitTree`).
- The rebuild dance: after C# changes, `dotnet build` must succeed before the editor or a headless run reflects them; the MCP's run tools execute the *built* assembly.
- **This skill grows from the correction log** (Phase 8 in `references/project-and-hooks.md`). Every time the user corrects a C#-Godot mistake twice, it becomes a bullet here.

### 5b. `project-conventions`

Description: "This project's architecture rules. Use at the start of ANY task that creates files, scenes, systems, or makes structural decisions."

Body: the Phase 1 directory layout; composition over inheritance; scene-per-entity; autoload policy (what may and may not be a singleton); custom `Resource` classes for data, nodes for behavior; naming conventions; where tests live and that every system ships with tests. Fill specifics in with the user as the project develops.

### 5c. `verify-before-edit`

Description: "Mandatory pre-flight for ANY edit that references scene structure, NodePaths, node names, or creates project files. Use before writing code containing GetNode, NodePath strings, or scene instantiation, and after creating any file."

Body:
- Before writing any NodePath or `GetNode` call: query the real scene via the godot MCP (or read the `.tscn` as text) — never invent paths.
- Before using any uncertain API: query the context MCP (godot-docs package).
- After creating files outside the editor: run `update_project_uids` via MCP; confirm no `.uid` orphans.
- After any C# edit batch: `dotnet build` before declaring done.

### 5d. `visual-qa` (adapted from godogen, Phase 4d)

Description: "Runtime visual verification of the game. Use after implementing or changing anything player-visible — scenes, shaders, UI, animation, camera — and when the user reports something 'looks wrong'."

Body: run the project via MCP → capture screenshot(s) (Godot CLI `--write-movie` for short clips, or viewport screenshot via a debug autoload — implement whichever godogen's approach suggests and the project supports) → inspect the images directly → check debug output for errors → report findings; never claim visual correctness without having looked.

## Phase 6 — Subagents

Create in `$PROJECT/.claude/agents/`. Use https://github.com/rohitg00/awesome-claude-code-toolkit `agents/specialized-domains/game-developer.md` as reference material for tone/coverage, but split into three:

1. **`systems-dev.md`** — pure C# game logic (inventory, save/load, procgen, stats, AI decision logic). May NOT touch `.tscn` files. Works TDD: write GdUnit4 test → implement → `dotnet build` + headless test run → done. Loads `csharp-godot-quirks` and `project-conventions`.
2. **`scene-integrator.md`** — the ONLY agent allowed to modify `.tscn` files. Owns MCP scene operations, node wiring, `[Export]` hookup, UID maintenance. Loads `tscn-hygiene` and `verify-before-edit`. Commits scene changes separately from code changes.
3. **`qa-runner.md`** — runs builds, headless test suites, and the visual-qa loop. Files findings (as a report or TODO list) rather than fixing directly. Loads `visual-qa`.
