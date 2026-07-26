---
name: specify-project
description: Create or update the repository's product documents in the required sequence: specs/prd.md, specs/requirements.md, specs/design.md, and design-linked docs/. Use when defining a project, refining draft specifications, resolving open questions, or preparing specifications for user approval.
---

# Specify a project

1. Read `AGENTS.md` and all existing specification templates.
2. Work in order: `prd.md`, `requirements.md`, then `design.md`.
3. Follow the interviewer skill whenever information is missing, ambiguous, contradictory, or unsupported.
4. Preserve headings, front matter, identifiers, tables, and traceability fields.
5. Derive requirements only from the PRD. Give every functional requirement measurable acceptance criteria and relevant failure cases.
6. Derive design only from requirements. Stop and flag contradictions.
7. Mark non-applicable sections explicitly with a reason. Do not delete them.
8. Create `docs/` details only when `design.md` links to them.
9. Keep specifications in draft until the user explicitly approves them. Never approve or impersonate approval.
10. Do not write implementation code or populate implementation tasks before approval.

Finish with changed sections, traceability gaps, open questions, and the exact approval still required.
