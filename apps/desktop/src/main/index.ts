import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createDb } from "@pidgeon/db";
import {
  AuthRegisterInput,
  AuthUnlockInput,
  AccountsConnectInput,
  IdInput,
  InboxListInput,
  MessageIdInput,
  AiSummarizeInput,
  AiSuggestReplyInput,
  AiSaveSettingsInput,
  OAuthClientsInput,
  SendReplyInput,
  ipcError,
} from "@pidgeon/shared";
import {
  createVaultState,
  registerProfile,
  unlockProfile,
  lockVault,
  getMe,
  listAccounts,
  connectAccount,
  removeAccount,
  syncAccount,
  listInbox,
  getMessage,
  sendReply,
  getOAuthClients,
  saveOAuthClients,
  getAiSettings,
  saveAiSettings,
  summarizeMessage,
  suggestReply,
} from "@pidgeon/services";

const isDev = !app.isPackaged;
const vault = createVaultState();

function userDataDbPath() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "pidgeon.sqlite");
}

const db = createDb(userDataDbPath());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: "Pidgeon",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    void win.loadURL("http://127.0.0.1:5173");
  } else {
    void win.loadFile(path.join(__dirname, "../../web-dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  lockVault(vault);
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  lockVault(vault);
});

ipcMain.handle("auth.register", async (_e, raw) => {
  const parsed = AuthRegisterInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return registerProfile(db, vault, parsed.data);
});

ipcMain.handle("auth.unlock", async (_e, raw) => {
  const parsed = AuthUnlockInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return unlockProfile(db, vault, parsed.data);
});

ipcMain.handle("auth.lock", async () => {
  lockVault(vault);
});

ipcMain.handle("auth.me", async () => getMe(db, vault));

ipcMain.handle("accounts.list", async () => listAccounts(db, vault));

ipcMain.handle("accounts.connect", async (_e, raw) => {
  const parsed = AccountsConnectInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return connectAccount(db, vault, parsed.data.provider, async (url) => {
    await shell.openExternal(url);
  });
});

ipcMain.handle("accounts.remove", async (_e, raw) => {
  const parsed = IdInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return removeAccount(db, vault, parsed.data.id);
});

ipcMain.handle("accounts.sync", async (_e, raw) => {
  const parsed = IdInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return syncAccount(db, vault, parsed.data.id);
});

ipcMain.handle("inbox.list", async (_e, raw) => {
  const parsed = InboxListInput.safeParse(raw ?? {});
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return listInbox(db, vault, parsed.data.limit, parsed.data.cursor);
});

ipcMain.handle("messages.get", async (_e, raw) => {
  const parsed = MessageIdInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return getMessage(db, vault, parsed.data.id);
});

ipcMain.handle("messages.sendReply", async (_e, raw) => {
  const parsed = SendReplyInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return sendReply(db, vault, parsed.data);
});

ipcMain.handle("ai.summarize", async (_e, raw) => {
  const parsed = AiSummarizeInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return summarizeMessage(db, vault, parsed.data.messageId, parsed.data.force);
});

ipcMain.handle("ai.suggestReply", async (_e, raw) => {
  const parsed = AiSuggestReplyInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return suggestReply(db, vault, parsed.data.messageId, parsed.data.tone);
});

ipcMain.handle("ai.getSettings", async () => getAiSettings(db, vault));

ipcMain.handle("ai.saveSettings", async (_e, raw) => {
  const parsed = AiSaveSettingsInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return saveAiSettings(db, vault, parsed.data);
});

ipcMain.handle("settings.getOAuthClients", async () => getOAuthClients(db, vault));

ipcMain.handle("settings.saveOAuthClients", async (_e, raw) => {
  const parsed = OAuthClientsInput.safeParse(raw);
  if (!parsed.success) return ipcError("invalid_request", parsed.error.message);
  return saveOAuthClients(db, vault, parsed.data);
});

ipcMain.handle("app.health", async () => ({
  status: "ok" as const,
  db: true,
  unlocked: vault.unlocked,
}));
