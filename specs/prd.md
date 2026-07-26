---
status: approved
approved: true
approved_by: "user (Cursor plan confirmation: Implement the plan as specified)"
approved_at: "2026-07-25"
last_updated: "2026-07-25"
---

# Product Requirements Document

## Product summary

Pidgeon is an **open-source desktop (Electron) monolithic email client** focused on productivity and AI. Users connect multiple **Google** and **Outlook/Microsoft** accounts via **OpenID Connect**, work from a unified inbox, summarize and draft with AI (**cloud and/or local**), and **send replies** through the provider APIs. The UI follows a **Notion + ChatGPT** design language (Svelte + Tailwind + shadcn-svelte). Data lives in local **SQLite**. Priorities: simplicity, security, privacy, low cost, and community-friendly configuration (bring-your-own OAuth apps and AI endpoints).

## Problem

People juggle Gmail and Outlook in separate web UIs that are noisy and weak for triage. Cloud-only clients raise privacy and lock-in concerns. Users want one local app that connects official provider identities (OpenID), keeps mail cached locally, and adds AI helpers without a heavy SaaS stack.

## Users and stakeholders

| Actor | Need | Context | Decision authority |
|---|---|---|---|
| Individual knowledge worker | Unified Google + Outlook inbox with AI assist on their machine | Desktop OS (Windows/macOS/Linux) | Product owner (approves PRD) |
| Same user as operator | Install once; local DB; minimal ops | Single-device primary use | Product owner |

## Goals

| ID | Outcome | Success signal |
|---|---|---|
| G-001 | User can unlock/authenticate into the local app securely | App vault unlock succeeds; locked state blocks mail/AI |
| G-002 | User can connect Google and Outlook accounts via OpenID and sync inbox mail | Connected accounts show recent inbox messages after sync |
| G-003 | User can read messages from a unified inbox | Opening a message shows headers, body, and account origin |
| G-004 | User can get an AI summary of a message | Summary returns in seconds for a selected message |
| G-005 | User can get AI reply suggestions | At least one draft reply is generated for a selected message |
| G-006 | Architecture stays simple and cheap | One Electron app + local SQLite; no mandatory self-hosted server |
| G-007 | User can send a reply via the connected Google/Outlook account | Sent message appears in provider Sent/equivalent and local state updates |
| G-008 | User can choose cloud AI, local AI, or both | Settings allow configuring cloud and local providers; features work with either available |

## Non-goals

- Full feature parity with Mailspring/Spark on day one
- Native mobile apps
- Built-in mail server (MX hosting)
- Multi-tenant SaaS / shared team inboxes
- Generic password IMAP/SMTP providers in MVP (Google + Outlook OpenID only)
- Calendar / contacts full suites

## Scope

### In scope (MVP)

- Local app authentication / vault unlock
- Connect multiple Google and Microsoft/Outlook accounts via OpenID Connect (OAuth 2.0 + OIDC)
- Inbox synchronization via provider APIs (Gmail API, Microsoft Graph)
- Unified inbox list and message reading
- AI message summary (cloud and/or local provider)
- AI reply suggestion (tone variants)
- Send replies via Gmail API / Microsoft Graph
- Desktop UI: Svelte + Tailwind + shadcn-svelte, Notion + ChatGPT-inspired design system
- Local SQLite cache
- Open-source distribution: documented BYO Google/Microsoft OAuth client setup and AI provider config; no secrets committed

### Out of scope (MVP)

- Archive, snooze, schedule send, forward, full-text search UI
- Priority classification, needs-reply detection, task/deadline extraction
- Generic IMAP/SMTP username+password accounts
- Self-hosted web server deployment as primary product form
- Shipping first-party production OAuth client secrets in the public repo (contributors/users register their own apps)

### Post-MVP (product vision)

- Forward, archive, search, snooze, schedule send
- AI priority, needs-reply, task/deadline extraction
- Optional generic IMAP accounts
- Richer triage UX
- Optional shared community OAuth client if verification/legal allows

## User journeys

### J-001 - Unlock app

1. Given a configured local profile
2. When the user unlocks with their app password
3. Then they reach the inbox shell and can use mail/AI features

### J-002 - Connect Google or Outlook via OpenID

1. Given an unlocked app
2. When the user chooses Google or Outlook and completes the OpenID/OAuth consent in the system browser or auth window
3. Then tokens are stored encrypted, the account appears in the list, and inbox sync starts

### J-003 - Read unified inbox

1. Given synced messages from one or more accounts
2. When the user opens the unified inbox
3. Then messages appear newest-first with account label, and opening one shows the readable body

### J-004 - AI summarize

1. Given an open message
2. When the user requests a summary
3. Then the system returns a concise AI summary grounded in that message content

### J-005 - AI suggest reply

1. Given an open message
2. When the user requests reply suggestions
3. Then the system returns one or more draft replies the user can edit before sending

### J-006 - Send reply

1. Given an open message and a reply body (typed or AI-suggested)
2. When the user sends the reply
3. Then the message is submitted through the account’s provider API (Gmail or Graph) and the UI shows success or a clear error

### J-007 - Configure AI providers

1. Given an unlocked app
2. When the user configures a cloud OpenAI-compatible endpoint and/or a local LLM endpoint
3. Then AI summary/reply use the selected available provider (preference + fallback in design)

