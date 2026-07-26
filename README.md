# Pidgeon

Open-source desktop email client (Electron) with unified Google + Outlook inboxes, local SQLite vault, and hybrid AI (cloud + local).

## Stack

- **Bun** workspaces (package manager + scripts + tests)
- Electron + Svelte + Tailwind + Lucide
- SQLite (Drizzle + better-sqlite3 in Electron main)
- OpenID Connect (PKCE) for Google and Microsoft
- Gmail API + Microsoft Graph for sync/send
- Argon2id password-wrapped DEK for secrets at rest

## Specs

Product docs live under [`specs/`](specs/). Follow [`AGENTS.md`](AGENTS.md) for the spec-driven workflow.

## Develop

Requirements: [Bun](https://bun.sh) 1.1+ (and Node-compatible Electron runtime).

```bash
bun install
bun run dev
```

This starts the Vite renderer and opens Electron titled **Pidgeon**.

```bash
bun test
```

## First run

1. Create a vault password (min 8 characters).
2. Settings → paste BYO Google/Microsoft OAuth client IDs ([docs/oauth-setup.md](docs/oauth-setup.md)).
3. Configure cloud and/or local AI (OpenAI-compatible, e.g. Ollama at `http://127.0.0.1:11434/v1`).
4. Connect Google / Outlook → sync → read → summarize / suggest reply → send.

## License

MIT — see [LICENSE](LICENSE).
