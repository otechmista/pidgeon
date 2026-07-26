---
status: approved
last_updated: "2026-07-25"
---

# Requirements

## Functional requirements

### FR-001 - Local app authentication (secure vault unlock)

- Requirement: The system shall protect the desktop vault with an app password: derive a key via Argon2id, wrap a data-encryption key (DEK), and keep OAuth tokens and other secrets encrypted such that they are unreadable while locked. OS `safeStorage` may assist but must not replace the password gate.
- Rationale: Strongest practical local protection (G-001, J-001, BR-001).
- Priority: must
- Related goals: G-001
- Related business rules: BR-001, BR-002, BR-006
- Dependencies: none

Acceptance criteria:

- AC-001.1: Given a valid app password, when the user unlocks, then the DEK is unwrapped in memory and protected IPC succeeds.
- AC-001.2: Given an invalid app password, when the user unlocks, then access is denied and ciphertext remains unreadable.
- AC-001.3: Given a locked app, when the renderer invokes protected IPC, then the main process rejects the call.
- AC-001.4: Given the process is killed while unlocked, when restarted, then the app starts locked (DEK not persisted in plaintext).

Failure and edge cases:

- First-run creates profile, password, and DEK
- Forgot password → documented destructive vault reset only (no backdoor)
- Lock / quit zeros in-memory DEK and tokens

### FR-002 - Connect Google and Outlook via OpenID

- Requirement: The system shall let an unlocked user connect one or more Google and Microsoft/Outlook mail accounts using OpenID Connect (OAuth 2.0 authorization code + PKCE), store tokens encrypted at rest, and register the account for sync.
- Rationale: Official multi-account access without passwords (G-002, J-002, BR-001, BR-004).
- Priority: must
- Related goals: G-002, G-006
- Related business rules: BR-001, BR-002, BR-004, BR-006
- Dependencies: FR-001

Acceptance criteria:

- AC-002.1: Given a successful Google OpenID/OAuth consent with mail read and send scopes, when the flow completes, then a Google account appears and tokens are stored encrypted under the vault DEK (not plaintext).
- AC-002.2: Given a successful Microsoft OpenID/OAuth consent with mail read and send scopes, when the flow completes, then an Outlook/Microsoft account appears and tokens are stored encrypted under the vault DEK.
- AC-002.3: Given the user denies consent or the flow errors, when the flow ends, then no partial usable account is persisted (or it is marked failed and not synced).
- AC-002.4: Given an expired access token and a valid refresh token, when sync or API use needs auth, then the system refreshes the access token transparently or surfaces a re-auth error if refresh fails.

Failure and edge cases:

- User cancels browser/auth window
- Scope insufficient for mail read → clear error asking to reconnect
- Duplicate same email address → upsert or reject with clear message
- Offline during callback → recoverable error

### FR-003 - Inbox synchronization

- Requirement: The system shall synchronize inbox messages for connected Google and Microsoft accounts into local SQLite, supporting on-demand sync and/or periodic polling, using provider APIs (Gmail API and Microsoft Graph).
- Rationale: Local unified inbox (G-002, J-003).
- Priority: must
- Related goals: G-002
- Related business rules: BR-002, BR-005
- Dependencies: FR-002

Acceptance criteria:

- AC-003.1: Given a connected account with inbox messages, when sync runs, then recent inbox messages are stored locally with stable remote identifiers.
- AC-003.2: Given a second sync with no changes, when sync runs, then existing messages are not duplicated.
- AC-003.3: Given sync failure (network/API error), when sync runs, then the job records an error state without corrupting already stored messages.

Failure and edge cases:

- Partial page failure mid-batch
- Large mailbox: MVP may limit to N most recent messages (default 200)
- Provider pagination cursors persisted for incremental sync

### FR-004 - Unified inbox and message reading

- Requirement: The system shall present a unified inbox across the user's Google and Outlook accounts and allow opening a message to view headers and body.
- Rationale: Core reading experience (G-003, J-003, BR-005).
- Priority: must
- Related goals: G-003
- Related business rules: BR-002, BR-005, BR-007
- Dependencies: FR-003

Acceptance criteria:

- AC-004.1: Given messages from multiple accounts, when the user opens the unified inbox, then messages are listed newest-first with account identity (provider + address) visible.
- AC-004.2: Given a listed message, when the user opens it, then subject, from, to, date, and body (text and/or sanitized HTML) are displayed.
- AC-004.3: Given a message id not belonging to the unlocked profile, when requested, then access is denied.

Failure and edge cases:

- Missing body → fall back to snippet/text part
- Empty inbox shows empty state consistent with design system

### FR-005 - AI message summary

- Requirement: The system shall generate a concise summary of a selected message using the configured cloud and/or local AI provider.
- Rationale: Productivity assist (G-004, J-004, BR-003, BR-008).
- Priority: must
- Related goals: G-004, G-008
- Related business rules: BR-002, BR-003, BR-008
- Dependencies: FR-004, FR-010

