---
name: implement-tasks
description: Plan and execute specs/tasks.md work from approved specifications with strict task-state transitions, scoped implementation, verification evidence, progress logging, and completion traceability. Use only when planning or implementing approved work after all specification gates are satisfied.
---

# Implement approved tasks

## Gate

1. Read `AGENTS.md` and all files in `specs/`.
2. Confirm the required specifications are approved by the user.
3. Confirm there is no contradiction or requirement without acceptance criteria.
4. Stop without writing implementation code if a gate fails.

## Plan

1. Derive vertical slices and tasks only from approved design and requirements.
2. Link every task to requirements and acceptance criteria.
3. Move tasks from `blocked` to `ready` only after approval. Never skip states.

## Execute

1. Select one `ready` task and set it to `in-progress`.
2. Implement only its expected changes and preserve out-of-scope boundaries.
3. Run its verification and relevant regression checks.
4. Record changes and raw evidence in the Progress log and Completion matrix.
5. Set the task to `done` after implementation, then `verified` only when evidence proves every linked acceptance criterion.
6. Stop and record a blocker if implementation, design, and requirements disagree.

Finish with task state, files changed, checks, evidence, and remaining work.
