import { contextBridge, ipcRenderer } from "electron";

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("pidgeon", {
  auth: {
    register: (input: unknown) => invoke("auth.register", input),
    unlock: (input: unknown) => invoke("auth.unlock", input),
    lock: () => invoke("auth.lock"),
    me: () => invoke("auth.me"),
  },
  accounts: {
    list: () => invoke("accounts.list"),
    connect: (input: unknown) => invoke("accounts.connect", input),
    remove: (input: unknown) => invoke("accounts.remove", input),
    sync: (input: unknown) => invoke("accounts.sync", input),
  },
  inbox: {
    list: (input?: unknown) => invoke("inbox.list", input),
  },
  messages: {
    get: (input: unknown) => invoke("messages.get", input),
    sendReply: (input: unknown) => invoke("messages.sendReply", input),
  },
  ai: {
    summarize: (input: unknown) => invoke("ai.summarize", input),
    suggestReply: (input: unknown) => invoke("ai.suggestReply", input),
    getSettings: () => invoke("ai.getSettings"),
    saveSettings: (input: unknown) => invoke("ai.saveSettings", input),
  },
  settings: {
    getOAuthClients: () => invoke("settings.getOAuthClients"),
    saveOAuthClients: (input: unknown) => invoke("settings.saveOAuthClients", input),
  },
  app: {
    health: () => invoke("app.health"),
  },
});
