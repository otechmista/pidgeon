---
status: ready
blocked_by: ""
last_updated: "2026-07-25"
---

# Tasks

Specs approved 2026-07-25. Task states: `blocked` → `ready` → `in-progress` → `done` → `verified`.

## Delivery plan

| Slice | User-visible outcome | Requirements | Dependencies | Verification |
|---|---|---|---|---|
| S-001 | Electron + Svelte shell branded Pidgeon with Lucide | FR-008, NFR-003, NFR-007 | None | AC-008.1–008.4 |
| S-002 | Vault register/unlock/lock | FR-001, NFR-001 | S-001 | AC-001.1–001.4 |
| S-003 | SQLite schema + migrations | Data reqs, NFR-003 | S-001 | Schema matches docs/data-model.md |
| S-004 | Connect Google/Outlook via OpenID (BYO) | FR-002, FR-007, BR-010 | S-002, S-003 | AC-002.*, AC-007.* |
| S-005 | Sync inbox + unified reader | FR-003, FR-004 | S-004 | AC-003.*, AC-004.* |
| S-006 | AI cloud+local summarize/suggest | FR-005, FR-006, FR-010 | S-003, S-005 | AC-005.*, AC-006.*, AC-010.* |
| S-007 | Send reply via provider APIs | FR-009 | S-005 | AC-009.* |

## Task list

### TASK-001 - Scaffold monorepo Electron + Svelte shell

- Status: in-progress
- Slice: S-001
- Goal: Runnable Pidgeon desktop shell
- Requirements: FR-008, NFR-003, NFR-007
- Acceptance criteria: AC-008.1–008.4
- Dependencies: none
- Expected changes: Bun workspaces, apps/desktop, apps/web, packages/ui, packages/shared, Tailwind, Lucide, window title Pidgeon
- Out of scope: OAuth, sync, AI, vault crypto
- Verification: `bun install` + `bun run dev` opens window titled Pidgeon with sidebar brand
- Evidence: pending

### TASK-002 - Vault auth (Argon2id + wrapped DEK)

- Status: ready
- Slice: S-002
- Goal: Secure local unlock
- Requirements: FR-001, NFR-001
- Acceptance criteria: AC-001.1–001.4
- Dependencies: TASK-001
- Expected changes: modules/auth, modules/crypto, IPC auth.*
- Out of scope: mail OAuth
- Verification: unit tests for wrap/unwrap; wrong password fails; restart locked
- Evidence: pending

### TASK-003 - SQLite Drizzle schema

- Status: ready
- Slice: S-003
- Goal: Persist profiles, accounts, messages, AI settings
- Requirements: Data requirements, NFR-003
- Acceptance criteria: tables per docs/data-model.md
- Dependencies: TASK-001
- Expected changes: packages/db schema + migrate on startup
- Out of scope: provider API calls
- Verification: migrate creates expected tables
- Evidence: pending

### TASK-004 - OpenID Google/Microsoft + accounts

- Status: ready
- Slice: S-004
- Goal: BYO OAuth connect/list/remove
- Requirements: FR-002, FR-007, NFR-008
- Acceptance criteria: AC-002.1–002.4, AC-007.1–007.2
- Dependencies: TASK-002, TASK-003
- Expected changes: modules/oidc, mail-accounts, docs/oauth-setup.md, settings IPC
- Out of scope: sync body fetch
- Verification: mocked OIDC token encrypt; list never returns tokens
- Evidence: pending

### TASK-005 - Sync + unified inbox UI

- Status: ready
- Slice: S-005
- Goal: Sync and read mail
- Requirements: FR-003, FR-004
- Acceptance criteria: AC-003.1–003.3, AC-004.1–004.3
- Dependencies: TASK-004
- Expected changes: providers/gmail, providers/microsoft, sync, messages, inbox UI
- Out of scope: AI, send
- Verification: mocked sync upserts idempotent; inbox lists
- Evidence: pending

### TASK-006 - Hybrid AI summarize + suggest reply

- Status: ready
- Slice: S-006
- Goal: Cloud and local AI assist
- Requirements: FR-005, FR-006, FR-010
- Acceptance criteria: AC-005.*, AC-006.*, AC-010.*
- Dependencies: TASK-003, TASK-005
- Expected changes: modules/ai, settings UI, AI panel
- Out of scope: send
- Verification: mocked cloud/local router + fallback
- Evidence: pending

### TASK-007 - Send reply

- Status: ready
- Slice: S-007
- Goal: Send replies via Gmail/Graph
- Requirements: FR-009
- Acceptance criteria: AC-009.1–009.4
- Dependencies: TASK-005
- Expected changes: modules/compose, ReplyComposer UI, messages.sendReply IPC
- Out of scope: forward/schedule
- Verification: mocked provider send; draft preserved on failure
- Evidence: pending

## Progress log

| Date | Task | Change | Checks/evidence | Result or blocker |
|---|---|---|---|---|
| 2026-07-25 | — | Specs approved; tasks populated | PRD approved true | ready |

## Completion matrix

| Requirement | Acceptance criterion | Task | Implementation | Evidence | Result |
|---|---|---|---|---|---|
| FR-008 | AC-008.1–008.4 | TASK-001 | Pending | Pending | not-verified |
| FR-001 | AC-001.1–001.4 | TASK-002 | Pending | Pending | not-verified |
| Data model | schema | TASK-003 | Pending | Pending | not-verified |
| FR-002, FR-007 | AC-002.*, AC-007.* | TASK-004 | Pending | Pending | not-verified |
| FR-003, FR-004 | AC-003.*, AC-004.* | TASK-005 | Pending | Pending | not-verified |
| FR-005, FR-006, FR-010 | AC-005.*, AC-006.*, AC-010.* | TASK-006 | Pending | Pending | not-verified |
| FR-009 | AC-009.* | TASK-007 | Pending | Pending | not-verified |
