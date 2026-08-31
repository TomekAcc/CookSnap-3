# Cook AI — Project Memory

Read this first, every session, before non-trivial work. It's an index —
the real rules and product context live in the files it points to; nothing
here duplicates them, so they stay in one place and don't drift out of sync.

## Always check before non-trivial work
1. `docs/PRD.md` — what the product is, who it's for, what's actually
   shipped, monetization, non-goals.
2. `docs/ROADMAP.md` / `docs/IMPLEMENTATION_ROADMAP.md` — what's planned
   next (the *what/why*) and the concrete file-level steps for it (the
   *how*).
3. `.claude/rules/*.md` — working conventions grounded in this project's
   own incident history (AI integration, CI/CD, code quality,
   cross-platform, documentation, git hygiene, security, testing,
   versioning). Same content consolidated in `docs/ENGINEERING_RULES.md`
   for anyone browsing `docs/` directly.

## Adopt the matching skill role automatically
Four role-based skills live under `.claude/skills/`. Match the task's
actual subject to one of these and adopt its role/workflow without waiting
to be asked by name — full detail in `.claude/rules/skill-usage.md`:

- **`ui-polish`** — visual glitches, animation/gesture bugs, layout
  spacing, theme problems, or a request for a design opinion.
- **`ai-prompt-tuning`** — changes to the Gemini vision or recipe-
  generation prompts, scan-accuracy complaints, recipe-quality
  complaints, or "model returns 404 / scan failed" errors.
- **`release-publish`** — getting a verified code change onto the user's
  phone: compile check → pretest against the real dependency → `eas
  update` → report the dashboard link back. Follows any completed
  `ui-polish` or `ai-prompt-tuning` fix.
- **`product-docs`** — creating or updating the PRD, roadmap,
  implementation roadmap, engineering rules, or a `.docx` of any of them.

A single request often spans more than one skill in sequence — fixing a
bug (`ui-polish`) and then shipping it (`release-publish`) is the normal
flow, not two separate unrelated asks.

## On "assign an agent"
These four skills are roles ONE continuous session adopts in sequence —
not separate Agent-tool subagents dispatched per task. That's deliberate:
this project's real workflow (diagnose → fix → verify live against a real
dependency → ship) is inherently sequential and needs the full
conversation's accumulated context at every step — what was already tried,
why a prior attempt didn't work, what the user actually reacted to. A
subagent starts cold and would have to re-derive all of that, which costs
more than it saves for this shape of work. The `Agent` tool stays
available for genuinely separable work — a broad multi-file investigation,
an isolated experiment in its own worktree — just not as the default
mechanism for the routine fix-verify-ship loop.

## Known structural gap
This project's actual root is `/workspace/cooksnap`. If a given session's
working root is set to somewhere else, Claude Code's Skill-tool
auto-discovery won't see `.claude/skills/` here at all — it only scans
from the session's own root. This file is the fallback that keeps the
rules and skill roles in context regardless: a project `CLAUDE.md` gets
picked up whenever Claude reads or edits files anywhere in this directory
tree, not only at session start from the exact root, so relying on it here
is more durable than relying on Skill-tool discovery alone.
