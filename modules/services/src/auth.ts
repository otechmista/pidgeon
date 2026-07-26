import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDb } from "@pidgeon/db";
import { profiles, aiSettings, oauthClientSettings } from "@pidgeon/db";
import {
  hashPassword,
  verifyPassword,
  generateDek,
  generateSalt,
  deriveKek,
  wrapDek,
  unwrapDek,
} from "@pidgeon/crypto";
import type { ProfileDto } from "@pidgeon/shared";
import { ipcError } from "@pidgeon/shared";

export type VaultState = {
  unlocked: boolean;
  profileId: string | null;
  dek: Buffer | null;
};

export function createVaultState(): VaultState {
  return { unlocked: false, profileId: null, dek: null };
}

function toProfileDto(row: typeof profiles.$inferSelect): ProfileDto {
  return {
    id: row.id,
    displayName: row.displayName,
    createdAt: row.createdAt,
  };
}

export async function registerProfile(
  db: AppDb,
  state: VaultState,
  input: { displayName?: string; password: string }
) {
  const existing = db.select().from(profiles).all();
  if (existing.length > 0) {
    return ipcError("profile_exists", "A local profile already exists. Unlock instead.");
  }

  const now = new Date().toISOString();
  const salt = generateSalt();
  const passwordHash = await hashPassword(input.password);
  const kek = await deriveKek(input.password, salt);
  const dek = generateDek();
  const wrapped = wrapDek(kek, dek);
  const id = randomUUID();

  db.insert(profiles)
    .values({
      id,
      displayName: input.displayName ?? "Pidgeon",
      passwordHash,
      kdfSalt: salt,
      kdfParamsJson: JSON.stringify({ memoryCost: 19456, timeCost: 2, algo: "argon2id" }),
      wrappedDek: wrapped.ciphertext,
      wrappedDekNonce: wrapped.nonce,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  db.insert(aiSettings)
    .values({
      id: randomUUID(),
      profileId: id,
      preferred: "cloud",
      fallbackEnabled: true,
      localBaseUrl: "http://127.0.0.1:11434/v1",
      localModel: "llama3.2",
      updatedAt: now,
    })
    .run();

  db.insert(oauthClientSettings)
    .values({
      id: randomUUID(),
      profileId: id,
      updatedAt: now,
    })
    .run();

  state.unlocked = true;
  state.profileId = id;
  state.dek = dek;

  return { profile: toProfileDto(db.select().from(profiles).where(eq(profiles.id, id)).get()!) };
}

export async function unlockProfile(
  db: AppDb,
  state: VaultState,
  input: { password: string }
) {
  const row = db.select().from(profiles).get();
  if (!row) {
    return ipcError("no_profile", "No profile found. Register first.");
  }
  const ok = await verifyPassword(row.passwordHash, input.password);
  if (!ok) {
    return ipcError("invalid_credentials", "Invalid password.");
  }
  try {
    const kek = await deriveKek(input.password, row.kdfSalt as Buffer);
    const dek = unwrapDek(kek, {
      ciphertext: row.wrappedDek as Buffer,
      nonce: row.wrappedDekNonce as Buffer,
    });
    state.unlocked = true;
    state.profileId = row.id;
    state.dek = dek;
    return { profile: toProfileDto(row) };
  } catch {
    return ipcError("invalid_credentials", "Could not unlock vault.");
  }
}

export function lockVault(state: VaultState) {
  if (state.dek) state.dek.fill(0);
  state.dek = null;
  state.unlocked = false;
  state.profileId = null;
}

export function requireUnlock(state: VaultState) {
  if (!state.unlocked || !state.dek || !state.profileId) {
    return ipcError("app_locked", "Unlock the vault first.");
  }
  return null;
}

export function getMe(db: AppDb, state: VaultState) {
  const row = db.select().from(profiles).get();
  return {
    profile: row ? toProfileDto(row) : null,
    unlocked: state.unlocked,
  };
}
