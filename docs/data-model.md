# Data model

Source: `specs/design.md`. MVP schema for Pidgeon (Electron + SQLite).

## ER overview

```text
profiles 1─1 ai_settings
profiles 1─1 oauth_client_settings
profiles 1─* mail_accounts 1─* folders 1─* messages 1─* ai_artifacts
mail_accounts 1─* sync_jobs
```

OAuth token ciphertext is encrypted with the vault **DEK** (unwrapped only after app-password unlock). OS `safeStorage` may hold additional sealed material but does not replace the password gate.

## Tables

### profiles

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| display_name | text | optional |
| password_hash | text | Argon2id (verify) |
| kdf_salt | blob | for KEK derivation |
| kdf_params_json | text | Argon2id params |
| wrapped_dek | blob | DEK encrypted by KEK |
| wrapped_dek_nonce | blob | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

MVP: typically one profile per install.

### ai_settings

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| profile_id | text | FK profiles, unique |
| preferred | text | `cloud` \| `local` |
| fallback_enabled | integer/bool | |
| cloud_base_url | text | nullable |
| cloud_model | text | nullable |
| cloud_api_key_ciphertext | blob | nullable; DEK-encrypted |
| cloud_api_key_nonce | blob | nullable |
| local_base_url | text | nullable e.g. `http://127.0.0.1:11434/v1` |
| local_model | text | nullable |
| local_api_key_ciphertext | blob | nullable |
| local_api_key_nonce | blob | nullable |
| updated_at | timestamptz | |

### oauth_client_settings

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| profile_id | text | FK profiles, unique |
| google_client_id | text | BYO; public desktop id |
| microsoft_client_id | text | BYO |
| updated_at | timestamptz | |

No client secrets required for public PKCE desktop clients; if a secret is ever needed it must be DEK-encrypted — never committed.

### mail_accounts

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| profile_id | text | FK profiles |
| provider | text | `google` \| `microsoft` |
| email_address | text | |
| display_name | text | nullable |
| provider_account_id | text | subject / oid from IdP when available |
| token_secret_id | text | key into safeStorage or encrypted blob id |
| scopes_json | text | granted scopes |
| sync_cursor_json | text | Gmail pageToken / Graph deltaLink etc. |
| last_synced_at | timestamptz | nullable |
| last_error | text | nullable |
| created_at | timestamptz | |
| unique | (profile_id, provider, email_address) | |

### folders

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| account_id | text | FK mail_accounts |
| provider_folder_id | text | Gmail labelId or Graph folder id |
| path | text | display path |
| role | text | `inbox` for MVP |
| unique | (account_id, provider_folder_id) | |

### messages

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| account_id | text | FK |
| folder_id | text | FK |
| provider_message_id | text | Gmail id / Graph id |
| provider_thread_id | text | nullable |
| message_id_header | text | nullable RFC Message-ID |
| subject | text | |
| from_json | text | JSON addresses |
| to_json | text | |
| cc_json | text | |
| received_at | timestamptz | |
| flags_json | text | read/starred etc. |
| snippet | text | |
| body_text | text | nullable |
| body_html | text | nullable |
| raw_size | integer | nullable |
| unique | (account_id, provider_message_id) | |

### sync_jobs

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| account_id | text | FK |
| status | text | `queued`/`running`/`success`/`failed` |
| error | text | nullable |
| started_at | timestamptz | nullable |
| finished_at | timestamptz | nullable |
| created_at | timestamptz | |

### ai_artifacts

| Column | Type | Notes |
|---|---|---|
| id | text uuid | PK |
| message_id | text | FK messages |
| kind | text | `summary` \| `reply` |
| tone | text | nullable |
| content | text | |
| model | text | |
| created_at | timestamptz | |
| unique | (message_id, kind, tone) | optional cache key |

## Lifecycle

- Delete `mail_accounts` → cascade folders, messages, sync_jobs, related ai_artifacts; delete token from safeStorage
- Sync idempotent on `(account_id, provider_message_id)`
- MVP retention: until account deletion
