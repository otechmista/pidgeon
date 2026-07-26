import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDb } from "@pidgeon/db";
import {
  mailAccounts,
  folders,
  messages,
  syncJobs,
  oauthClientSettings,
} from "@pidgeon/db";
import { encryptUtf8, decryptUtf8 } from "@pidgeon/crypto";
import type { AccountDto, Provider } from "@pidgeon/shared";
import { ipcError } from "@pidgeon/shared";
import type { VaultState } from "./auth.js";
import { requireUnlock } from "./auth.js";
import {
  runOidcLogin,
  refreshTokens,
  type OAuthTokens,
} from "./oidc.js";

function accountDto(row: typeof mailAccounts.$inferSelect): AccountDto {
  return {
    id: row.id,
    provider: row.provider as Provider,
    emailAddress: row.emailAddress,
    displayName: row.displayName,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
  };
}

export function listAccounts(db: AppDb, state: VaultState) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const items = db
    .select()
    .from(mailAccounts)
    .where(eq(mailAccounts.profileId, state.profileId!))
    .all()
    .map(accountDto);
  return { items };
}

export function getOAuthClients(db: AppDb, state: VaultState) {
  const locked = requireUnlock(state);
  if (locked) return { googleClientId: null, microsoftClientId: null };
  const row = db
    .select()
    .from(oauthClientSettings)
    .where(eq(oauthClientSettings.profileId, state.profileId!))
    .get();
  return {
    googleClientId: row?.googleClientId ?? null,
    microsoftClientId: row?.microsoftClientId ?? null,
  };
}

export function saveOAuthClients(
  db: AppDb,
  state: VaultState,
  input: { googleClientId?: string; microsoftClientId?: string }
) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const now = new Date().toISOString();
  const row = db
    .select()
    .from(oauthClientSettings)
    .where(eq(oauthClientSettings.profileId, state.profileId!))
    .get();
  if (!row) {
    db.insert(oauthClientSettings)
      .values({
        id: randomUUID(),
        profileId: state.profileId!,
        googleClientId: input.googleClientId ?? null,
        microsoftClientId: input.microsoftClientId ?? null,
        updatedAt: now,
      })
      .run();
  } else {
    db.update(oauthClientSettings)
      .set({
        googleClientId: input.googleClientId ?? row.googleClientId,
        microsoftClientId: input.microsoftClientId ?? row.microsoftClientId,
        updatedAt: now,
      })
      .where(eq(oauthClientSettings.id, row.id))
      .run();
  }
  return { ok: true as const };
}

function readTokens(state: VaultState, row: typeof mailAccounts.$inferSelect): OAuthTokens {
  const json = decryptUtf8(state.dek!, {
    ciphertext: row.tokenCiphertext as Buffer,
    nonce: row.tokenNonce as Buffer,
  });
  return JSON.parse(json) as OAuthTokens;
}

function writeTokens(
  db: AppDb,
  state: VaultState,
  accountId: string,
  tokens: OAuthTokens
) {
  const wrapped = encryptUtf8(state.dek!, JSON.stringify(tokens));
  db.update(mailAccounts)
    .set({
      tokenCiphertext: wrapped.ciphertext,
      tokenNonce: wrapped.nonce,
    })
    .where(eq(mailAccounts.id, accountId))
    .run();
}

export async function ensureAccessToken(
  db: AppDb,
  state: VaultState,
  account: typeof mailAccounts.$inferSelect,
  clientId: string
): Promise<string> {
  const tokens = readTokens(state, account);
  if (tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new Error("provider_auth_required");
  }
  const refreshed = await refreshTokens(
    account.provider as Provider,
    clientId,
    tokens.refreshToken
  );
  writeTokens(db, state, account.id, refreshed);
  return refreshed.accessToken;
}

