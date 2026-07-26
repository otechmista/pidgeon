<script lang="ts">
  import { onMount } from "svelte";
  import {
    Inbox,
    Settings,
    Lock,
    Unlock,
    Plus,
    RefreshCw,
    Send,
    Sparkles,
    Reply,
    Mail,
    Bot,
  } from "lucide-svelte";
  import Button from "./lib/components/Button.svelte";
  import { api, isErr } from "./lib/utils";
  import type {
    AccountDto,
    AiSettingsDto,
    InboxItemDto,
    MessageDto,
    ProfileDto,
  } from "@pidgeon/shared";

  type View = "inbox" | "settings";

  let unlocked = $state(false);
  let profile = $state<ProfileDto | null>(null);
  let hasProfile = $state(false);
  let password = $state("");
  let displayName = $state("Pidgeon");
  let error = $state("");
  let loading = $state(false);
  let view = $state<View>("inbox");

  let accounts = $state<AccountDto[]>([]);
  let inbox = $state<InboxItemDto[]>([]);
  let selectedId = $state<string | null>(null);
  let message = $state<MessageDto | null>(null);
  let replyBody = $state("");
  let aiSummary = $state("");
  let aiLog = $state<string[]>([]);
  let tone = $state<"formal" | "concise" | "friendly">("concise");

  let googleClientId = $state("");
  let microsoftClientId = $state("");
  let aiSettings = $state<AiSettingsDto | null>(null);
  let cloudBaseUrl = $state("");
  let cloudModel = $state("gpt-4o-mini");
  let cloudApiKey = $state("");
  let localBaseUrl = $state("http://127.0.0.1:11434/v1");
  let localModel = $state("llama3.2");
  let localApiKey = $state("");
  let preferred = $state<"cloud" | "local">("cloud");
  let fallbackEnabled = $state(true);

  onMount(async () => {
    try {
      const me = await api().auth.me();
      hasProfile = !!me.profile;
      profile = me.profile;
      unlocked = me.unlocked;
      if (me.unlocked) await refreshAll();
    } catch {
      error = "IPC bridge not available. Run inside Electron.";
    }
  });

  async function refreshAll() {
    const [acc, box, oauth, ai] = await Promise.all([
      api().accounts.list(),
      api().inbox.list({ limit: 100 }),
      api().settings.getOAuthClients(),
      api().ai.getSettings(),
    ]);
    if (!isErr(acc)) accounts = acc.items;
    if (!isErr(box)) inbox = box.items;
    googleClientId = oauth.googleClientId ?? "";
    microsoftClientId = oauth.microsoftClientId ?? "";
    if (!isErr(ai)) {
      aiSettings = ai;
      preferred = ai.preferred;
      fallbackEnabled = ai.fallbackEnabled;
      cloudBaseUrl = ai.cloudBaseUrl ?? "";
      cloudModel = ai.cloudModel ?? "gpt-4o-mini";
      localBaseUrl = ai.localBaseUrl ?? "http://127.0.0.1:11434/v1";
      localModel = ai.localModel ?? "llama3.2";
    }
  }

  async function register() {
    loading = true;
    error = "";
    const res = await api().auth.register({ password, displayName });
    loading = false;
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    profile = res.profile;
    unlocked = true;
    hasProfile = true;
    password = "";
    await refreshAll();
  }

  async function unlock() {
    loading = true;
    error = "";
    const res = await api().auth.unlock({ password });
    loading = false;
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    profile = res.profile;
    unlocked = true;
    password = "";
    await refreshAll();
  }

  async function lock() {
    await api().auth.lock();
    unlocked = false;
    inbox = [];
    message = null;
    selectedId = null;
  }

  async function selectMessage(id: string) {
    selectedId = id;
    aiSummary = "";
    replyBody = "";
    const res = await api().messages.get({ id });
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    message = res.message;
  }

  async function connect(provider: "google" | "microsoft") {
    loading = true;
    error = "";
    const res = await api().accounts.connect({ provider });
    loading = false;
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    await refreshAll();
    const sync = await api().accounts.sync({ id: res.account.id });
    if (isErr(sync)) error = sync.error.message;
    await refreshAll();
  }

  async function syncAll() {
    loading = true;
    for (const a of accounts) {
      const res = await api().accounts.sync({ id: a.id });
      if (isErr(res)) error = res.error.message;
    }
    await refreshAll();
    loading = false;
  }

  async function summarize() {
    if (!selectedId) return;
    const res = await api().ai.summarize({ messageId: selectedId });
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    aiSummary = res.summary;
    aiLog = [...aiLog, `Summary (${res.provider}${res.cached ? ", cached" : ""})`];
  }

  async function suggest() {
    if (!selectedId) return;
    const res = await api().ai.suggestReply({ messageId: selectedId, tone });
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    replyBody = res.drafts[0] ?? "";
    aiLog = [...aiLog, `Reply draft (${res.provider}, ${tone})`];
  }

  async function sendReply() {
    if (!selectedId || !replyBody.trim()) return;
    loading = true;
    const res = await api().messages.sendReply({ messageId: selectedId, body: replyBody });
    loading = false;
    if (isErr(res)) {
      error = res.error.message;
      return;
    }
    aiLog = [...aiLog, `Sent (${res.providerMessageId})`];
    replyBody = "";
  }

  async function saveSettings() {
    loading = true;
    error = "";
    const oauth = await api().settings.saveOAuthClients({
      googleClientId,
      microsoftClientId,
    });
    if (isErr(oauth)) {
      error = oauth.error.message;
      loading = false;
      return;
    }
    const ai = await api().ai.saveSettings({
      preferred,
      fallbackEnabled,
      cloud: {
        baseUrl: cloudBaseUrl,
        model: cloudModel,
        apiKey: cloudApiKey || undefined,
      },
      local: {
        baseUrl: localBaseUrl,
        model: localModel,
        apiKey: localApiKey || undefined,
      },
    });
    loading = false;
    if (isErr(ai)) {
      error = ai.error.message;
      return;
    }
    cloudApiKey = "";
    localApiKey = "";
    await refreshAll();
  }

  function sanitizeHtml(html: string) {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");
  }
