const API = "https://launchpost.fun";

export interface PreviewPost {
  postId: string;
  url: string;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  text: string;
  image: string | null;
}

function api<T>(path: string): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return Promise.reject(new Error("no extension"));
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "api", path }, (res: { ok: boolean; body?: T; error?: string }) => {
      if (chrome.runtime.lastError || !res?.ok) reject(new Error(res?.error ?? chrome.runtime.lastError?.message ?? "request failed"));
      else resolve(res.body as T);
    });
  });
}

export const fetchPreview = (url: string) => api<PreviewPost>(`/api/compose/preview?url=${encodeURIComponent(url)}`);

/** The signed-in launchpost session, as the background knows it. `holder` gates Deploy; `devBuyReady` gates Lock/Burn. */
export interface Session {
  authenticated: boolean;
  handle?: string;
  platform?: string;
  /** Platform user id — the key for /api/tips/:platform/:userId reads. */
  userId?: string;
  holder?: boolean;
  minTokens?: number;
  /** Identity has a bound wallet at /claim. */
  claimed?: boolean;
  /** Bound wallet has a funded per-launch jar (LaunchDeposit). */
  devBuyReady?: boolean;
}

export interface DeployBody {
  url: string;
  ticker: string;
  name?: string;
  description?: string;
  pair?: string;
  website?: string;
  logo?: string;
  /** Hide the creator on every public shape (holder perk). Off = they show as creator. */
  anon?: boolean;
}

export interface DeployResult {
  kind?: string;
  reason?: string | null;
  post?: { id: number; status: string; token: string | null; symbol: string | null } | null;
  /** The stored session was missing/expired — the sheet re-opens /connect. */
  needsAuth?: boolean;
  /** Signed in but not a holder — Deploy stays locked, Reply on X is the path. */
  needsHolder?: boolean;
  error?: string;
}

/** Result of hosting a Deploy logo (upload or AI generate). `url` is on our media CDN, ready to pass to Deploy. */
export interface LogoResult {
  url?: string;
  error?: string;
  /** Stored session missing/expired — the sheet re-opens /connect. */
  needsAuth?: boolean;
  /** Signed in but not a holder — upload is a Deploy (holder) perk; generate is open to anyone signed in. */
  needsHolder?: boolean;
}

/** Ask the engine to host a logo for Deploy: `{ generate:true, name, ticker }` (AI) or `{ image }` (base64/data URL). */
export interface LogoBody {
  generate?: boolean;
  image?: string;
  subject?: string;
  name?: string;
  ticker?: string;
  style?: string;
}

/** Quiet tip from the sheet: the engine moves TipVault balance, no post, no bot reply. */
export interface TipBody {
  toHandle: string;
  amount: number;
  /** Default LAUNCHPOST. Any launchpost coin symbol works; `tokenAddress` pins a specific one. */
  symbol?: string;
  tokenAddress?: string;
  /** Bot posts a mention so the recipient knows to claim (default true). */
  notify?: boolean;
}

export type TipResult =
  | { ok: true; amount: number; symbol: string; token: string; toUserId: string; toHandle: string; tx: string; allowanceUsed: number; allowanceLeft: number | null; /** Bot's mention post id, null when not posted. */ notified?: string | null }
  | { ok: false; reason: string; needsAuth?: boolean };

export interface TipBalanceEntry {
  token: string;
  symbol: string;
  name: string;
  logo: string | null;
  decimals: number;
  balance: number;
}

export interface TipBalances {
  /** $LAUNCHPOST balance in whole tokens. */
  balance: number;
  balances: TipBalanceEntry[];
}

export interface TipAllowance {
  holder: boolean;
  perDay: number;
  usedToday: number;
  left: number;
}

export interface LaunchStatus {
  id: number;
  status: string;
  token: string | null;
  symbol: string | null;
  reason: string | null;
}