export async function connectAccount(
  db: AppDb,
  state: VaultState,
  provider: Provider,
  openUrl: (url: string) => Promise<void>
) {
  const locked = requireUnlock(state);
  if (locked) return locked;

  const clients = getOAuthClients(db, state);
  const clientId =
    provider === "google" ? clients.googleClientId : clients.microsoftClientId;
  if (!clientId) {
    return ipcError(
      "oauth_client_not_configured",
      `Configure your ${provider} OAuth client ID in Settings first.`
    );
  }

  try {
    const { tokens, profile } = await runOidcLogin({ provider, clientId, openUrl });
    if (!profile.email) {
      return ipcError("oidc_cancelled", "Provider did not return an email address.");
    }

    const existing = db
      .select()
      .from(mailAccounts)
      .where(
        and(
          eq(mailAccounts.profileId, state.profileId!),
          eq(mailAccounts.provider, provider),
          eq(mailAccounts.emailAddress, profile.email)
        )
      )
      .get();

    const wrapped = encryptUtf8(state.dek!, JSON.stringify(tokens));
    const now = new Date().toISOString();

    if (existing) {
      db.update(mailAccounts)
        .set({
          displayName: profile.name ?? existing.displayName,
          providerAccountId: profile.sub,
          tokenCiphertext: wrapped.ciphertext,
          tokenNonce: wrapped.nonce,
          scopesJson: tokens.scope,
          lastError: null,
        })
        .where(eq(mailAccounts.id, existing.id))
        .run();
      return { account: accountDto(db.select().from(mailAccounts).where(eq(mailAccounts.id, existing.id)).get()!) };
    }

    const id = randomUUID();
    db.insert(mailAccounts)
      .values({
        id,
        profileId: state.profileId!,
        provider,
        emailAddress: profile.email,
        displayName: profile.name ?? null,
        providerAccountId: profile.sub,
        tokenCiphertext: wrapped.ciphertext,
        tokenNonce: wrapped.nonce,
        scopesJson: tokens.scope,
        createdAt: now,
      })
      .run();

    return { account: accountDto(db.select().from(mailAccounts).where(eq(mailAccounts.id, id)).get()!) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OIDC failed";
    if (msg === "oidc_cancelled") {
      return ipcError("oidc_cancelled", "Authorization was cancelled.");
    }
    return ipcError("provider_unreachable", msg);
  }
}

export function removeAccount(db: AppDb, state: VaultState, id: string) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const row = db
    .select()
    .from(mailAccounts)
    .where(and(eq(mailAccounts.id, id), eq(mailAccounts.profileId, state.profileId!)))
    .get();
  if (!row) return ipcError("not_found", "Account not found.");
  db.delete(mailAccounts).where(eq(mailAccounts.id, id)).run();
}

export type ProviderMessage = {
  providerMessageId: string;
  providerThreadId?: string;
  messageIdHeader?: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  receivedAt: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  read?: boolean;
};

export async function fetchGoogleInbox(
  accessToken: string,
  limit: number
): Promise<ProviderMessage[]> {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`);
  const listJson = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const out: ProviderMessage[] = [];
  for (const m of listJson.messages ?? []) {
    const det = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!det.ok) continue;
    const json = (await det.json()) as {
      id: string;
      threadId: string;
      snippet?: string;
      internalDate?: string;
      payload?: {
        headers?: { name: string; value: string }[];
        body?: { data?: string };
        parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
      };
      labelIds?: string[];
    };
    const headers = json.payload?.headers ?? [];
    const get = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
    const { text, html } = extractGmailBody(json.payload);
    out.push({
      providerMessageId: json.id,
      providerThreadId: json.threadId,
      messageIdHeader: get("Message-ID"),
      subject: get("Subject"),
      from: get("From"),
      to: get("To"),
      cc: get("Cc"),
      receivedAt: json.internalDate
        ? new Date(Number(json.internalDate)).toISOString()
        : new Date().toISOString(),
      snippet: json.snippet ?? "",
      bodyText: text,
      bodyHtml: html,
      read: !(json.labelIds ?? []).includes("UNREAD"),
    });
  }
  return out;
}

function decodeB64Url(data?: string) {
  if (!data) return "";
  const pad = data.length % 4 === 0 ? "" : "=".repeat(4 - (data.length % 4));
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function extractGmailBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
} | undefined): { text?: string; html?: string } {
  if (!payload) return {};
  let text: string | undefined;
  let html: string | undefined;
  const walk = (part: {
    mimeType?: string;
    body?: { data?: string };
    parts?: { mimeType?: string; body?: { data?: string }; parts?: unknown[] }[];
  }) => {
    if (part.mimeType === "text/plain" && part.body?.data) text = decodeB64Url(part.body.data);
    if (part.mimeType === "text/html" && part.body?.data) html = decodeB64Url(part.body.data);
    for (const p of part.parts ?? []) walk(p as typeof part);
  };
  walk(payload);
  if (!text && !html && payload.body?.data) {
    text = decodeB64Url(payload.body.data);
  }
  return { text, html };
}

export async function fetchMicrosoftInbox(
  accessToken: string,
  limit: number
): Promise<ProviderMessage[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${limit}&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,isRead,conversationId,internetMessageId`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`Graph list failed: ${await res.text()}`);
  const json = (await res.json()) as {
    value: {
      id: string;
      subject?: string;
      bodyPreview?: string;
      body?: { contentType?: string; content?: string };
      from?: { emailAddress?: { name?: string; address?: string } };
      toRecipients?: { emailAddress?: { address?: string } }[];
      ccRecipients?: { emailAddress?: { address?: string } }[];
      receivedDateTime?: string;
      isRead?: boolean;
      conversationId?: string;
      internetMessageId?: string;
    }[];
  };
  return (json.value ?? []).map((m) => {
    const from = m.from?.emailAddress
      ? `${m.from.emailAddress.name ?? ""} <${m.from.emailAddress.address ?? ""}>`.trim()
      : "";
    const to = (m.toRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", ");
    const cc = (m.ccRecipients ?? [])
      .map((r) => r.emailAddress?.address)
      .filter(Boolean)
      .join(", ");
    const isHtml = m.body?.contentType?.toLowerCase() === "html";
    return {
      providerMessageId: m.id,
      providerThreadId: m.conversationId,
      messageIdHeader: m.internetMessageId,
      subject: m.subject ?? "",
      from,
      to,
      cc,
      receivedAt: m.receivedDateTime ?? new Date().toISOString(),
      snippet: m.bodyPreview ?? "",
      bodyText: isHtml ? undefined : m.body?.content,
      bodyHtml: isHtml ? m.body?.content : undefined,
      read: m.isRead,
    };
  });
}

