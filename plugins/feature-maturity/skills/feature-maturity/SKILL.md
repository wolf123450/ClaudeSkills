---
name: feature-maturity
description: Shared vocabulary for describing how done a feature or piece of code actually is. Use when scoping work up front ("build this to Functional"), before declaring any implementation task complete (self-report a maturity reading, don't just say "done"), when auditing existing code's maturity, or when the user and Claude disagree about whether something is Finished/Polished/Hardened/etc. and need to argue from shared criteria instead of vibes.
---

# Feature Maturity

## Why this exists

Agentic coding tends to produce things that *look* done — the happy path renders, the demo works — while quietly skipping real backend wiring, error handling, edge cases, reuse, tests, or basic UX polish. "Done" is not one bit. This skill gives Claude and the user a shared vocabulary so either side can say "I think this is Finished" or "no, this is only Functional, we need work in X direction" and mean something precise and checkable.

There are two kinds of axis here:

1. **Completeness** — a sequential ladder. You pass through each stage; you can't be Finished without having been Functional.
2. **Quality axes** (Polish, Robustness, Architecture, Verification, Documentation, Accessibility) — independent, orthogonal to Completeness and to each other. A feature can be Functional-completeness with Hardened robustness and zero polish (e.g. a CLI tool or backend job). Don't assume these move together, and don't assume a feature needs to max out every axis — some are N/A for a given feature type (Accessibility rarely applies to a headless script; Polish rarely applies to an internal batch job).

**Use the vocabulary freely in conversation** — "this is still Bare" or "that's Hardened at this point" — without needing to recite the full axis name or produce a formal report every time. Reserve the compact report format (below) for moments that call for a full reading: scoping a new feature, a completion self-report, or an audit.

## Completeness (the ladder)

**Spike** — Throwaway. Written to answer a question ("can this even work," "what would this look like") and explicitly meant to be deleted or fully rewritten, not built upon. If code from a spike survives into the real implementation, that's a coincidence, not a plan.

**Prototype** — Represents the feature and is the seed of the real implementation, but is a *minimum bar*, not an upper bound: visual/interaction flow is present; data is commonly mocked/hardcoded rather than backed by a full client/server; architecture usually isn't broken into reusable components; maintainability hasn't been a priority. Some real data/server wiring can be present in a prototype — that doesn't disqualify it — but none of it is required yet.

**Functional** — Both UI and data backend are real where applicable. The feature does what it was built to do. Reusable architecture and component decomposition are present (see Architecture axis). Stretch goals and extra affordances may be missing. Example: a table displays real data; you can sort and filter it; pagination works; batch actions/select may be present if the use case calls for it. Not every possible table feature needs to exist — a legitimately read-only table doesn't need add/edit/delete.

**Finished** — Every reasonable extension of the core use case has been implemented — not unrelated feature creep, but the natural stretch goals of *this* use case. For a table: full CRUD where applicable, sort/filter on every relevant column, manual reorder if applicable, per-row actions, sensible empty/loading/error states. QOL and usability have had a deliberate pass. "Reasonable" is a judgment call, not a checklist — see Worked Examples for calibration, not a spec to satisfy line by line.

## Quality axes

Each axis has three named levels. Levels are qualitative — judge against the *spirit* of the description for this specific feature, not a universal checklist. A feature type without a meaningful reading on an axis is **N/A** on that axis, not automatically "low."

### Polish (visual/interaction craft — mostly N/A for headless features)
- **Bare** — unstyled or default-styled; no transitions; layout/spacing not deliberately considered.
- **Styled** — consistent visual language, sensible spacing and layout, nothing feels accidental — but no motion or "juice."
- **Polished** — deliberate motion and micro-interactions, elements have room to breathe, layout is balanced and fully used. Target is roughly **30–50% juice** — noticeable and pleasant, not dominant or attention-seeking. 100% juice on everything is a failure mode of this axis, not the goal.

### Robustness (defensiveness against bad input, edge cases, failure)
- **Happy-path** — works when used exactly as intended; no guardrails against misuse, bad input, or failure of dependencies.
- **Defensive** — validates input, anticipates the failure modes you can predict from reading the code, fails gracefully (clear errors, no silent corruption/crash).
- **Hardened** — has actually survived real usage and iteration against real-world data/traffic over time. **This level cannot be self-assessed as reached purely by writing code in one sitting** — it's earned through use, not authored. If claiming Hardened, say what evidence supports it (time in production, real dataset it survived, bug reports it weathered). Absent that evidence, the honest ceiling from code alone is Defensive.

### Architecture (maintainability, decomposition, reuse)
- **Ad-hoc** — one-off, tangled with its surroundings, not meant or able to be extended without a rewrite.
- **Structured** — sensibly decomposed, follows the project's existing conventions, a future change has an obvious place to go.
- **Composable** — deliberately designed with reusable seams; other features could build on this piece without modifying it.

### Verification (automated safety net — distinct from Robustness, which is about the code's own defensiveness)
- **Untested** — no automated coverage.
- **Spot-checked** — tests exist for the critical/core path.
- **Covered** — meaningful automated coverage of core logic and the edge cases Robustness identified.

### Documentation (can someone other than the author pick this up from written material alone)
- **None** — no comments, README, or docs beyond the code itself.
- **Adequate** — non-obvious decisions and constraints are commented; basic usage is documented somewhere findable.
- **Complete** — another developer (or future you, cold) could onboard, use, and extend this from the docs alone: rationale for non-obvious choices, usage/API docs, and any runbook-level operational notes it needs.

### Accessibility (UI features only — N/A for backend/CLI/headless)
- **Not considered** — no attention paid.
- **Basic** — keyboard-operable, adequate color contrast.
- **Compliant** — WCAG AA-ish: screen reader labels, visible focus management, correct semantic structure.

## Reporting

**Compact report format** — use when scoping, self-reporting completion, or auditing:

```
Completeness: Functional
Polish: Bare | Robustness: Defensive | Architecture: Structured | Verification: Untested | Documentation: None | A11y: N/A
Gaps to reach target: [what's missing per axis worth calling out — only axes that matter for this feature]
```

Omit axes that are genuinely N/A rather than forcing a rating (a backend job doesn't get a Polish or A11y line).

**Self-reporting gate** — before declaring implementation work "done" in response to a request that didn't specify a target level, give a compact report and name the gaps, rather than just saying "done." Let the user decide whether the current level is good enough or whether to keep going.

**Target-setting** — when the user specifies a target ("build this to Functional," "get this Hardened before ship"), scope work to that reading and say so explicitly when handing it back, rather than silently over- or under-shooting.

**Disagreement** — when the user and Claude read a feature's maturity differently, resolve it by pointing at the specific criterion in question ("I called this Finished because X, but you're right that there's no error state for Y — that's a Robustness gap, not Completeness, so I'd still call Completeness Finished but Robustness only Happy-path") rather than just restating a conclusion.

## Worked example (table feature, for calibration only — not a checklist to satisfy verbatim)

- **Spike**: hardcoded `<table>` in a scratch file to see if the data shape even makes sense on screen.
- **Prototype**: renders real-looking mocked rows, no sort/filter, inline in the parent component.
- **Functional**: real data source, sort + filter work, pagination, extracted into a reusable `<DataTable>`; add/edit/delete only if the use case needs them.
- **Finished**: CRUD where applicable, sort/filter on every relevant column, per-row actions, manual reorder if the domain has an inherent order, empty/loading/error states handled.
- Separately: this table could be Finished-completeness while still **Bare** polish, **Happy-path** robustness, and **Untested** — that's a legitimate, describable state, not a contradiction.
