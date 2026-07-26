---
name: discover-project
description: Reverse-engineer an existing codebase into evidence-backed draft product, requirements, technical design, and design-linked documentation. Use when adopting this boilerplate for legacy software, documenting an existing implementation, or reconciling specifications with repository behavior.
---

# Discover an existing project

1. Read `AGENTS.md`, all `specs/` templates, repository instructions, manifests, entry points, tests, schemas, API contracts, configuration, and deployment files.
2. Separate observed behavior from inferred intent. Cite file paths for observations and record uncertain intent as an open question.
3. Populate `specs/prd.md`, then `specs/requirements.md`, then `specs/design.md`.
4. Preserve template structure and stable IDs. Trace behavior through goals, requirements, acceptance criteria, and design.
5. Follow the interviewer skill when product intent, users, rules, constraints, or conflicts cannot be established from evidence.
6. Create deep-dive documents only when linked from `specs/design.md`.
7. Do not assume existing code is correct. Record mismatches, risks, dead paths, and missing tests.
8. Keep specifications in draft and never approve them for the user.
9. Do not modify implementation during discovery.

Finish with evidence inspected, documents changed, inferred items, conflicts, and questions requiring a decision.
