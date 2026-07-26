import { z } from "zod";

export const ProviderSchema = z.enum(["google", "microsoft"]);
export type Provider = z.infer<typeof ProviderSchema>;

export const ToneSchema = z.enum(["formal", "concise", "friendly"]);
export type Tone = z.infer<typeof ToneSchema>;

export const AiPreferredSchema = z.enum(["cloud", "local"]);
export type AiPreferred = z.infer<typeof AiPreferredSchema>;

export type IpcError = {
  error: {
    code: string;
    message: string;
  };
};

export function ipcError(code: string, message: string): IpcError {
  return { error: { code, message } };
}

export const AuthRegisterInput = z.object({
  displayName: z.string().optional(),
  password: z.string().min(8),
});

export const AuthUnlockInput = z.object({
  password: z.string().min(1),
});

export const AccountsConnectInput = z.object({
  provider: ProviderSchema,
});

export const IdInput = z.object({
  id: z.string().uuid(),
});

export const InboxListInput = z.object({
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

export const MessageIdInput = z.object({
  id: z.string().uuid(),
});

export const AiSummarizeInput = z.object({
  messageId: z.string().uuid(),
  force: z.boolean().optional(),
});

export const AiSuggestReplyInput = z.object({
  messageId: z.string().uuid(),
  tone: ToneSchema.optional(),
});

export const AiSaveSettingsInput = z.object({
  preferred: AiPreferredSchema,
  fallbackEnabled: z.boolean(),
  cloud: z
    .object({
      baseUrl: z.string().url().optional().or(z.literal("")),
      model: z.string().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
  local: z
    .object({
      baseUrl: z.string().optional(),
      model: z.string().optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
});

export const OAuthClientsInput = z.object({
  googleClientId: z.string().optional(),
  microsoftClientId: z.string().optional(),
});

export const SendReplyInput = z.object({
  messageId: z.string().uuid(),
  body: z.string().min(1),
  subject: z.string().optional(),
});

export type ProfileDto = {
  id: string;
  displayName: string | null;
  createdAt: string;
};

export type AccountDto = {
  id: string;
  provider: Provider;
  emailAddress: string;
  displayName: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type InboxItemDto = {
  id: string;
  accountId: string;
  accountName: string;
  provider: Provider;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: string;
  flags: { read?: boolean; starred?: boolean };
};

export type MessageDto = {
  id: string;
  accountId: string;
  provider: Provider;
  subject: string;
  from: string;
  to: string;
  cc: string;
  receivedAt: string;
  snippet: string;
  bodyText: string | null;
  bodyHtml: string | null;
  providerThreadId: string | null;
  providerMessageId: string;
};

export type AiSettingsDto = {
  preferred: AiPreferred;
  fallbackEnabled: boolean;
  cloudBaseUrl: string | null;
  cloudModel: string | null;
  cloudApiKeySet: boolean;
  localBaseUrl: string | null;
  localModel: string | null;
  localApiKeySet: boolean;
};

export type PidgeonApi = {
  auth: {
    register: (input: z.infer<typeof AuthRegisterInput>) => Promise<
      { profile: ProfileDto } | IpcError
    >;
    unlock: (input: z.infer<typeof AuthUnlockInput>) => Promise<
      { profile: ProfileDto } | IpcError
    >;
    lock: () => Promise<void>;
    me: () => Promise<{ profile: ProfileDto | null; unlocked: boolean }>;
  };
  accounts: {
    list: () => Promise<{ items: AccountDto[] } | IpcError>;
    connect: (input: z.infer<typeof AccountsConnectInput>) => Promise<
      { account: AccountDto } | IpcError
    >;
    remove: (input: z.infer<typeof IdInput>) => Promise<void | IpcError>;
    sync: (input: z.infer<typeof IdInput>) => Promise<{ jobId: string } | IpcError>;
  };
  inbox: {
    list: (input?: z.infer<typeof InboxListInput>) => Promise<
      { items: InboxItemDto[]; nextCursor: string | null } | IpcError
    >;
  };
  messages: {
    get: (input: z.infer<typeof MessageIdInput>) => Promise<{ message: MessageDto } | IpcError>;
    sendReply: (
      input: z.infer<typeof SendReplyInput>
    ) => Promise<{ providerMessageId: string } | IpcError>;
  };
  ai: {
    summarize: (
      input: z.infer<typeof AiSummarizeInput>
    ) => Promise<{ summary: string; cached: boolean; provider: string } | IpcError>;
    suggestReply: (
      input: z.infer<typeof AiSuggestReplyInput>
    ) => Promise<{ drafts: string[]; provider: string } | IpcError>;
    getSettings: () => Promise<AiSettingsDto | IpcError>;
    saveSettings: (
      input: z.infer<typeof AiSaveSettingsInput>
    ) => Promise<{ ok: true } | IpcError>;
  };
  settings: {
    getOAuthClients: () => Promise<{
      googleClientId: string | null;
      microsoftClientId: string | null;
    }>;
    saveOAuthClients: (
      input: z.infer<typeof OAuthClientsInput>
    ) => Promise<{ ok: true } | IpcError>;
  };
  app: {
    health: () => Promise<{ status: "ok"; db: boolean; unlocked: boolean }>;
  };
};

declare global {
  interface Window {
    pidgeon: PidgeonApi;
  }
}

export {};
