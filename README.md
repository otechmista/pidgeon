# Agentic Spec Kit

An agent-agnostic template for building software with AI coding agents — Claude Code, Codex, OpenCode, Cursor, or any other agent — without letting code generation outrun product and technical thinking.

Instead of prompting an agent to "build X" and hoping the result matches what you meant, this template makes the agent write down what it's building, get that written down before any code exists.

---

## What this is

A tool-agnostic starter repository that enforces a spec-driven workflow:

```
PRD → Requirements → Design → Tasks → Implementation → Verification
```

Every stage produces a document under `specs/`. The agent cannot move to implementation until you explicitly approve the specs. Once approved, work happens task by task, each one traced back to a requirement and its acceptance criteria.

It is not tied to one AI tool. Instructions live in `AGENTS.md`, the emerging cross-tool convention ([agents.md](https://agents.md)) that Codex, OpenCode and others read natively. `CLAUDE.md` is a one-line import of that same file, so Claude Code follows the identical rules.

---

## Why

Most AI-assisted development fails in the same predictable ways:

- vague prompts produce vague, inconsistent systems
- generated code mixes product intent, architecture, and implementation details
- business rules get invented or silently forgotten
- early speed turns into rework and maintenance cost
- there is no source of truth to review changes against

This template creates that source of truth before any code is generated, and keeps it updated as work progresses.

---

## Repository structure

```txt
.
├── AGENTS.md                  # Agent instructions (agnostic — Codex, OpenCode, etc. read this directly)
├── CLAUDE.md                  # One-line import of AGENTS.md, for Claude Code
├── specs/                     # Source of truth for the current project
│   ├── prd.md                 # Product intent, users, goals, scope, approval gate
│   ├── requirements.md        # Functional / non-functional requirements, traceability
│   ├── design.md              # Technical design: architecture, data, APIs, security, testing
│   └── tasks.md               # Delivery plan, task list, progress log, completion matrix
├── docs/                      # Deep-dive docs referenced from design.md (data model, API standard, design system...)
├── .skills/                   # Claude Code skills that drive the workflow
│   ├── discover-project/      # Reverse-engineer specs from an existing codebase
│   ├── specify-project/       # Fill/update prd.md, requirements.md, design.md with the user
│   └── implement-tasks/       # Execute specs/tasks.md once specs are approved
└── .agents/
    └── rules/                 # Shared rule files AGENTS.md stays aligned with
```

---

## How it works

1. **Specify** — the agent (or you, with the agent's help) fills `specs/prd.md`, then `specs/requirements.md`, then `specs/design.md`, in that order. Each has a `status` field and stays a draft until you say otherwise.
2. **Approve** — `prd.md` has an explicit `## Approval` section. The agent is instructed never to fill it in itself; only you set `approved: true`. Nothing downstream proceeds without it.
3. **Plan** — `specs/tasks.md` breaks the approved design into slices and tasks. Tasks start `blocked` and only become `ready` once the specs are approved.
4. **Implement** — tasks move `ready → in-progress → done → verified`, one at a time, scoped strictly to their linked requirement and acceptance criteria.
5. **Trace** — `tasks.md` keeps a Completion matrix mapping every requirement to the task and evidence that satisfied it, plus a Progress log of what happened and when.

---

## Using this as a template

1. Use this repository as a starting point for a new project (GitHub "Use this template", or clone it).
2. Open `specs/prd.md` with your AI agent of choice and work through Product summary, Problem, Users, Goals, and Scope.
3. Review it yourself and set `approved: true` in the front matter, filling in the Approval section — this step is intentionally not something the agent can do for you.
4. Repeat for `specs/requirements.md` and `specs/design.md`.
5. Have the agent populate `specs/tasks.md` and start implementing, one task at a time.

---

## Supported agents

- **Claude Code** — reads `CLAUDE.md`, which imports `AGENTS.md`. Workflow steps are also available as skills in `.skills/`.
- **Codex CLI, OpenCode, and other AGENTS.md-compliant tools** — read `AGENTS.md` directly, no extra setup.
- **Anything else** — point the tool's system/project instructions at `AGENTS.md`.

---

## License

MIT — see [LICENSE](LICENSE).