Acceptance criteria:

- AC-005.1: Given an open message with body content, when the user requests a summary, then a short summary is returned and optionally cached for that message.
- AC-005.2: Given AI provider failure, when summary is requested, then a clear error is shown without failing the whole app.
- AC-005.3: Given a message the profile does not own, when summary is requested, then access is denied.

Failure and edge cases:

- Empty body → informative error
- Very long body → truncated to provider context limit with note

### FR-006 - AI reply suggestion

- Requirement: The system shall generate one or more suggested reply drafts for a selected message, supporting tones (e.g. formal, concise, friendly), using the configured cloud and/or local AI provider.
- Rationale: Faster responses (G-005, J-005, BR-003, BR-008).
- Priority: must
- Related goals: G-005, G-008
- Related business rules: BR-002, BR-003, BR-008
- Dependencies: FR-004, FR-010

Acceptance criteria:

- AC-006.1: Given an open message, when the user requests reply suggestions, then at least one draft reply text is returned.
- AC-006.2: Given a tone parameter, when supported, then the draft reflects that tone; otherwise default tone is used with a note.
- AC-006.3: Given AI provider failure, when suggestions are requested, then a clear error is returned (or configured fallback provider is tried once).

Failure and edge cases:

- Automated/no-reply senders → draft still allowed; optional UI warning

### FR-007 - Account listing and removal

- Requirement: The system shall let the user list and remove connected Google/Outlook accounts.
- Rationale: Account lifecycle.
- Priority: should
- Related goals: G-002
- Related business rules: BR-002
- Dependencies: FR-002

Acceptance criteria:

- AC-007.1: Given connected accounts, when listed, then provider, email, and sync status are shown — never access/refresh tokens in plaintext.
- AC-007.2: Given an account id, when deleted, then tokens and synced messages for that account are removed.

Failure and edge cases:

- Delete during active sync → sync cancelled/ignored safely
- Best-effort token revocation at provider on delete (non-blocking if revoke fails)

### FR-008 - Design system shell

- Requirement: The system shall present the MVP UI as **Pidgeon**, using Svelte + Tailwind + shadcn-svelte in a Notion + ChatGPT-inspired layout, with **Lucide** icons (`lucide-svelte` / lucide.dev) for navigation and actions.
- Rationale: Product identity (BR-007, BR-011, G-003–G-005).
- Priority: must
- Related goals: G-003, G-004, G-005
- Related business rules: BR-007, BR-011
- Dependencies: FR-001

Acceptance criteria:

- AC-008.1: Given an unlocked session, when the shell loads, then navigation uses a minimal sidebar + main canvas (not a dense dashboard of cards/stats) and the app identifies itself as **Pidgeon** (sidebar header and window title).
- AC-008.2: Given AI actions, when shown, then they appear in a chat-like assist panel or inline reader actions consistent with the design system doc.
- AC-008.3: Given light theme MVP, when viewing lists and reader, then typography/spacing match the documented design tokens (not default system UI chrome).
- AC-008.4: Given UI chrome (nav, actions, empty states), when icons are shown, then they use Lucide icons — not emoji or ad-hoc SVG sets — unless a brand mark asset is explicitly approved.

Failure and edge cases:

- Narrow window: panes stack or collapse without breaking readability

### FR-009 - Send reply

- Requirement: The system shall send a reply to a selected message through the owning account’s provider API (Gmail API or Microsoft Graph), using the user’s edited or AI-suggested body.
- Rationale: Close the reply loop in MVP (G-007, J-006, BR-009).
- Priority: must
- Related goals: G-007
- Related business rules: BR-002, BR-009
- Dependencies: FR-002, FR-004

Acceptance criteria:

- AC-009.1: Given an open Google-backed message and a non-empty reply body, when the user sends, then Gmail API accepts the send and the UI shows success.
- AC-009.2: Given an open Microsoft-backed message and a non-empty reply body, when the user sends, then Graph accepts the send and the UI shows success.
- AC-009.3: Given provider rejection (auth/scope/network), when send fails, then the UI shows a clear error and the draft body is preserved for retry.
- AC-009.4: Given a message not owned by the unlocked profile, when send is attempted, then access is denied.

Failure and edge cases:

- Missing send scope → prompt reconnect with correct scopes
- Offline → fail without dropping composed text
- Rate limit → backoff message

### FR-010 - AI provider configuration (cloud + local)

- Requirement: The system shall let the user configure a cloud OpenAI-compatible provider and/or a local LLM HTTP endpoint, choose a preferred provider for AI actions, and store API keys encrypted in the vault.
- Rationale: Hybrid AI (G-008, J-007, BR-008, BR-010).
- Priority: must
- Related goals: G-008
- Related business rules: BR-003, BR-008, BR-010
- Dependencies: FR-001

Acceptance criteria:

