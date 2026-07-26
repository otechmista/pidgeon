---
name: interviewer
description: Interview stakeholders to discover missing product and technical information, then fill or update the templates in specs/ and design-linked documents in docs/. Use when a project is vague, specifications contain placeholders or open questions, or another workflow needs user decisions before proceeding.
---

# Interview stakeholders

## Prepare

1. Read `AGENTS.md` and every existing file in `specs/`.
2. Treat existing content as evidence, never as permission to invent missing details.
3. Inspect `docs/` only for documents referenced by `specs/design.md`.
4. Find missing, ambiguous, or contradictory fields in this order: PRD, requirements, design, then linked docs.

## Interview

1. Ask one to three tightly related questions per turn.
2. Start with product summary, problem, users, constraints, and decision authority.
3. Prefer questions that unblock several downstream sections.
4. Use examples only to clarify the expected answer; never turn examples into requirements.
5. Confirm material answers when their meaning is uncertain.
6. Record unresolved points as open questions. Do not guess.
7. Stop on contradictions, missing acceptance criteria, or decisions requiring the user.

## Write documents

1. Preserve template headings, front matter, identifiers, and table shapes.
2. Replace placeholders only with facts supported by user answers or repository evidence.
3. Keep IDs stable: `G-*`, `J-*`, `BR-*`, `FR-*`, `NFR-*`, `AC-*`, `F-*`, and `TASK-*`.
4. Maintain traceability across goals, journeys, rules, requirements, acceptance criteria, design, and tasks.
5. Create a file in `docs/` only when `specs/design.md` links to it and the topic needs detail.
6. Keep documents in draft. Never approve a specification for the user.
7. Do not write implementation code or unblock tasks.

Finish each pass with sections updated, decisions recorded, contradictions, and the next unanswered questions.
