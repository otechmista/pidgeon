import { describe, expect, it } from "bun:test";
import { createDb } from "@pidgeon/db";
import { createVaultState, registerProfile, unlockProfile, lockVault } from "./auth.ts";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("vault auth", () => {
  it("registers, unlocks, locks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pidgeon-"));
    const db = createDb(join(dir, "test.db"));
    const state = createVaultState();
    const reg = await registerProfile(db, state, {
      password: "password123",
      displayName: "Test",
    });
    expect("profile" in reg).toBe(true);
    expect(state.unlocked).toBe(true);
    lockVault(state);
    expect(state.unlocked).toBe(false);
    const bad = await unlockProfile(db, state, { password: "wrong-password" });
    expect("error" in bad).toBe(true);
    const ok = await unlockProfile(db, state, { password: "password123" });
    expect("profile" in ok).toBe(true);
  });
});