- AC-010.1: Given a valid cloud base URL + API key, when saved and used, then summary/reply can complete via cloud.
- AC-010.2: Given a valid local OpenAI-compatible endpoint (e.g. Ollama), when saved and used, then summary/reply can complete without calling the cloud.
- AC-010.3: Given both configured and a preference set, when an AI action runs, then the preferred provider is used first; on failure, optional single fallback to the other if enabled.
- AC-010.4: Given no provider configured, when AI is requested, then the UI explains how to configure (open-source BYO keys).

Failure and edge cases:

- Invalid endpoint → clear validation error
- Keys never written to renderer logs or plaintext config files outside vault

## Non-functional requirements

| ID | Quality attribute | Measurable requirement | Verification method |
|---|---|---|---|
| NFR-001 | Security | Argon2id password + wrapped DEK; tokens encrypted at rest; contextIsolation + sandbox; no secrets in git | Security review |
| NFR-002 | Privacy | No analytics of bodies; AI only on explicit action; local AI keeps content local when selected; secrets never logged | Code review + log sampling |
| NFR-003 | Simplicity / cost | One Electron app repo; SQLite in userData; BYO OAuth/AI for OSS | Architecture review |
| NFR-004 | Reliability | Sync/AI/send failures isolated; reading cache works if AI down | Integration tests |
| NFR-005 | Performance | Inbox list of 200 local messages opens in &lt; 2s after unlock on reference hardware | Manual timing |
| NFR-006 | Operability | Docs: backup userData, register Google/Microsoft OAuth apps, configure cloud/local AI | Contributor checklist |
| NFR-007 | UX consistency | UI built with Svelte + Tailwind + shadcn-svelte; Lucide icons; branded as Pidgeon | Design review |
| NFR-008 | Open source hygiene | `.env.example` only; LICENSE file when chosen; no committed client secrets or API keys | Repo audit |

## Data requirements

| Data/entity | Purpose | Owner/source | Sensitivity | Retention |
|---|---|---|---|---|
| UserProfile | Local unlock + wrapped DEK metadata | Local app | High | Until reset |
| Session/Unlock | In-memory DEK + unlock state | Local app | High | Until lock/quit |
| MailAccount | Google/Microsoft connection | OIDC | High (encrypted tokens) | Until account removed |
| Folder | Provider folder/label metadata | Gmail/Graph | Low | Until account removed |
| Message | Cached email | Gmail/Graph | High (content) | Until account removed |
| AiArtifact | Cached summary/suggestions | AI provider output | Medium | Until message/account removed |
| AiSettings | Cloud/local endpoint config | User | High (encrypted API keys) | Until cleared |

## Integrations

| System | Direction | Contract | Authentication | Failure behavior |
|---|---|---|---|---|
| Google OIDC + Gmail API | Outbound | OIDC; Gmail REST read+send | OAuth2 access/refresh | Error; keep cache; preserve draft on send fail |
| Microsoft OIDC + Graph | Outbound | OIDC; Graph mail read+send | OAuth2 access/refresh | Error; keep cache; preserve draft on send fail |
| Cloud AI | Outbound HTTPS | OpenAI-compatible chat | API key in vault | Error or fallback to local if enabled |
| Local AI | Outbound localhost/LAN | OpenAI-compatible chat (e.g. Ollama) | optional key | Error or fallback to cloud if enabled |

## Permissions and trust boundaries

- Renderer untrusted; secrets and provider/AI calls only in main
- IPC validated; unlock required
- OAuth client IDs: user-supplied config (OSS); PKCE; no client secret in renderer
- HTML mail sanitized before render

## Compatibility and migration

- Greenfield MVP; SQLite migrations from day one
- No import from other clients in MVP
- Target: current Electron stable; Windows primary smoke (macOS/Linux best-effort)

## Traceability

| Requirement | Goal/journey | Acceptance criteria | Design section | Task | Evidence |
|---|---|---|---|---|---|
| FR-001 | G-001 / J-001 | AC-001.1–001.4 | Auth, Security | Pending | Pending |
| FR-002 | G-002 / J-002 | AC-002.1–002.4 | OIDC, Data, Security | Pending | Pending |
| FR-003 | G-002 / J-003 | AC-003.1–003.3 | Sync flows, Data | Pending | Pending |
| FR-004 | G-003 / J-003 | AC-004.1–004.3 | Frontend, IPC, Data | Pending | Pending |
| FR-005 | G-004 / J-004 | AC-005.1–005.3 | AI module | Pending | Pending |
| FR-006 | G-005 / J-005 | AC-006.1–006.3 | AI module | Pending | Pending |
| FR-007 | G-002 | AC-007.1–007.2 | IPC, Data | Pending | Pending |
| FR-008 | G-003–005 | AC-008.1–008.3 | Frontend, design system | Pending | Pending |
| FR-009 | G-007 / J-006 | AC-009.1–009.4 | Providers, IPC | Pending | Pending |
| FR-010 | G-008 / J-007 | AC-010.1–010.4 | AI settings, Security | Pending | Pending |
| NFR-001–008 | G-006 | See NFR table | Security, Ops, OSS | Pending | Pending |
