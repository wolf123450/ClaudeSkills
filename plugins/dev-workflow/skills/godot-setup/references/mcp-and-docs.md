# Phases 2–3 — MCP servers and docs indexing

## Phase 2 — MCP servers: godot-mcp + context

Two servers, registered project-scoped so they live in the repo (`.mcp.json` at project root):

```json
{
  "mcpServers": {
    "godot": {
      "command": "npx",
      "args": ["@coding-solo/godot-mcp"],
      "env": {
        "GODOT_PATH": "<absolute path to the Godot .NET executable from Phase 0>",
        "DEBUG": "true"
      }
    },
    "context": {
      "command": "context",
      "args": ["serve"]
    }
  }
}
```

- godot-mcp repo: https://github.com/Coding-Solo/godot-mcp
- context repo: https://github.com/neuledge/context — the docs packages it serves are built below. If `context` isn't on PATH in the MCP launch environment, use `"command": "npx", "args": ["@neuledge/context", "serve"]` instead. Check `context --help` for the current serve/mcp subcommand name — the CLI stabilized at v1.0 (April 2026) but verify against the installed version.

If the npx package is unavailable or stale, fall back to cloning the repo, `npm install && npm run build`, and pointing `command` at `node` with `args: ["<clone>/build/index.js"]`.

**Verification (all must pass):**

- [ ] `get_godot_version` returns the expected version.
- [ ] `get_project_info` on `$PROJECT` succeeds.
- [ ] `run_project` followed by `get_debug_output` and `stop_project` round-trips on a minimal scene.
- [ ] Create a throwaway scene via `create_scene` + `add_node` + `save_scene`, open the resulting `.tscn` as text, confirm it's well-formed, then delete it and run `update_project_uids`.

**Known C# caveat:** this server's script tooling assumes GDScript in places. Treat the MCP as the *scene/tree/runtime* interface only. All C# file creation and editing is done directly with file tools + `dotnet build`. If a tool call fails on a C# project in a way that looks GDScript-shaped, note it in `docs-local/mcp-quirks.md` and work around it rather than fighting it.

## Phase 3 — Docs layer: neuledge/context (replaces API-reference skills)

This is the substitute for doc-duplicating skills. `neuledge/context` indexes documentation from any Git repo into a local SQLite (`.db`) package with FTS5 full-text search and serves it over MCP — fully local, no rate limits, no API keys.

Godot is **not** in Context's community registry (which covers npm/pip/maven), so build the package from source. The godot-docs repo is reStructuredText, which Context parses, and it **includes the generated class reference** (`classes/` directory, one `.rst` per class) — so a single package covers both the prose docs and the full API reference.

```bash
# Build the Godot docs package pinned to the engine version from Phase 0.
# godot-docs uses release branches (e.g. "4.4"); check `context add --help` for the
# current flag to pin a branch/tag (--tag was the documented flag at v1.0).
context add https://github.com/godotengine/godot-docs \
  --tag <matching branch/tag, e.g. 4.4> \
  --name godot-docs --pkg-version <engine version, e.g. 4.4>

# Verify the package exists and answers queries:
context list
context query 'godot-docs@<version>' 'CharacterBody3D move_and_slide'
context query 'godot-docs@<version>' 'C# signals events'
```

**Verification (all must pass before moving on):**

- [ ] `context list` shows the godot-docs package at the pinned version.
- [ ] A class-reference query (e.g. `CharacterBody3D`) returns API content, not just tutorial prose — this confirms the `classes/` RST made it into the index. If it did NOT (Context auto-detects docs folders and may have grabbed a subset), rebuild with the path flag (`--path` at v1.0) pointed at the repo root or the right directories so both `classes/` and `tutorials/` are included.
- [ ] A C#-specific query (e.g. "C# API differences") returns content from `tutorials/scripting/c_sharp/`.
- [ ] With the Phase 2 MCP server running, the docs tool (get_docs/resolve — check the tool list) answers the same queries through Claude Code.

**Fallback** (only if Context's RST parsing of the class reference proves unusable): shallow-clone godot-docs at the pinned branch into `$PROJECT/docs-local/godot-docs/` and grep it directly. Prefer fixing the Context package first — the `.db` is the intended path.

**Project notes directory** (separate concern from indexed docs): create `$PROJECT/docs-local/` for *generated* project knowledge — `csharp-notes.md`, `mcp-quirks.md`, `correction-log.md`. Seed `csharp-notes.md` now: query the context package for the C# API differences material and distill the key points (PascalCase mapping, signals-as-events, Variant marshalling, partial classes). This directory IS committed to git — it's project knowledge, not vendored docs.

**Sharing note:** the built package is a single portable `.db` file in `~/.context/packages/`. If the user wants reproducibility across machines, the `.db` can be copied into the repo or a shared location rather than rebuilt; ask their preference.

**Standing rule (also goes in CLAUDE.md):** never write a Godot API call from memory when uncertain. Query the context MCP (godot-docs package) first. Compile errors from hallucinated PascalCase names are the #1 avoidable failure mode in Godot C#.

As the project accretes dependencies with their own docs (addons like LimboAI, .NET libraries), add them as additional context packages (`context add <repo>`) rather than installing doc-flavored skills — same philosophy, same tool.
