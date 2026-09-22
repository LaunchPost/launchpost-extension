import { installApiBridge } from "./api";

installApiBridge();

const API = "https://launchpost.fun";
const STATUS = /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i;

// ------------------------------------------------------------------ context menu + welcome

function installMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "launchpost-launch",
      title: "Launch this post",
      contexts: ["link"],
      targetUrlPatterns: ["https://x.com/*/status/*", "https://twitter.com/*/status/*", "https://www.x.com/*/status/*", "https://www.twitter.com/*/status/*"],
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  installMenu();
  if (details.reason === "install") chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
});

chrome.runtime.onStartup.addListener(installMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "launchpost-launch" || !info.linkUrl || !STATUS.test(info.linkUrl)) return;
  const onX = !!tab?.url && /https?:\/\/(?:www\.)?(?:x|twitter)\.com\//.test(tab.url);
  if (onX && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "launch-url", url: info.linkUrl }, () => {
      if (chrome.runtime.lastError) {
        chrome.tabs.create({ url: `https://launchpost.fun/compose?url=${encodeURIComponent(info.linkUrl!)}` });
      }
    });
    return;
  }
  chrome.tabs.create({ url: `https://launchpost.fun/compose?url=${encodeURIComponent(info.linkUrl)}` });
});

// ------------------------------------------------------------------ Privy session (handed over by /connect)

interface Auth {
  token: string;
  /** ms epoch the JWT expires (decoded from its `exp` claim). */
  exp: number;
}
const AUTH_KEY = "lp:auth";

/** Read the `exp` claim (ms) from a Privy JWT; fall back to ~55 min if it can't be parsed. */
function decodeExp(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return Date.now() + 55 * 60_000;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof json.exp === "number" ? json.exp * 1000 : Date.now() + 55 * 60_000;
  } catch {
    return Date.now() + 55 * 60_000;
  }
}

async function getAuth(): Promise<Auth | null> {
  const v = await chrome.storage.local.get(AUTH_KEY);
  const a = v[AUTH_KEY] as Auth | undefined;
  // 5 s guard so a token about to expire mid-request doesn't 401.
  if (!a?.token || a.exp <= Date.now() + 5_000) return null;
  return a;
}

async function setAuth(token: string): Promise<void> {
  await chrome.storage.local.set({ [AUTH_KEY]: { token, exp: decodeExp(token) } satisfies Auth });
}

async function clearAuth(): Promise<void> {
  await chrome.storage.local.remove(AUTH_KEY);
}

/** Nudge open X tabs to re-check the session (after a sign-in or sign-out on launchpost.fun). */
async function broadcastAuth(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] }).catch(() => [] as chrome.tabs.Tab[]);
  for (const t of tabs) if (t.id != null) chrome.tabs.sendMessage(t.id, { type: "lp-auth" }).catch(() => {});
}

/** Open (or focus) the launchpost sign-in tab so the user can connect the extension. */
async function openConnectTab(): Promise<void> {
  const found = await chrome.tabs.query({ url: ["https://launchpost.fun/connect*", "https://www.launchpost.fun/connect*"] }).catch(() => [] as chrome.tabs.Tab[]);
  const existing = found[0];
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true }).catch(() => {});
    if (existing.windowId != null) chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
    return;
  }
  await chrome.tabs.create({ url: `${API}/connect` }).catch(() => {});
}

type Msg = { type?: string; token?: string; body?: Record<string, unknown> };

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  switch (msg?.type) {
    case "lp-token":
      // From the launchpost.fun bridge: a fresh access token to store and reuse until it expires.
      if (typeof msg.token === "string") void setAuth(msg.token).then(broadcastAuth);
      return; // no response

    case "lp-signout":
      void clearAuth().then(broadcastAuth);
      return; // no response

    case "lp-session":
      void (async () => {
        const auth = await getAuth();
        if (!auth) return sendResponse({ ok: true, body: { authenticated: false } });
        try {
          const r = await fetch(`${API}/api/compose/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: auth.token }) });
          const body = (await r.json().catch(() => ({}))) as { authenticated?: boolean };
          sendResponse({ ok: true, body: body?.authenticated ? body : { authenticated: false } });
        } catch {
          sendResponse({ ok: true, body: { authenticated: false } });
        }
      })();
      return true; // async response

    case "lp-deploy":
      void (async () => {
        const auth = await getAuth();
        if (!auth) return sendResponse({ ok: true, body: { needsAuth: true } });
        try {
          const r = await fetch(`${API}/api/compose/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: auth.token, ...(msg.body ?? {}) }) });
          const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
          if (r.status === 401) {
            await clearAuth();
            await broadcastAuth();
            return sendResponse({ ok: true, body: { needsAuth: true, error: body.error } });
          }
          // Engine 4xx (holder gate, bad ticker) come back as {error,…}; the sheet reads them off the body.
          sendResponse({ ok: true, body });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "network" });
        }
      })();
      return true; // async response

    case "lp-logo":
      void (async () => {
        const auth = await getAuth();
        if (!auth) return sendResponse({ ok: true, body: { needsAuth: true } });
        try {
          const r = await fetch(`${API}/api/compose/logo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: auth.token, ...(msg.body ?? {}) }) });
          const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
          if (r.status === 401) {
            await clearAuth();
            await broadcastAuth();
            return sendResponse({ ok: true, body: { needsAuth: true, error: body.error } });
          }
          // Engine 4xx (holder gate, bad image, generation failure) come back as {error,…}; the sheet reads them off the body.
          sendResponse({ ok: true, body });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "network" });
        }
      })();
      return true; // async response

    case "lp-tip":
      void (async () => {
        const auth = await getAuth();
        if (!auth) return sendResponse({ ok: true, body: { ok: false, needsAuth: true, reason: "sign in with X first" } });
        try {
          const r = await fetch(`${API}/api/compose/tip`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: auth.token, ...(msg.body ?? {}) }) });
          const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
          if (r.status === 401) {
            await clearAuth();
            await broadcastAuth();
            return sendResponse({ ok: true, body: { ok: false, needsAuth: true, reason: body.reason ?? "sign in with X first" } });
          }
          // Engine 4xx come back as {ok:false, reason}; the tip pane shows the reason verbatim.
          sendResponse({ ok: true, body });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "network" });
        }
      })();
      return true; // async response

    case "lp-connect":
      void openConnectTab();
      sendResponse({ ok: true, body: { opened: true } });
      return true;
  }
  return; // not ours — let other listeners (the API bridge) handle it
});