export async function syncAccount(db: AppDb, state: VaultState, accountId: string) {
  const locked = requireUnlock(state);
  if (locked) return locked;

  const account = db
    .select()
    .from(mailAccounts)
    .where(and(eq(mailAccounts.id, accountId), eq(mailAccounts.profileId, state.profileId!)))
    .get();
  if (!account) return ipcError("not_found", "Account not found.");

  const clients = getOAuthClients(db, state);
  const clientId =
    account.provider === "google" ? clients.googleClientId : clients.microsoftClientId;
  if (!clientId) {
    return ipcError("oauth_client_not_configured", "OAuth client ID missing.");
  }

  const jobId = randomUUID();
  const now = new Date().toISOString();
  db.insert(syncJobs)
    .values({
      id: jobId,
      accountId,
      status: "running",
      startedAt: now,
      createdAt: now,
    })
    .run();

  try {
    const accessToken = await ensureAccessToken(db, state, account, clientId);
    const providerMessages =
      account.provider === "google"
        ? await fetchGoogleInbox(accessToken, 50)
        : await fetchMicrosoftInbox(accessToken, 50);

    let folder = db
      .select()
      .from(folders)
      .where(and(eq(folders.accountId, accountId), eq(folders.role, "inbox")))
      .get();
    if (!folder) {
      const folderId = randomUUID();
      db.insert(folders)
        .values({
          id: folderId,
          accountId,
          providerFolderId: "INBOX",
          path: "INBOX",
          role: "inbox",
        })
        .run();
      folder = db.select().from(folders).where(eq(folders.id, folderId)).get()!;
    }

    for (const pm of providerMessages) {
      const existing = db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.accountId, accountId),
            eq(messages.providerMessageId, pm.providerMessageId)
          )
        )
        .get();
      const flags = JSON.stringify({ read: pm.read ?? false });
      if (existing) {
        db.update(messages)
          .set({
            subject: pm.subject,
            fromJson: JSON.stringify([pm.from]),
            toJson: JSON.stringify([pm.to]),
            ccJson: JSON.stringify([pm.cc]),
            snippet: pm.snippet,
            bodyText: pm.bodyText ?? existing.bodyText,
            bodyHtml: pm.bodyHtml ?? existing.bodyHtml,
            flagsJson: flags,
            receivedAt: pm.receivedAt,
          })
          .where(eq(messages.id, existing.id))
          .run();
      } else {
        db.insert(messages)
          .values({
            id: randomUUID(),
            accountId,
            folderId: folder.id,
            providerMessageId: pm.providerMessageId,
            providerThreadId: pm.providerThreadId ?? null,
            messageIdHeader: pm.messageIdHeader ?? null,
            subject: pm.subject,
            fromJson: JSON.stringify([pm.from]),
            toJson: JSON.stringify([pm.to]),
            ccJson: JSON.stringify([pm.cc]),
            receivedAt: pm.receivedAt,
            flagsJson: flags,
            snippet: pm.snippet,
            bodyText: pm.bodyText ?? null,
            bodyHtml: pm.bodyHtml ?? null,
          })
          .run();
      }
    }

    const finished = new Date().toISOString();
    db.update(mailAccounts)
      .set({ lastSyncedAt: finished, lastError: null })
      .where(eq(mailAccounts.id, accountId))
      .run();
    db.update(syncJobs)
      .set({ status: "success", finishedAt: finished })
      .where(eq(syncJobs.id, jobId))
      .run();
    return { jobId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    db.update(mailAccounts)
      .set({ lastError: msg })
      .where(eq(mailAccounts.id, accountId))
      .run();
    db.update(syncJobs)
      .set({ status: "failed", error: msg, finishedAt: new Date().toISOString() })
      .where(eq(syncJobs.id, jobId))
      .run();
    if (msg === "provider_auth_required") {
      return ipcError("provider_auth_required", "Reconnect your account.");
    }
    return ipcError("provider_unreachable", msg);
  }
}

