import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export * from "./schema.js";

export type AppDb = ReturnType<typeof createDb>;

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  return drizzle(sqlite, { schema });
}

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      password_hash TEXT NOT NULL,
      kdf_salt BLOB NOT NULL,
      kdf_params_json TEXT NOT NULL,
      wrapped_dek BLOB NOT NULL,
      wrapped_dek_nonce BLOB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      preferred TEXT NOT NULL DEFAULT 'cloud',
      fallback_enabled INTEGER NOT NULL DEFAULT 1,
      cloud_base_url TEXT,
      cloud_model TEXT,
      cloud_api_key_ciphertext BLOB,
      cloud_api_key_nonce BLOB,
      local_base_url TEXT,
      local_model TEXT,
      local_api_key_ciphertext BLOB,
      local_api_key_nonce BLOB,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_client_settings (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      google_client_id TEXT,
      microsoft_client_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mail_accounts (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      email_address TEXT NOT NULL,
      display_name TEXT,
      provider_account_id TEXT,
      token_ciphertext BLOB NOT NULL,
      token_nonce BLOB NOT NULL,
      scopes_json TEXT NOT NULL,
      sync_cursor_json TEXT,
      last_synced_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS mail_accounts_profile_provider_email
      ON mail_accounts(profile_id, provider, email_address);

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      provider_folder_id TEXT NOT NULL,
      path TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'inbox'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS folders_account_provider
      ON folders(account_id, provider_folder_id);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      folder_id TEXT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
      provider_message_id TEXT NOT NULL,
      provider_thread_id TEXT,
      message_id_header TEXT,
      subject TEXT NOT NULL DEFAULT '',
      from_json TEXT NOT NULL DEFAULT '[]',
      to_json TEXT NOT NULL DEFAULT '[]',
      cc_json TEXT NOT NULL DEFAULT '[]',
      received_at TEXT NOT NULL,
      flags_json TEXT NOT NULL DEFAULT '{}',
      snippet TEXT NOT NULL DEFAULT '',
      body_text TEXT,
      body_html TEXT,
      raw_size INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS messages_account_provider_msg
      ON messages(account_id, provider_message_id);

    CREATE TABLE IF NOT EXISTS sync_jobs (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      error TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_artifacts (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      tone TEXT,
      content TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ai_artifacts_msg_kind_tone
      ON ai_artifacts(message_id, kind, tone);
  `);
}
