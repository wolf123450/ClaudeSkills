# Phases 0–1 and 7–9 — Scaffold, CLAUDE.md, hooks, verification

## Phase 0 detail — Gather facts

Confirm with the user before proceeding:

- [ ] Path to the Godot 4.x **.NET/mono** executable (e.g. `Godot_v4.x-stable_mono_win64.exe`). Verify with `<godot> --version`. Record the exact version (e.g. 4.4.1) — you will need the matching git tag for the docs package.
- [ ] Path to the game project (existing `project.godot`, or a new directory to create).
- [ ] .NET SDK installed and on PATH: `dotnet --version` (needs the version matching the project's `Godot.NET.Sdk` target; .NET 8+ for Godot 4.2+).
- [ ] Node.js available (needed for MCP servers via npx): `node --version`.
- [ ] neuledge/context installed globally: `npm install -g @neuledge/context`, then verify with `context --version`. (Repo: https://github.com/neuledge/context — local-first docs MCP; indexes docs into SQLite, no cloud, no rate limits.)
- [ ] Whether this machine is Windows-native, WSL, or Linux. All paths must be adjusted accordingly. On Windows, prefer forward slashes in JSON configs.

Set an environment convention: refer to the project root as `$PROJECT` throughout.

## Phase 1 detail — Project scaffold and git

If the project is new:

```
$PROJECT/
├── project.godot
├── <ProjectName>.csproj        # Godot generates on first C# script; verify Godot.NET.Sdk version
├── <ProjectName>.sln
├── src/                        # ALL C# code lives here
│   ├── systems/                # engine-independent game logic (pure C# where possible)
│   ├── components/             # Node-attached scripts
│   ├── autoload/                # singletons
│   └── resources/               # custom Resource classes
├── scenes/                     # .tscn files, mirrored structure: scenes/player/, scenes/enemies/, ...
├── assets/                     # imported art/audio; never hand-edit .import files
├── test/                       # GdUnit4 C# tests
├── docs-local/                 # generated project notes (committed); indexed docs live in ~/.context/
└── .claude/
    ├── skills/                 # project-local custom skills (Phase 5)
    ├── agents/                 # subagent definitions (Phase 6)
    └── settings.json           # hooks (Phase 7)
```

Then:

1. `git init` if not already a repo.
2. Use the standard Godot `.gitignore` (`.godot/`, `*.translation`, exports) **plus** .NET additions (`bin/`, `obj/`, `.vs/`). Do NOT gitignore `*.import` files or `*.uid` files — they must be versioned.
3. Initial commit before installing anything else.

## Phase 7 — CLAUDE.md and hooks

### CLAUDE.md (project root)

Write it containing, at minimum:

- One-paragraph project description (get from user) and target quality bar.
- Tech stack: Godot `<version>` .NET, C# only (no GDScript unless explicitly approved), GdUnit4 for tests.
- The exact verified commands from earlier phases: build, headless test run, headless project run.
- Standing rules:
  - Consult the context MCP (godot-docs package) for any uncertain API; never hallucinate signatures. Project-specific notes live in `docs-local/`.
  - Query real scene structure before writing NodePaths (`verify-before-edit` skill).
  - Only the `scene-integrator` role edits `.tscn` files.
  - `dotnet build` must pass before any task is declared complete.
  - Commit per completed task; scene changes and code changes in separate commits where practical.
  - Run `update_project_uids` after creating files outside the editor.
- A "What NOT to do" section, seeded with: no editing `.import` files by hand, no Godot 3 idioms, no GDScript-style snake_case API calls in C#, no per-frame `GetNode`.
- Pointer to the correction log (Phase 8).

### Hooks (`$PROJECT/.claude/settings.json`)

Add a PostToolUse hook that runs `dotnet build --nologo -v q` whenever a `.cs` file is edited or written, surfacing compile errors immediately. If build times make this painful on a large project later, relax it to a Stop hook. Verify the hook fires by introducing a deliberate syntax error and confirming the feedback loop catches it.

## Phase 8 — Correction log (the harness improvement loop)

Create `$PROJECT/docs-local/correction-log.md` with a table: date | what the agent did wrong | correction | destination (which skill/CLAUDE.md section absorbed it).

Standing process: when the user corrects agent output, append an entry. Weekly (or when the user asks to "process the correction log"), fold recurring entries into the appropriate skill. Target: if more than ~30% of generated code is being corrected, the harness is underbuilt — prioritize skill/docs improvements over more prompting.

## Phase 9 — Final verification checklist

Run through all of these and report results to the user:

- [ ] `dotnet build` passes on the project.
- [ ] godot MCP: version, project info, run/debug-output/stop, scene create + UID update all verified (Phase 2).
- [ ] context MCP registered; godot-docs package built at the pinned version; class-reference and C# queries verified both via CLI (`context query`) and through the MCP tool in Claude Code (Phase 3).
- [ ] `docs-local/` notes directory created; `csharp-notes.md` distilled from the C# docs queries.
- [ ] GodotPrompter installed; curation table approved by user; removals applied.
- [ ] Randroids godot skill installed; GdUnit4 C# smoke test passes headlessly.
- [ ] Cherry-picked skills merged into `tscn-hygiene` + `godot-setup-csharp` present in `.claude/skills/`.
- [ ] Four custom skills created (`csharp-godot-quirks`, `project-conventions`, `verify-before-edit`, `visual-qa`).
- [ ] Three subagents defined.
- [ ] CLAUDE.md written; hooks verified firing on a deliberate compile error.
- [ ] `correction-log.md` created.
- [ ] Everything committed, clean `git status`.

Finish by writing a short `SETUP-REPORT.md` summarizing what was installed, what was curated out and why, any deviations from this guide (repos that changed, commands that differed), and open items for the user.
