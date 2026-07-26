# OAuth setup (bring your own client IDs)

Pidgeon is open source and does **not** ship Google or Microsoft client secrets. You register your own OAuth applications and paste the **public client IDs** in **Settings**.

Desktop auth uses **OAuth 2.0 Authorization Code + PKCE** with a loopback redirect: `http://127.0.0.1:<ephemeral-port>/callback`.

## Google

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick one).
3. Enable **Gmail API**.
4. Configure the OAuth consent screen (External or Internal).
5. Create credentials → **OAuth client ID** → Application type **Desktop app**.
6. Copy the **Client ID** into Pidgeon → Settings → Google client ID.
7. Add yourself as a test user while the app is in testing.

Scopes requested:

- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

## Microsoft

1. Open [Azure Portal](https://portal.azure.com/) → Microsoft Entra ID → App registrations.
2. **New registration**.
3. Supported account types: accounts in any org + personal Microsoft accounts (or as you prefer).
4. Redirect URI: platform **Public client / native** — you will use loopback; many tenants accept `http://localhost` / `http://127.0.0.1`. If Azure requires a fixed port, file an issue; MVP uses ephemeral ports.
5. Under **Authentication**, enable **Allow public client flows**.
6. Under **API permissions**, add Microsoft Graph delegated: `openid`, `email`, `profile`, `offline_access`, `Mail.Read`, `Mail.Send`.
7. Copy the **Application (client) ID** into Pidgeon → Settings → Microsoft client ID.

## Security notes

- Prefer public clients with PKCE (no client secret in the repo or renderer).
- Tokens are encrypted with your vault DEK after unlock.
- Never commit real client IDs that you consider sensitive into git if your org policy forbids it (public desktop client IDs are usually fine).