/** Send a typed message to the background and resolve its `body` (rejects only on transport failure). */
function send<T>(msg: Record<string, unknown>): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return Promise.reject(new Error("no extension"));
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res: { ok: boolean; body?: T; error?: string }) => {
      if (chrome.runtime.lastError || !res?.ok) reject(new Error(res?.error ?? chrome.runtime.lastError?.message ?? "request failed"));
      else resolve(res.body as T);
    });
  });
}

/** Who the browser is signed in as (via the background's stored Privy token). Never throws — worst case signed-out. */
export const getSession = () => send<Session>({ type: "lp-session" }).catch(() => ({ authenticated: false }) as Session);
/** Launch off this post without replying. The background attaches the stored token. */
export const deploy = (body: DeployBody) => send<DeployResult>({ type: "lp-deploy", body });
/** Host a Deploy logo (AI generate or uploaded file). The background attaches the stored token. */
export const makeLogo = (body: LogoBody) => send<LogoResult>({ type: "lp-logo", body });
/** Open (or focus) the launchpost sign-in tab so the user can connect the extension. */
export const openConnect = () => send<{ opened?: boolean }>({ type: "lp-connect" }).catch(() => ({}));
/** Poll a launch row until it goes live (reuses the GET proxy). */
export const pollLaunch = (id: number) => api<LaunchStatus>(`/api/launches/${id}`);
/** Send a tip from the signed-in account's TipVault balance. The background attaches the stored token. */
export const sendTip = (body: TipBody) => send<TipResult>({ type: "lp-tip", body });
/** What the signed-in X account holds in the TipVault. `fast` = $LAUNCHPOST only, one chain read (paint first). */
export const tipBalances = (userId: string, fast = false) => api<TipBalances>(`/api/tips/x/${encodeURIComponent(userId)}${fast ? "?fast=1" : ""}`);
/** Holder daily allowance state for the signed-in X account. */
export const tipAllowance = (userId: string) => api<TipAllowance>(`/api/tips/allowance/x/${encodeURIComponent(userId)}`);

/** The bits of /api/stats the tip pane / Reply path use. */
export interface StatsLite {
  ethUsd: number | null;
  flywheel?: { token: string | null };
  /** When true, Reply on X posts+launches via the bot API (instant; for X_ALLOW_SELF_POSTS demos). */
  allowSelfPosts?: boolean;
}
export const stats = () => api<StatsLite>("/api/stats");

export type SelfLaunchResult = {
  kind: string;
  reason?: string | null;
  replyId?: string;
  replyUrl?: string;
  post?: { id: number; status: string; token: string | null; symbol: string | null } | null;
  mode?: "reply" | "post";
  error?: string;
};

/** Demo path: bot posts the reply and launches in one shot (only while allowSelfPosts is on). */
export const selfLaunch = (url: string, text: string) =>
  send<SelfLaunchResult>({ type: "lp-self-launch", url, text });

/** A launchpost coin's curve price (in its pair) — enough to show ≈$ for a tip amount. 404 for non-launchpost tokens. */
export interface CoinLite {
  coin?: { token: string; symbol: string; priceEth: number; pair?: { symbol: string } } | null;
}
export const coin = (token: string) => api<CoinLite>(`/api/coins/${encodeURIComponent(token)}`);

/** Background fetch — content scripts stay inside x.com host permissions; the API answers CORS *. */
export function installApiBridge(): void {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "lp-self-launch" && typeof msg.url === "string" && typeof msg.text === "string") {
      fetch(`${API}/api/x/self-launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: msg.url, text: msg.text }),
      })
        .then(async (r) => {
          const body = (await r.json().catch(() => ({}))) as SelfLaunchResult & { error?: string };
          if (!r.ok) sendResponse({ ok: false, error: body.error ?? `${r.status}` });
          else sendResponse({ ok: true, body });
        })
        .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : "network" }));
      return true;
    }
    if (msg?.type !== "api" || typeof msg.path !== "string" || !msg.path.startsWith("/api/")) return;
    fetch(`${API}${msg.path}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) sendResponse({ ok: false, error: (body as { error?: string }).error ?? `${r.status}` });
        else sendResponse({ ok: true, body });
      })
      .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : "network" }));
    return true;
  });
}
