# AGENTS.md

## Purpose

This repository is a boilerplate for spec-driven development with AI coding agents (Claude Code, Codex, OpenCode, Cursor, and similar). It exists so agents write code from approved specifications, not from vague prompts.

## Ground rules

- Before starting work, read and follow every Markdown rule in `.agents/rules/`.
- Never write implementation code before `specs/prd.md`, `specs/requirements.md`, and `specs/design.md` are approved.
- Never approve a spec yourself. The `## Approval` section in `prd.md` is filled in by the user, not the agent.
- Do not invent business rules, entities, or requirements that are not in the specs. Ask instead of guessing.
- Respect `specs/tasks.md` status states in order: `blocked` -> `ready` -> `in-progress` -> `done` -> `verified`. Do not skip states.
- Update the Progress log and Completion matrix in `specs/tasks.md` as you work; treat them as the audit trail.
- If design contradicts requirements, or a requirement has no acceptance criteria, stop and flag it instead of resolving it silently.
- Caveman mode: be short, direct, practical. No filler, no repeated context.

## Repository layout

- `specs/` - single source of truth.
  - `prd.md` - product intent, scope, goals, and the approval gate.
  - `requirements.md` - functional/non-functional requirements and traceability to goals and design.
  - `design.md` - technical design: architecture, data, APIs, security, testing strategy.
  - `tasks.md` - delivery plan, task list, progress log, completion matrix. Blocked until the specs above are approved.
- `docs/` - deep-dive references linked from `design.md` when a topic needs more space (e.g. `data-model.md`, `api-standard.md`, `design-system.md`). Create only when `design.md` points to them.
- `.skills/` - Claude Code (and compatible) skills that drive the workflow:
  - `discover-project` - reverse-engineer specs from an existing codebase.
  - `specify-project` - fill or update `prd.md`, `requirements.md`, `design.md` with the user.
  - `implement-tasks` - execute `specs/tasks.md` once specs are approved.
- `.agents/rules/` - shared rule files that agent-specific configs (this file included) stay aligned with.

## Workflow

1. **Specify** - fill `prd.md`, then `requirements.md`, then `design.md`, in that order. Stop and ask if the problem, users, or constraints are unclear.
2. **Approve** - wait for the user to set `approved: true` and complete the Approval section of `prd.md`. Do not proceed without it.
3. **Plan** - break `design.md` into slices and tasks in `tasks.md`. Tasks stay `blocked` until specs are approved, then move to `ready`.
4. **Implement** - work one task at a time: set it `in-progress`, implement only what the task and its acceptance criteria describe, verify, set `done`, then `verified` once evidence is recorded.
5. **Trace** - every requirement must resolve to a task and recorded evidence in the Completion matrix before the work counts as finished.

## Stop conditions

Stop and ask the user if:

- The product summary, goals, or users are missing or contradictory.
- A requirement has no acceptance criteria.
- `design.md` contradicts `requirements.md`.
- A task has no linked requirement or acceptance criteria.
- You are asked to write code before the specs are approved.

## Tool compatibility

This file follows the agnostic [agents.md](https://agents.md) convention, read natively by Codex CLI, OpenCode, and other compliant tools. Claude Code reads `CLAUDE.md`, which in this repo is a one-line import of this file.
