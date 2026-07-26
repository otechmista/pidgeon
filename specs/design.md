---
status: approved
last_updated: "2026-07-25"
---

# Technical design

## Context and drivers

- Requirements: FR-001–FR-010, NFR-001–NFR-008
- Quality attributes: security (password-wrapped DEK), privacy, simplicity, local-first, OSS hygiene, Notion/ChatGPT UX
- Constraints: Electron modular monolith; Svelte + Tailwind + shadcn-svelte + Lucide; brand **Pidgeon**; SQLite; Google/Outlook OpenID; cloud+local AI; send reply; open source BYO secrets

## Proposed solution

A **TypeScript Electron modular monolith** (open source):

- **Main process**: vault unlock (Argon2id → wrap DEK), OIDC, Gmail + Graph sync/**send**, hybrid AI router, SQLite
- **Renderer**: Svelte + Vite + Tailwind + **shadcn-svelte**, Notion + ChatGPT shell
- **IPC** typed — no public HTTP server
- **SQLite** in Electron `userData`
- **OpenID Connect** (auth code + PKCE) for Google and Microsoft; mail via **Gmail API** + **Microsoft Graph** (read + send)
- **Secrets**: DEK wrapped by password-derived key; token/API-key ciphertext in DB; optional OS `safeStorage` for sealed blobs — app stays locked until password unlock
- **AI**: dual backends — cloud OpenAI-compatible + local OpenAI-compatible (e.g. Ollama); preference + one fallback
- **OSS**: users supply Google/Microsoft OAuth client IDs and AI keys via local config; nothing secret in git

## System boundaries

### Inside

- Electron app (main + preload + renderer)
- Domain modules (auth, oidc, accounts, sync, messages, compose/send, ai, crypto)
- SQLite + vault crypto
- Design system / UI kit (shadcn-svelte)

### Outside

- Google identity + Gmail API
- Microsoft identity + Graph
- Cloud AI HTTP API (user-configured)
- Local AI HTTP endpoint (user-configured)
- System browser / auth window for OIDC

## Architecture

| Component | Responsibility | Owns | Depends on |
|---|---|---|---|
| `apps/desktop` main | Window, IPC, hardened session | process | modules |
| `apps/desktop` preload | Typed `window.pidgeon` bridge | bridge | electron |
| `apps/web` renderer | Svelte UI | UI state | IPC |
| `modules/auth` | Profile, Argon2id, wrap/unwrap DEK | profiles, key material | crypto, DB |
| `modules/oidc` | Google/Microsoft PKCE, refresh | token ciphertext | auth DEK |
| `modules/mail-accounts` | Account CRUD | mail_accounts | oidc, DB |
| `modules/sync` | Inbox sync | sync_jobs | providers, DB |
| `modules/providers/gmail` | Gmail read + send | — | oidc |
| `modules/providers/microsoft` | Graph read + send | — | oidc |
| `modules/messages` | Unified inbox queries | — | DB |
| `modules/compose` | Reply send orchestration | — | providers, messages |
| `modules/ai` | Summary/reply + provider router | ai_artifacts, ai_settings | cloud/local HTTP |
| `modules/crypto` | KDF, AES-GCM wrap | — | — |
| `packages/db` | Drizzle + migrations | schema | better-sqlite3 |
| `packages/shared` | Zod + IPC contracts | — | — |
| `packages/ui` | shadcn-svelte + tokens | design system | svelte |

```text
┌─ Renderer (Svelte + Tailwind + shadcn-svelte) ───────────┐
│  sidebar · inbox · reader · compose · AI assist panel    │
└────────────────── IPC ───────────────────────────────────┘
┌─ Main ───────────────────────────────────────────────────┐
│  vault(DEK) · oidc · sync · compose/send · ai router · db│
│    ↘ Gmail API  ↘ Graph  ↘ cloud AI  ↘ local AI (Ollama) │
└──────────────────────────────────────────────────────────┘
```

## Runtime flows

### Flow F-001 - Unlock vault

1. `auth.unlock({ password })`
2. Argon2id verify + derive KEK; unwrap DEK into memory
3. Unlock flag set; IPC unblocked

### Flow F-002 - Connect account (OpenID)

1. `accounts.connect({ provider })` — requires configured OAuth client id (BYO)
2. OIDC auth code + PKCE
3. Encrypt tokens with DEK; insert account; enqueue sync

### Flow F-003 - Sync inbox

1. Refresh access token if needed
2. Gmail list/get or Graph inbox messages
3. Upsert by `provider_message_id`; persist cursors

### Flow F-004 - Read unified inbox

1. `inbox.list` / `messages.get`
2. Sanitize HTML in renderer

### Flow F-005 - AI summary / reply

1. Load `ai_settings` (preferred provider, fallback flag)
2. Call cloud or local OpenAI-compatible chat
3. Cache artifact; return to AI panel

### Flow F-006 - Send reply

1. `messages.sendReply({ messageId, body, to? })`
2. Resolve account provider; refresh token
3. Gmail `users.messages.send` (reply thread) or Graph `createReply`/`send`
4. On success update local flags/optional sent stub; on failure keep body for retry

### Flow F-007 - Configure AI

1. `ai.saveSettings({ cloud?, local?, preferred, fallback })`
2. Encrypt API keys with DEK; persist non-secret endpoints in DB

## Technology decisions

| Decision | Choice | Alternatives | Rationale | Consequences |
|---|---|---|---|---|
| Language | TypeScript + Bun workspaces | pnpm/npm | User: project is Bun | Bun installs/scripts/tests; Electron main still Node |
| UI | Svelte + Tailwind + shadcn-svelte | React | User requirement | shadcn-svelte ecosystem |
| Icons | Lucide (`lucide-svelte` / lucide.dev) | Heroicons, emoji | User requirement | One icon set for chrome |
| Brand | **Pidgeon** | — | User requirement | Title, sidebar, docs |
| Design | Notion + ChatGPT-like | Dense mail chrome | User requirement | `docs/design-system.md` |
| DB | SQLite + Drizzle | Postgres | Local OSS | Single device |
| FE↔BE | Typed IPC | Local HTTP | Desktop safety | No remote API MVP |
| Mail | Gmail API + Graph | IMAP XOAUTH2 | Cleaner for Google/Outlook | Two adapters |
| Auth vault | Argon2id + wrapped DEK | OS-session only | User: most secure | Forgot password = vault reset |
| AI | Cloud + local OpenAI-compatible | Cloud only | User: both | Settings UX + router |
| Send | Provider API in MVP | Drafts only | User decision | Need Mail.send scopes |
| OSS secrets | BYO OAuth client + AI keys | Bundled client secret | Open source | Setup docs required |

## Data

- Applicability: required
- Detail: `docs/data-model.md`
- Upsert key: `(account_id, provider_message_id)`
- New: `ai_settings` (endpoints, preferred, encrypted keys, fallback)
- `profiles` stores password_hash + wrapped_dek + kdf params

## APIs and integrations

- Contracts: `docs/api-standard.md` (IPC)
- OAuth scopes MVP: read + send (Google Gmail modify/send as required by API; Microsoft `Mail.Read` + `Mail.Send`)
- AI timeouts 30s; provider send timeout explicit; coalesce sync jobs

### IPC channels (MVP)

| Channel | Purpose |
|---|---|
| `auth.register` / `auth.unlock` / `auth.lock` / `auth.me` | Vault |
| `accounts.list` / `connect` / `remove` / `sync` | Accounts |
| `inbox.list` / `messages.get` | Read |
| `messages.sendReply` | Send reply |
| `ai.summarize` / `ai.suggestReply` | AI actions |
| `ai.getSettings` / `ai.saveSettings` | Cloud + local config |
| `settings.getOAuthClients` / `settings.saveOAuthClients` | BYO Google/Microsoft client ids |
| `app.health` | Diagnostics |

## Frontend and user experience

- Rules: `docs/design-system.md`
- Brand: **Pidgeon** in window title and sidebar
- Icons: Lucide only for UI chrome (`lucide-svelte`)
- Compose: reader → reply editor (AI drafts paste into editor) → Send
- Settings: OAuth client IDs, AI cloud, AI local, preferred provider, fallback toggle
- AI panel ChatGPT-like; never auto-call on open

## Security and privacy

- Password-wrapped DEK; locked = no plaintext secrets in memory
- `contextIsolation`, `nodeIntegration: false`
- No secrets in repository; `.env.example` + in-app settings only
- Destructive vault reset documented if password forgotten
- Sanitize HTML; minimal scopes; revoke on account delete (best effort)

## Reliability and operations

- Typed IPC errors; send failures preserve draft
- AI router: prefer configured choice; one fallback if enabled
- Docs for: OAuth app registration (Google + Azure), Ollama local setup, cloud key setup, backup caveats

## Testing strategy

| Level | Scope | Critical cases | Tools |
|---|---|---|---|
| Unit | KDF/wrap, upsert, AI router | wrong password, fallback | bun:test |
| Integration | SQLite + mocked Gmail/Graph/AI | unlock, sync, send, summarize | bun:test |
| E2E smoke | Electron | unlock → open → suggest → send (mocked providers) | Playwright Electron / manual |

## Folder structure (proposed)

```text
pidgeon/
  apps/
    desktop/                 # Electron main + preload
    web/                     # Svelte renderer
  modules/
    auth/
    oidc/
    mail-accounts/
    sync/
    providers/gmail/
    providers/microsoft/
    messages/
    compose/
    ai/
    crypto/
  packages/
    db/
    shared/
    ui/
  docs/
    data-model.md
    api-standard.md
    design-system.md
    oauth-setup.md           # OSS BYO OAuth guide (create when implementing)
  specs/
  .env.example
  LICENSE                    # when owner chooses SPDX
  package.json
  electron-builder.yml
  README.md
```

## Risks and unresolved decisions

| Risk/decision | Impact | Resolution |
|---|---|---|
| BYO OAuth friction | Contributor onboarding | Strong `oauth-setup` docs |
| Send scopes increase verification burden | Harder public OAuth clients | Expected for OSS BYO |
| Local model quality | Weak drafts | User can prefer cloud |
| License SPDX unset | Legal ambiguity | Owner chooses before publish |
| Graph vs IMAP | Adapter work | Default Gmail API + Graph |
| Single profile | Later multi-user | Open, non-blocking |
