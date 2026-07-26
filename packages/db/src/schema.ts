import { sqliteTable, text, integer, blob, uniqueIndex } from "drizzle-orm/sqlite-core";

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  displayName: text("display_name"),
  passwordHash: text("password_hash").notNull(),
  kdfSalt: blob("kdf_salt", { mode: "buffer" }).notNull(),
  kdfParamsJson: text("kdf_params_json").notNull(),
  wrappedDek: blob("wrapped_dek", { mode: "buffer" }).notNull(),
  wrappedDekNonce: blob("wrapped_dek_nonce", { mode: "buffer" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiSettings = sqliteTable("ai_settings", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  preferred: text("preferred").notNull().default("cloud"),
  fallbackEnabled: integer("fallback_enabled", { mode: "boolean" }).notNull().default(true),
  cloudBaseUrl: text("cloud_base_url"),
  cloudModel: text("cloud_model"),
  cloudApiKeyCiphertext: blob("cloud_api_key_ciphertext", { mode: "buffer" }),
  cloudApiKeyNonce: blob("cloud_api_key_nonce", { mode: "buffer" }),
  localBaseUrl: text("local_base_url"),
  localModel: text("local_model"),
  localApiKeyCiphertext: blob("local_api_key_ciphertext", { mode: "buffer" }),
  localApiKeyNonce: blob("local_api_key_nonce", { mode: "buffer" }),
  updatedAt: text("updated_at").notNull(),
});

export const oauthClientSettings = sqliteTable("oauth_client_settings", {
  id: text("id").primaryKey(),
  profileId: text("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  googleClientId: text("google_client_id"),
  microsoftClientId: text("microsoft_client_id"),
  updatedAt: text("updated_at").notNull(),
});

export const mailAccounts = sqliteTable(
  "mail_accounts",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    emailAddress: text("email_address").notNull(),
    displayName: text("display_name"),
    providerAccountId: text("provider_account_id"),
    tokenCiphertext: blob("token_ciphertext", { mode: "buffer" }).notNull(),
    tokenNonce: blob("token_nonce", { mode: "buffer" }).notNull(),
    scopesJson: text("scopes_json").notNull(),
    syncCursorJson: text("sync_cursor_json"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("mail_accounts_profile_provider_email").on(
      t.profileId,
      t.provider,
      t.emailAddress
    ),
  })
);

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => mailAccounts.id, { onDelete: "cascade" }),
    providerFolderId: text("provider_folder_id").notNull(),
    path: text("path").notNull(),
    role: text("role").notNull().default("inbox"),
  },
  (t) => ({
    uniq: uniqueIndex("folders_account_provider").on(t.accountId, t.providerFolderId),
  })
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => mailAccounts.id, { onDelete: "cascade" }),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    providerThreadId: text("provider_thread_id"),
    messageIdHeader: text("message_id_header"),
    subject: text("subject").notNull().default(""),
    fromJson: text("from_json").notNull().default("[]"),
    toJson: text("to_json").notNull().default("[]"),
    ccJson: text("cc_json").notNull().default("[]"),
    receivedAt: text("received_at").notNull(),
    flagsJson: text("flags_json").notNull().default("{}"),
    snippet: text("snippet").notNull().default(""),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    rawSize: integer("raw_size"),
  },
  (t) => ({
    uniq: uniqueIndex("messages_account_provider_msg").on(t.accountId, t.providerMessageId),
  })
);

export const syncJobs = sqliteTable("sync_jobs", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => mailAccounts.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  error: text("error"),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
  createdAt: text("created_at").notNull(),
});

export const aiArtifacts = sqliteTable(
  "ai_artifacts",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    tone: text("tone"),
    content: text("content").notNull(),
    model: text("model").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("ai_artifacts_msg_kind_tone").on(t.messageId, t.kind, t.tone),
  })
);