</script>

{#if !unlocked}
  <div class="flex h-full items-center justify-center bg-gradient-to-br from-[hsl(40_20%_98%)] via-[hsl(160_20%_96%)] to-[hsl(40_14%_94%)] p-6">
    <div class="w-full max-w-md space-y-6">
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-accent">
          <Mail size={28} />
          <h1 class="text-3xl font-semibold tracking-tight text-foreground">Pidgeon</h1>
        </div>
        <p class="text-sm text-muted-foreground">
          Local-first email with AI. Unlock your vault to continue.
        </p>
      </div>
      <div class="space-y-3 rounded-lg border bg-card p-5 shadow-sm">
        {#if !hasProfile}
          <label class="block space-y-1 text-sm">
            <span class="text-muted-foreground">Display name</span>
            <input class="w-full rounded-md border bg-background px-3 py-2" bind:value={displayName} />
          </label>
        {/if}
        <label class="block space-y-1 text-sm">
          <span class="text-muted-foreground">Vault password</span>
          <input
            type="password"
            class="w-full rounded-md border bg-background px-3 py-2"
            bind:value={password}
            onkeydown={(e) => e.key === "Enter" && (hasProfile ? unlock() : register())}
          />
        </label>
        {#if error}
          <p class="text-sm text-red-700">{error}</p>
        {/if}
        <Button variant="accent" class="w-full" disabled={loading || password.length < 8} onclick={() => (hasProfile ? unlock() : register())}>
          {#if hasProfile}
            <Unlock size={16} /> Unlock
          {:else}
            <Lock size={16} /> Create vault
          {/if}
        </Button>
      </div>
    </div>
  </div>
{:else}
  <div class="flex h-full">
    <aside class="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div class="flex items-center gap-2 px-4 py-4">
        <Mail size={20} class="text-accent" />
        <span class="text-lg font-semibold">Pidgeon</span>
      </div>
      <nav class="flex flex-1 flex-col gap-1 px-2">
        <button
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm {view === 'inbox' ? 'bg-muted font-medium' : 'hover:bg-muted/70'}"
          onclick={() => (view = "inbox")}
        >
          <Inbox size={16} /> Unified Inbox
        </button>
        <button
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm {view === 'settings' ? 'bg-muted font-medium' : 'hover:bg-muted/70'}"
          onclick={() => (view = "settings")}
        >
          <Settings size={16} /> Settings
        </button>
        <div class="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Accounts
        </div>
        {#each accounts as a}
          <div class="truncate px-3 py-1.5 text-xs text-muted-foreground">
            {a.provider}: {a.emailAddress}
          </div>
        {:else}
          <p class="px-3 text-xs text-muted-foreground">No accounts yet</p>
        {/each}
        <div class="mt-2 flex flex-col gap-1 px-2">
          <Button size="sm" variant="outline" onclick={() => connect("google")} disabled={loading}>
            <Plus size={14} /> Google
          </Button>
          <Button size="sm" variant="outline" onclick={() => connect("microsoft")} disabled={loading}>
            <Plus size={14} /> Outlook
          </Button>
        </div>
      </nav>
      <div class="border-t p-2">
        <Button size="sm" variant="ghost" class="w-full justify-start" onclick={lock}>
          <Lock size={14} /> Lock
        </Button>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col">
      {#if view === "settings"}
        <div class="mx-auto w-full max-w-2xl space-y-6 overflow-auto p-8">
          <h2 class="text-xl font-semibold">Settings</h2>
          <section class="space-y-3">
            <h3 class="text-sm font-medium">OAuth client IDs (BYO)</h3>
            <p class="text-xs text-muted-foreground">
              Register desktop apps in Google Cloud and Azure, then paste public client IDs. See docs/oauth-setup.md.
            </p>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">Google client ID</span>
              <input class="w-full rounded-md border bg-card px-3 py-2" bind:value={googleClientId} />
            </label>
            <label class="block space-y-1 text-sm">
              <span class="text-muted-foreground">Microsoft client ID</span>
              <input class="w-full rounded-md border bg-card px-3 py-2" bind:value={microsoftClientId} />
            </label>
          </section>
          <section class="space-y-3">
            <h3 class="text-sm font-medium">AI providers</h3>
            <label class="flex items-center gap-2 text-sm">
              Preferred
              <select class="rounded-md border bg-card px-2 py-1" bind:value={preferred}>
                <option value="cloud">Cloud</option>
                <option value="local">Local</option>
              </select>
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input type="checkbox" bind:checked={fallbackEnabled} />
              Fallback to the other provider on failure
            </label>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="space-y-2 rounded-md border bg-card p-3">
                <div class="flex items-center gap-2 text-sm font-medium"><Bot size={14} /> Cloud</div>
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Base URL" bind:value={cloudBaseUrl} />
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Model" bind:value={cloudModel} />
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" type="password" placeholder={aiSettings?.cloudApiKeySet ? "API key set — enter to replace" : "API key"} bind:value={cloudApiKey} />
              </div>
              <div class="space-y-2 rounded-md border bg-card p-3">
                <div class="flex items-center gap-2 text-sm font-medium"><Sparkles size={14} /> Local</div>
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Base URL" bind:value={localBaseUrl} />
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" placeholder="Model" bind:value={localModel} />
                <input class="w-full rounded-md border px-2 py-1.5 text-sm" type="password" placeholder={aiSettings?.localApiKeySet ? "API key set — enter to replace" : "API key (optional)"} bind:value={localApiKey} />
              </div>
            </div>
          </section>
          {#if error}
            <p class="text-sm text-red-700">{error}</p>
          {/if}
          <Button variant="accent" disabled={loading} onclick={saveSettings}>Save settings</Button>
        </div>
      {:else}
        <div class="flex h-full min-h-0">
          <section class="flex w-80 shrink-0 flex-col border-r">
            <div class="flex items-center justify-between border-b px-3 py-2">
              <span class="text-sm font-medium">Inbox</span>
              <Button size="sm" variant="ghost" onclick={syncAll} disabled={loading}>
                <RefreshCw size={14} />
              </Button>
            </div>
            <div class="flex-1 overflow-auto">
              {#each inbox as item}
                <button
                  class="block w-full border-b px-3 py-3 text-left hover:bg-muted/60 {selectedId === item.id ? 'bg-muted' : ''}"
                  onclick={() => selectMessage(item.id)}
                >
                  <div class="truncate text-sm font-medium">{item.subject || "(no subject)"}</div>
                  <div class="truncate text-xs text-muted-foreground">{item.from}</div>
                  <div class="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.snippet}</div>
                </button>
              {:else}
                <p class="p-4 text-sm text-muted-foreground">No messages. Connect an account and sync.</p>
              {/each}
            </div>
          </section>

          <section class="flex min-w-0 flex-1 flex-col">
            {#if message}
              <div class="border-b px-5 py-4">
                <h2 class="text-lg font-semibold">{message.subject}</h2>
                <p class="mt-1 text-sm text-muted-foreground">{message.from} · {new Date(message.receivedAt).toLocaleString()}</p>
              </div>
              <div class="flex-1 overflow-auto px-5 py-4 text-sm leading-relaxed">
                {#if message.bodyHtml}
                  {@html sanitizeHtml(message.bodyHtml)}
                {:else}
                  <pre class="whitespace-pre-wrap font-sans">{message.bodyText || message.snippet}</pre>
                {/if}
              </div>
              <div class="space-y-2 border-t p-4">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Reply size={14} /> Reply
                </div>
                <textarea
                  class="min-h-28 w-full rounded-md border bg-card p-3 text-sm"
                  bind:value={replyBody}
                  placeholder="Write a reply…"
                ></textarea>
                <div class="flex flex-wrap gap-2">
                  <Button size="sm" variant="accent" disabled={loading || !replyBody.trim()} onclick={sendReply}>
                    <Send size={14} /> Send
                  </Button>
                </div>
              </div>
            {:else}
              <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a message
              </div>
            {/if}
          </section>

          <aside class="flex w-80 shrink-0 flex-col border-l bg-card">
            <div class="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
              <Sparkles size={16} class="text-accent" /> AI assist
            </div>
            <div class="flex flex-wrap gap-2 border-b p-3">
              <Button size="sm" variant="outline" disabled={!selectedId || loading} onclick={summarize}>
                Summarize
              </Button>
              <select class="rounded-md border px-2 text-xs" bind:value={tone}>
                <option value="concise">Concise</option>
                <option value="formal">Formal</option>
                <option value="friendly">Friendly</option>
              </select>
              <Button size="sm" variant="outline" disabled={!selectedId || loading} onclick={suggest}>
                Suggest reply
              </Button>
            </div>
            <div class="flex-1 space-y-3 overflow-auto p-4 text-sm">
              {#if aiSummary}
                <div class="rounded-md bg-muted/80 p-3">
                  <div class="mb-1 text-xs font-medium text-muted-foreground">Summary</div>
                  {aiSummary}
                </div>
              {/if}
              {#each aiLog as line}
                <div class="text-xs text-muted-foreground">{line}</div>
              {/each}
              {#if !aiSummary && aiLog.length === 0}
                <p class="text-muted-foreground">Ask for a summary or reply draft. Content is only sent when you click.</p>
              {/if}
              {#if error}
                <p class="text-red-700">{error}</p>
              {/if}
            </div>
          </aside>
        </div>
      {/if}
    </main>
  </div>
{/if}
