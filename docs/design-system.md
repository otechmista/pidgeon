# Design system

Source: `specs/design.md`. Visual and interaction rules for **Pidgeon** MVP.

Product name: **Pidgeon** (exact spelling). Window title, sidebar brand, and user-facing copy use this name.

Inspired by **Notion** (calm documents, sidebar navigation, airy spacing) and **ChatGPT** (assist panel, conversational AI actions). Implemented with **Svelte + Tailwind CSS + shadcn-svelte**. Icons from **[Lucide](https://lucide.dev)** via `lucide-svelte`.

## Principles

1. One composition: shell reads as sidebar + canvas, not a metrics dashboard.
2. Calm density: generous whitespace, subtle 1px borders, minimal shadows.
3. AI is a panel/action, not a popup sticker layer on content.
4. No card grids in the primary inbox chrome; lists and panes instead.
5. Brand **Pidgeon** visible in sidebar header at a confident size; content headlines stay secondary.
6. Icons are Lucide only for UI chrome (nav, actions, status) — consistent size/stroke; no emoji as icons.

## Icons (Lucide)

- Package: `lucide-svelte`
- Default size: 16–20px in chrome; stroke inherits currentColor
- Prefer semantic Lucide names, e.g.:
  - Inbox / mail list: `Inbox`, `Mail`
  - Send / reply: `Send`, `Reply`
  - AI assist: `Sparkles` or `Bot`
  - Settings: `Settings`
  - Search (post-MVP): `Search`
  - Account connect: `Plus`, provider labels as text (not unofficial brand mark misuse)
  - Lock / unlock: `Lock`, `Unlock`
- Do not mix icon libraries. Custom brand mark (logo) is separate from Lucide UI icons.

## Layout

```text
┌──────────┬────────────────────────────┬─────────────────┐
│ Sidebar  │  List  /  Reader           │  AI assist      │
│ accounts │                            │  (optional)     │
│ nav      │                            │                 │
└──────────┴────────────────────────────┴─────────────────┘
```

- Sidebar ~240px: account switcher, Unified Inbox, settings
- Center: message list OR split list+reader on wide screens
- Right AI panel ~360px: summary output, reply drafts, tone chips — ChatGPT-like transcript of assist actions for the open message
- Narrow widths: stack; AI panel as drawer

## Typography

- UI sans: distinctive geometric/grotesk via Tailwind theme (avoid Inter/Roboto/Arial defaults)
- Reader body: comfortable size (~15–16px), long-line measure capped
- Hierarchy: few weights; no loud display hero inside the app shell

## Color & surfaces

Define CSS variables in `packages/ui`:

- `--background`, `--foreground`, `--muted`, `--border`, `--accent`, `--sidebar`
- Light theme first for MVP
- Accent restrained (single action color) — avoid purple-gradient / glow clichés
- Surfaces: soft gray sidebar, near-white canvas, hairline borders (Notion-like)

## Components (shadcn-svelte)

Prefer primitives: Button, Input, Textarea, ScrollArea, Separator, DropdownMenu, Dialog, Sheet, Tooltip, Tabs, Avatar, Badge (sparingly).

App-level:

- `AppSidebar` (brand label **Pidgeon** + Lucide nav icons)
- `MessageList` / `MessageRow`
- `MessageReader`
- `AiAssistPanel`
- `ReplyComposer` (Send via Lucide `Send`)
- `AccountConnectMenu` (Google / Outlook)

## Motion

2–3 intentional motions only:

1. AI panel open/close (short ease)
2. Message selection highlight fade
3. Subtle sync/spinner in sidebar — no confetti or bounce noise

## AI UX

- Explicit triggers: “Summarize”, “Suggest reply”
- Tone control as simple text actions (formal / concise / friendly), not pill spam
- Suggested drafts land in the reply composer; user edits then **Send**
- Settings expose cloud vs local provider and preference (OSS BYO keys)
- Streaming optional post-MVP; MVP may return full text
- Never auto-call AI on message open

## Don’ts

- No hero marketing layouts inside the mail app
- No floating promo badges on the reader
- No dense icon toolbars competing with content
- No default “AI purple glow” aesthetic
- No emoji or non-Lucide icon packs for UI chrome
