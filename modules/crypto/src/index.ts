import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify, Algorithm } from "@node-rs/argon2";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  algorithm: Algorithm.Argon2id,
};

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, ARGON2_OPTS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2Verify(hash, password);
  } catch {
    return false;
  }
}

export function generateDek(): Buffer {
  return randomBytes(32);
}

export function generateSalt(): Buffer {
  return randomBytes(16);
}

/** Derive a 32-byte KEK from password + salt using Argon2id raw hash. */
export async function deriveKek(password: string, salt: Buffer): Promise<Buffer> {
  const { hashRaw } = await import("@node-rs/argon2");
  return Buffer.from(
    await hashRaw(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      algorithm: Algorithm.Argon2id,
      salt,
      outputLen: 32,
    })
  );
}

export type WrappedKey = {
  ciphertext: Buffer;
  nonce: Buffer;
};

export function aesGcmEncrypt(key: Buffer, plaintext: Buffer): WrappedKey {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([enc, tag]), nonce };
}

export function aesGcmDecrypt(key: Buffer, ciphertext: Buffer, nonce: Buffer): Buffer {
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function wrapDek(kek: Buffer, dek: Buffer): WrappedKey {
  return aesGcmEncrypt(kek, dek);
}

export function unwrapDek(kek: Buffer, wrapped: WrappedKey): Buffer {
  return aesGcmDecrypt(kek, wrapped.ciphertext, wrapped.nonce);
}

export function encryptUtf8(dek: Buffer, text: string): WrappedKey {
  return aesGcmEncrypt(dek, Buffer.from(text, "utf8"));
}

export function decryptUtf8(dek: Buffer, wrapped: WrappedKey): string {
  return aesGcmDecrypt(dek, wrapped.ciphertext, wrapped.nonce).toString("utf8");
}