export function listInbox(db: AppDb, state: VaultState, limit = 50, cursor?: string) {
  const locked = requireUnlock(state);
  if (locked) return locked;

  const accountIds = db
    .select()
    .from(mailAccounts)
    .where(eq(mailAccounts.profileId, state.profileId!))
    .all()
    .map((a) => a.id);

  if (accountIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const accountMap = new Map(
    db
      .select()
      .from(mailAccounts)
      .where(eq(mailAccounts.profileId, state.profileId!))
      .all()
      .map((a) => [a.id, a])
  );

  let rows = db.select().from(messages).all();
  rows = rows
    .filter((m) => accountIds.includes(m.accountId))
    .sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1));
  if (cursor) {
    const idx = rows.findIndex((r) => r.id === cursor);
    if (idx >= 0) rows = rows.slice(idx + 1);
  }
  const page = rows.slice(0, limit);
  const items = page.map((m) => {
    const acc = accountMap.get(m.accountId)!;
    const fromArr = JSON.parse(m.fromJson) as string[];
    const flags = JSON.parse(m.flagsJson) as { read?: boolean; starred?: boolean };
    return {
      id: m.id,
      accountId: m.accountId,
      accountName: acc.displayName || acc.emailAddress,
      provider: acc.provider as Provider,
      subject: m.subject,
      from: fromArr[0] ?? "",
      snippet: m.snippet,
      receivedAt: m.receivedAt,
      flags,
    };
  });
  const nextCursor = page.length === limit ? page[page.length - 1]?.id ?? null : null;
  return { items, nextCursor };
}

export function getMessage(db: AppDb, state: VaultState, id: string) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const m = db.select().from(messages).where(eq(messages.id, id)).get();
  if (!m) return ipcError("not_found", "Message not found.");
  const acc = db.select().from(mailAccounts).where(eq(mailAccounts.id, m.accountId)).get();
  if (!acc || acc.profileId !== state.profileId) {
    return ipcError("not_found", "Message not found.");
  }
  const fromArr = JSON.parse(m.fromJson) as string[];
  const toArr = JSON.parse(m.toJson) as string[];
  const ccArr = JSON.parse(m.ccJson) as string[];
  return {
    message: {
      id: m.id,
      accountId: m.accountId,
      provider: acc.provider as Provider,
      subject: m.subject,
      from: fromArr[0] ?? "",
      to: toArr[0] ?? "",
      cc: ccArr[0] ?? "",
      receivedAt: m.receivedAt,
      snippet: m.snippet,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      providerThreadId: m.providerThreadId,
      providerMessageId: m.providerMessageId,
    },
  };
}

export async function sendReply(
  db: AppDb,
  state: VaultState,
  input: { messageId: string; body: string; subject?: string }
) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const got = getMessage(db, state, input.messageId);
  if ("error" in got) return got;
  const { message } = got;
  const account = db.select().from(mailAccounts).where(eq(mailAccounts.id, message.accountId)).get()!;
  const clients = getOAuthClients(db, state);
  const clientId =
    account.provider === "google" ? clients.googleClientId : clients.microsoftClientId;
  if (!clientId) return ipcError("oauth_client_not_configured", "OAuth client ID missing.");

  try {
    const accessToken = await ensureAccessToken(db, state, account, clientId);
    if (account.provider === "google") {
      const subject = input.subject ?? (message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`);
      const raw = [
        `To: ${message.from}`,
        `Subject: ${subject}`,
        `In-Reply-To: ${message.providerMessageId}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        input.body,
      ].join("\r\n");
      const encoded = Buffer.from(raw)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw: encoded,
          threadId: message.providerThreadId ?? undefined,
        }),
      });
      if (!res.ok) return ipcError("send_failed", await res.text());
      const json = (await res.json()) as { id: string };
      return { providerMessageId: json.id };
    }

    const createRes = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${message.providerMessageId}/createReply`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (!createRes.ok) return ipcError("send_failed", await createRes.text());
    const draft = (await createRes.json()) as { id: string };
    const patchRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        body: { contentType: "Text", content: input.body },
      }),
    });
    if (!patchRes.ok) return ipcError("send_failed", await patchRes.text());
    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!sendRes.ok) return ipcError("send_failed", await sendRes.text());
    return { providerMessageId: draft.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return ipcError("send_failed", msg);
  }
}
