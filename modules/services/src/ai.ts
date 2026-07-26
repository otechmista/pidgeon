import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { AppDb } from "@pidgeon/db";
import { aiSettings, aiArtifacts, messages, mailAccounts } from "@pidgeon/db";
import { encryptUtf8, decryptUtf8 } from "@pidgeon/crypto";
import type { AiSettingsDto, Tone } from "@pidgeon/shared";
import { ipcError } from "@pidgeon/shared";
import type { VaultState } from "./auth.js";
import { requireUnlock } from "./auth.js";
import { getMessage } from "./accounts.js";

function maskSettings(row: typeof aiSettings.$inferSelect): AiSettingsDto {
  return {
    preferred: (row.preferred as "cloud" | "local") || "cloud",
    fallbackEnabled: !!row.fallbackEnabled,
    cloudBaseUrl: row.cloudBaseUrl,
    cloudModel: row.cloudModel,
    cloudApiKeySet: !!(row.cloudApiKeyCiphertext && row.cloudApiKeyNonce),
    localBaseUrl: row.localBaseUrl,
    localModel: row.localModel,
    localApiKeySet: !!(row.localApiKeyCiphertext && row.localApiKeyNonce),
  };
}

export function getAiSettings(db: AppDb, state: VaultState) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const row = db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.profileId, state.profileId!))
    .get();
  if (!row) return ipcError("ai_not_configured", "AI settings missing.");
  return maskSettings(row);
}

export function saveAiSettings(
  db: AppDb,
  state: VaultState,
  input: {
    preferred: "cloud" | "local";
    fallbackEnabled: boolean;
    cloud?: { baseUrl?: string; model?: string; apiKey?: string };
    local?: { baseUrl?: string; model?: string; apiKey?: string };
  }
) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const row = db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.profileId, state.profileId!))
    .get();
  if (!row) return ipcError("ai_not_configured", "AI settings missing.");

  const now = new Date().toISOString();
  const patch: Partial<typeof aiSettings.$inferInsert> = {
    preferred: input.preferred,
    fallbackEnabled: input.fallbackEnabled,
    updatedAt: now,
  };

  if (input.cloud) {
    if (input.cloud.baseUrl !== undefined) {
      patch.cloudBaseUrl = input.cloud.baseUrl || null;
    }
    if (input.cloud.model !== undefined) patch.cloudModel = input.cloud.model || null;
    if (input.cloud.apiKey) {
      const w = encryptUtf8(state.dek!, input.cloud.apiKey);
      patch.cloudApiKeyCiphertext = w.ciphertext;
      patch.cloudApiKeyNonce = w.nonce;
    }
  }
  if (input.local) {
    if (input.local.baseUrl !== undefined) {
      patch.localBaseUrl = input.local.baseUrl || null;
    }
    if (input.local.model !== undefined) patch.localModel = input.local.model || null;
    if (input.local.apiKey) {
      const w = encryptUtf8(state.dek!, input.local.apiKey);
      patch.localApiKeyCiphertext = w.ciphertext;
      patch.localApiKeyNonce = w.nonce;
    }
  }

  db.update(aiSettings).set(patch).where(eq(aiSettings.id, row.id)).run();
  return { ok: true as const };
}

function decryptKey(
  state: VaultState,
  ciphertext: Buffer | null,
  nonce: Buffer | null
): string | null {
  if (!ciphertext || !nonce) return null;
  return decryptUtf8(state.dek!, { ciphertext, nonce });
}

