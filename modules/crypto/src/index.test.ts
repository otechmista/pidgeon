import { describe, expect, it } from "bun:test";
import {
  generateDek,
  generateSalt,
  deriveKek,
  wrapDek,
  unwrapDek,
  hashPassword,
  verifyPassword,
  encryptUtf8,
  decryptUtf8,
} from "./index.ts";

describe("crypto vault", () => {
  it("hashes and verifies password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword(hash, "correct-horse-battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("wraps and unwraps DEK", async () => {
    const salt = generateSalt();
    const kek = await deriveKek("secret-password", salt);
    const dek = generateDek();
    const wrapped = wrapDek(kek, dek);
    const unwrapped = unwrapDek(kek, wrapped);
    expect(unwrapped.equals(dek)).toBe(true);
  });

  it("encrypts utf8 with DEK", () => {
    const dek = generateDek();
    const wrapped = encryptUtf8(dek, "refresh-token-value");
    expect(decryptUtf8(dek, wrapped)).toBe("refresh-token-value");
  });
});
