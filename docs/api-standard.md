# API standard (IPC)

Source: `specs/design.md`. MVP communication is **Electron IPC**, not a public HTTP API.

## Conventions

- Preload exposes a typed `window.pidgeon` API via `contextBridge`
- Every channel validates unlock state (except `auth.*` register/unlock and `app.health`)
- Inputs validated with Zod schemas from `packages/shared`
- Errors:

```json
{
  "error": {
    "code": "provider_auth_required",
    "message": "Reconnect your Microsoft account"
  }
}
```

- List pagination: `limit` (default 50, max 200) + opaque `cursor`
- Timestamps: ISO-8601 UTC
- IDs: UUID strings

## Channels

### Auth

| Channel | Input | Success |
|---|---|---|
| `auth.register` | `{ displayName?, password }` | `{ profile }` |
| `auth.unlock` | `{ password }` | `{ profile }` |
| `auth.lock` | — | `void` |
| `auth.me` | — | `{ profile, unlocked: boolean }` |

### Accounts

| Channel | Input | Success |
|---|---|---|
| `accounts.list` | — | `{ items: Account[] }` |
| `accounts.connect` | `{ provider: "google" \| "microsoft" }` | `{ account }` after OIDC success |
| `accounts.remove` | `{ id }` | `void` |
| `accounts.sync` | `{ id }` | `{ jobId }` |

`Account` (response): id, provider, emailAddress, displayName, lastSyncedAt, lastError — **never tokens**.

### Inbox & messages

| Channel | Input | Success |
|---|---|---|
| `inbox.list` | `{ limit?, cursor? }` | `{ items, nextCursor }` |
| `messages.get` | `{ id }` | `{ message }` |

### AI

| Channel | Input | Success |
|---|---|---|
| `ai.summarize` | `{ messageId, force? }` | `{ summary, cached, provider }` |
| `ai.suggestReply` | `{ messageId, tone?: "formal"\|"concise"\|"friendly" }` | `{ drafts: string[], provider }` |
| `ai.getSettings` | — | settings **without** raw API keys (masked) |
| `ai.saveSettings` | `{ preferred, fallbackEnabled, cloud?, local? }` | `{ ok: true }` |

### Compose / send

| Channel | Input | Success |
|---|---|---|
| `messages.sendReply` | `{ messageId, body, subject? }` | `{ providerMessageId }` |

### Settings (OSS BYO)

| Channel | Input | Success |
|---|---|---|
| `settings.getOAuthClients` | — | `{ googleClientId?, microsoftClientId? }` |
| `settings.saveOAuthClients` | `{ googleClientId?, microsoftClientId? }` | `{ ok: true }` |

### App

| Channel | Input | Success |
|---|---|---|
| `app.health` | — | `{ status: "ok", db: boolean, unlocked: boolean }` |

## Provider OIDC (main-process only)

Not exposed as renderer HTTP. Main process:

1. Generate PKCE verifier/challenge
2. Open auth URL (Google or Microsoft authority) using **user-configured client id**
3. Receive redirect on loopback or custom protocol
4. Exchange code; encrypt tokens with vault DEK
5. Resolve email/profile from UserInfo or mail API

### Required scopes (MVP read + send)

- Google: OpenID profile email + Gmail scopes sufficient to read inbox and send replies (finalize against current Gmail API docs at implement time)
- Microsoft: OpenID profile email + `Mail.Read` + `Mail.Send`

## Failure mapping

- Validation → `invalid_request`
- Locked → `app_locked`
- OIDC cancel → `oidc_cancelled`
- Missing OAuth client id config → `oauth_client_not_configured`
- Token refresh fail → `provider_auth_required`
- Gmail/Graph errors → `provider_unreachable` / `provider_rate_limited`
- Send fail → `send_failed` (draft preserved client-side)
- AI down → `ai_unavailable`
- AI not configured → `ai_not_configured`