async function chatCompletion(opts: {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI request failed: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");
  return content;
}

function providerOrder(preferred: "cloud" | "local", fallback: boolean): Array<"cloud" | "local"> {
  if (!fallback) return [preferred];
  return preferred === "cloud" ? ["cloud", "local"] : ["local", "cloud"];
}

async function runWithRouter(
  db: AppDb,
  state: VaultState,
  system: string,
  user: string
): Promise<{ text: string; provider: string; model: string }> {
  const row = db
    .select()
    .from(aiSettings)
    .where(eq(aiSettings.profileId, state.profileId!))
    .get();
  if (!row) throw new Error("ai_not_configured");

  const order = providerOrder(
    (row.preferred as "cloud" | "local") || "cloud",
    !!row.fallbackEnabled
  );
  let lastError = "ai_not_configured";

  for (const which of order) {
    try {
      if (which === "cloud") {
        if (!row.cloudBaseUrl) {
          lastError = "Cloud AI not configured";
          continue;
        }
        const key = decryptKey(
          state,
          row.cloudApiKeyCiphertext as Buffer | null,
          row.cloudApiKeyNonce as Buffer | null
        );
        const model = row.cloudModel || "gpt-4o-mini";
        const text = await chatCompletion({
          baseUrl: row.cloudBaseUrl,
          apiKey: key,
          model,
          system,
          user,
        });
        return { text, provider: "cloud", model };
      }
      if (!row.localBaseUrl) {
        lastError = "Local AI not configured";
        continue;
      }
      const key = decryptKey(
        state,
        row.localApiKeyCiphertext as Buffer | null,
        row.localApiKeyNonce as Buffer | null
      );
      const model = row.localModel || "llama3.2";
      const text = await chatCompletion({
        baseUrl: row.localBaseUrl,
        apiKey: key,
        model,
        system,
        user,
      });
      return { text, provider: "local", model };
    } catch (e) {
      lastError = e instanceof Error ? e.message : "AI failed";
    }
  }
  throw new Error(lastError);
}

function messageBodyForAi(bodyText: string | null, bodyHtml: string | null, snippet: string) {
  const raw = bodyText || bodyHtml?.replace(/<[^>]+>/g, " ") || snippet;
  return raw.slice(0, 12000);
}

export async function summarizeMessage(
  db: AppDb,
  state: VaultState,
  messageId: string,
  force = false
) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const got = getMessage(db, state, messageId);
  if ("error" in got) return got;

  if (!force) {
    const cached = db
      .select()
      .from(aiArtifacts)
      .where(and(eq(aiArtifacts.messageId, messageId), eq(aiArtifacts.kind, "summary")))
      .get();
    if (cached) {
      return { summary: cached.content, cached: true, provider: cached.model };
    }
  }

  const body = messageBodyForAi(
    got.message.bodyText,
    got.message.bodyHtml,
    got.message.snippet
  );
  if (!body.trim()) {
    return ipcError("invalid_request", "Message has no body to summarize.");
  }

  try {
    const result = await runWithRouter(
      db,
      state,
      "You summarize emails briefly for a busy professional. Output 3-6 short sentences. No preamble.",
      `Subject: ${got.message.subject}\nFrom: ${got.message.from}\n\n${body}`
    );
    const existing = db
      .select()
      .from(aiArtifacts)
      .where(and(eq(aiArtifacts.messageId, messageId), eq(aiArtifacts.kind, "summary")))
      .get();
    if (existing) {
      db.update(aiArtifacts)
        .set({ content: result.text, model: `${result.provider}:${result.model}` })
        .where(eq(aiArtifacts.id, existing.id))
        .run();
    } else {
      db.insert(aiArtifacts)
        .values({
          id: randomUUID(),
          messageId,
          kind: "summary",
          tone: null,
          content: result.text,
          model: `${result.provider}:${result.model}`,
          createdAt: new Date().toISOString(),
        })
        .run();
    }
    return { summary: result.text, cached: false, provider: result.provider };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI unavailable";
    if (msg.includes("not configured")) {
      return ipcError("ai_not_configured", "Configure cloud and/or local AI in Settings.");
    }
    return ipcError("ai_unavailable", msg);
  }
}

export async function suggestReply(
  db: AppDb,
  state: VaultState,
  messageId: string,
  tone: Tone = "concise"
) {
  const locked = requireUnlock(state);
  if (locked) return locked;
  const got = getMessage(db, state, messageId);
  if ("error" in got) return got;

  const body = messageBodyForAi(
    got.message.bodyText,
    got.message.bodyHtml,
    got.message.snippet
  );

  try {
    const result = await runWithRouter(
      db,
      state,
      `You draft email replies. Tone: ${tone}. Output only the reply body, no subject line.`,
      `Reply to this email.\nSubject: ${got.message.subject}\nFrom: ${got.message.from}\n\n${body}`
    );
    const existing = db
      .select()
      .from(aiArtifacts)
      .where(
        and(
          eq(aiArtifacts.messageId, messageId),
          eq(aiArtifacts.kind, "reply"),
          eq(aiArtifacts.tone, tone)
        )
      )
      .get();
    if (existing) {
      db.update(aiArtifacts)
        .set({ content: result.text, model: `${result.provider}:${result.model}` })
        .where(eq(aiArtifacts.id, existing.id))
        .run();
    } else {
      db.insert(aiArtifacts)
        .values({
          id: randomUUID(),
          messageId,
          kind: "reply",
          tone,
          content: result.text,
          model: `${result.provider}:${result.model}`,
          createdAt: new Date().toISOString(),
        })
        .run();
    }
    return { drafts: [result.text], provider: result.provider };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI unavailable";
    if (msg.includes("not configured")) {
      return ipcError("ai_not_configured", "Configure cloud and/or local AI in Settings.");
    }
    return ipcError("ai_unavailable", msg);
  }
}

void 0;