## Business rules

| ID | Rule | Source |
|---|---|---|
| BR-001 | Secrets at rest use the stronger scheme: Argon2id password → wrap data-encryption key (DEK); tokens/ciphertext unreadable while locked; OS `safeStorage` may hold sealed material but unlock still requires app password | User (“o que for mais seguro”, 2026-07-25) |
| BR-002 | A local profile may only access its own accounts and messages | User (security) |
| BR-003 | AI sends only minimum required content; when local provider is selected, message content stays on-machine for that call | User (privacy) |
| BR-004 | MVP mail accounts are Google and Outlook/Microsoft only, connected via OpenID Connect | User (2026-07-25) |
| BR-005 | Unified inbox merges messages across the user's connected accounts | User |
| BR-006 | Product form is an Electron desktop monolith (main + renderer + SQLite in one app) | User (2026-07-25) |
| BR-007 | UI stack is Svelte + Tailwind + shadcn-svelte with a Notion + ChatGPT-like design system; icons from Lucide (`lucide.dev` / `lucide-svelte`) | User (2026-07-25) |
| BR-008 | AI supports both cloud (OpenAI-compatible) and local LLM backends | User (2026-07-25) |
| BR-009 | MVP includes sending replies via provider APIs | User (2026-07-25) |
| BR-010 | Open source: no private API secrets in git; BYO OAuth client IDs and AI keys via local config | User (2026-07-25) |
| BR-011 | Product name is **Pidgeon**; brand string and window title use this spelling | User (2026-07-25) |

## Constraints

- Business: Personal productivity; low cost; open-source community distribution
- Technical: Modular monolith inside Electron; Bun workspaces; renderer + main modules + SQLite in one repository
- Legal/compliance: Sensitive mail/tokens; Google/Microsoft API policies; SPDX license chosen by owner (document when approved)
- Operational: Local-first; SQLite in userData; docs for registering Google/Microsoft OAuth apps
- Time/budget: MVP = secure unlock, OpenID connect, sync, read, AI (cloud+local), send reply

## Success metrics

| Metric | Target | Measurement |
|---|---|---|
| Account connect success | ≥ 95% with valid Google/Microsoft consent | Manual/integration tests |
| Inbox sync freshness | New mail visible after sync within 2 minutes of trigger | Sync job timestamps |
| AI summary latency | p95 &lt; 15s for typical message (cloud or capable local) | Timing logs |
| Reply send success | ≥ 95% with valid scopes/token | Integration + manual |
| Install complexity | Single desktop app; local DB; documented BYO OAuth/AI config | Contributor checklist |

## Assumptions and risks

| ID | Type | Statement | Impact if wrong | Validation |
|---|---|---|---|---|
| ASM-001 | Decision | Primary product is Electron desktop | Confirmed | Done |
| ASM-002 | Assumption | Single local profile per install is enough for MVP | Multi-profile needed earlier | Still open (non-blocking) |
| ASM-003 | Decision | AI supports both cloud OpenAI-compatible and local LLM | Confirmed | Done |
| ASM-004 | Decision | Google + Outlook via OpenID; not password IMAP in MVP | Confirmed | Done |
| ASM-005 | Assumption | Mail sync/send uses Gmail API + Microsoft Graph | Adapter rewrite if IMAP preferred | Default Graph+Gmail unless user objects |
| ASM-006 | Decision | Send reply in MVP | Confirmed | Done |
| ASM-007 | Decision | Unlock = app password wrapping DEK (stronger than OS-session-only) | Confirmed direction | Done |
| ASM-008 | Decision | Project is open source with BYO secrets | Confirmed | Done |
| RSK-001 | Risk | OAuth app verification / each user runs own OAuth client | Friction for contributors | Clear setup docs; optional future community client |
| RSK-002 | Risk | Cloud AI outage or local model too weak | Feature degrade | Fallback between configured providers; clear errors |
| RSK-003 | Risk | Token/mail leak from disk | Severe | Password-wrapped DEK; never log secrets |
| RSK-004 | Risk | Provider API rate limits | Sync/send incomplete | Backoff + cursor persistence |
| RSK-005 | Risk | Forgotten app password = data loss for wrapped secrets | User locked out | Document recovery = reset vault (destructive) |

## Open questions

- [x] Deploy form: Electron desktop
- [x] Stack UI: Svelte + Tailwind + shadcn-svelte; Notion + ChatGPT design language
- [x] DB: SQLite
- [x] Google + Outlook via OpenID
- [x] AI: both cloud and local
- [x] MVP send reply: yes
- [x] Local auth: password-wrapped DEK (most secure practical option)
- [x] Open source + BYO OAuth/AI config
- [x] Product name: Pidgeon
- [x] Icons: Lucide (`lucide.dev`)
- [x] SPDX license: MIT (existing LICENSE; plan default)
- [x] Mail transport: Gmail API + Microsoft Graph (plan default)
- [x] Single profile per install for MVP (plan default)

## Approval

Approved via user confirmation of the Pidgeon MVP Build plan (“Implement the plan as specified”).

- Decision: approved
- Approved by: user (Cursor plan confirmation)
- Approved at: 2026-07-25
- Conditions: MIT license; Gmail API + Microsoft Graph; single local profile; BYO OAuth/AI secrets
