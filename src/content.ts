import { closeSheet, openSheet, hiResPfp, type TweetInfo } from "./sheet";
import { TIP_BUTTON_KEY } from "./tip";

const STATUS_RE = /\/status\/(\d+)/;

function statusOf(article: HTMLElement): { id: string; url: string } | null {
  const time = article.querySelector("time");
  const a = time?.closest("a");
  const href = a?.getAttribute("href") ?? "";
  const m = href.match(STATUS_RE);
  if (!m?.[1]) return null;
  return { id: m[1], url: href.startsWith("http") ? href : `https://x.com${href}` };
}

/** Skip avatars, emoji, and card chrome — we only want the post's own photo / video poster. */
function isPostMediaUrl(src: string): boolean {
  if (!src || !/^https?:\/\//i.test(src)) return false;
  if (/profile_images|emoji\/v2|hashflag|ext_tw_video_thumb\.svg/i.test(src)) return false;
  // Video poster frames and photos live on pbs / video.twimg; cards sometimes use other CDNs — allow those too if they're in the media well.
  return true;
}

const VIDEO_THUMB_RE = /amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb/i;

function imgUrl(img: HTMLImageElement | null): string | null {
  if (!img) return null;
  const u = img.currentSrc || img.src;
  return u && isPostMediaUrl(u) && !/profile_images/.test(u) ? u : null;
}

/**
 * Photo first; else the video poster. Both default as the coin logo (Post / Thumb tab);
 * Pfp / Upload / AI / Attach remain available.
 */
function scrapeMedia(article: HTMLElement): { url: string; video: boolean } | null {
  const photoUrl = imgUrl(article.querySelector<HTMLImageElement>('[data-testid="tweetPhoto"] img'));
  if (photoUrl && !VIDEO_THUMB_RE.test(photoUrl)) return { url: photoUrl, video: false };
  if (photoUrl && VIDEO_THUMB_RE.test(photoUrl)) return { url: photoUrl, video: true };

  const playerImg = imgUrl(article.querySelector<HTMLImageElement>('[data-testid="videoPlayer"] img'));
  if (playerImg) return { url: playerImg, video: true };

  const poster = article.querySelector<HTMLVideoElement>("video[poster]")?.getAttribute("poster");
  if (poster && isPostMediaUrl(poster) && !/profile_images/.test(poster)) return { url: poster, video: true };

  return null;
}

function scrape(article: HTMLElement): TweetInfo | null {
  const st = statusOf(article);
  if (!st) return null;
  const nameBlock = article.querySelector('[data-testid="User-Name"]');
  const handleA = nameBlock?.querySelector<HTMLAnchorElement>('a[href^="/"]');
  const handle = (handleA?.getAttribute("href") ?? "").replace(/^\//, "").split("/")[0] ?? "";
  // First anchor in User-Name is the display name ("Seranox $SERA"); a $TAG there is a ticker hint.
  const displayName = handleA?.textContent?.trim() ?? "";
  const text = article.querySelector('[data-testid="tweetText"]')?.textContent?.trim() ?? "";
  const media = scrapeMedia(article);
  // The author's avatar — offered as Pfp when they want it instead of the post media.
  // Timeline imgs are `_normal` (48px); upsample so the sheet preview isn't a blurry upscale.
  const avatar = scrapeAvatar(article);
  const showMore = !!article.querySelector('[data-testid="tweet-text-show-more-link"]');
  return {
    statusId: st.id,
    url: st.url.split("?")[0] ?? st.url,
    handle,
    name: displayName,
    text: showMore && !text.endsWith("…") ? `${text}…` : text,
    image: media?.url ?? null,
    imageIsVideo: media?.video ?? false,
    avatar,
    article,
  };
}

/** Prefer srcset's largest profile_images URL, then bump `_normal` → `_400x400`. */
function scrapeAvatar(article: HTMLElement): string | null {
  const img = article.querySelector<HTMLImageElement>(
    '[data-testid="Tweet-User-Avatar"] img, [data-testid^="UserAvatar-Container"] img',
  );
  if (!img) return null;
  const candidates: string[] = [];
  if (img.srcset) {
    for (const part of img.srcset.split(",")) {
      const u = part.trim().split(/\s+/)[0];
      if (u) candidates.push(u);
    }
  }
  if (img.currentSrc) candidates.push(img.currentSrc);
  if (img.src) candidates.push(img.src);
  const hit = candidates.find((u) => /profile_images/i.test(u));
  return hit ? hiResPfp(hit) : null;
}

/**
 * The green post bubble with a `$`, optically centred: the bubble body (not the tail) sits on the box's centre,
 * and the tail hangs below so the mark reads as one weight in a round button.
 */
const BUBBLE_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
  '<g transform="translate(2 -1.25)">' +
  '<path fill="#00c805" d="M4 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-4 3v-3H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"/>' +
  '<text x="10" y="15.5" font-size="8.5" font-weight="800" font-family="Inter,Arial,sans-serif" fill="#06120a" text-anchor="middle">$</text>' +
  "</g></svg>";

/** Status id the sheet is currently composing for — keeps the Launch icon lit across X re-renders. */
let activeStatusId: string | null = null;

function ensureActiveStyles(): void {
  if (document.getElementById("lp-active-css")) return;
  const s = document.createElement("style");
  s.id = "lp-active-css";
  s.textContent = `
@keyframes lp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0,200,5,.55), 0 0 12px rgba(0,200,5,.35); }
  50% { box-shadow: 0 0 0 10px rgba(0,200,5,0), 0 0 18px rgba(0,200,5,.2); }
}
@keyframes lp-tweet-glow {
  0%, 100% { box-shadow: inset 3px 0 0 #00c805, 0 0 0 1px rgba(0,200,5,.28), 0 0 28px rgba(0,200,5,.12); }
  50% { box-shadow: inset 3px 0 0 #00c805, 0 0 0 1px rgba(0,200,5,.45), 0 0 36px rgba(0,200,5,.22); }
}
[data-lp-launch][data-lp-active] {
  background: rgba(0,200,5,.22) !important;
  transform: scale(1.12);
  animation: lp-pulse 1.5s ease-out infinite;
}
[data-lp-launch][data-lp-active] svg path { fill: #00c805; }
[data-lp-active-tweet] {
  position: relative;
  border-radius: 16px;
  animation: lp-tweet-glow 2.2s ease-in-out infinite;
  transition: box-shadow .25s ease;
}
`;
  document.documentElement.append(s);
}

function applyActiveLaunch(): void {
  ensureActiveStyles();
  for (const b of document.querySelectorAll<HTMLElement>("[data-lp-launch]")) {
    const on = activeStatusId != null && b.getAttribute("data-lp-launch") === activeStatusId;
    const was = b.hasAttribute("data-lp-active");
    if (on === was) continue;
    b.toggleAttribute("data-lp-active", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
    if (!on) b.style.background = "transparent";
    else b.style.background = "";
  }
  const want =
    activeStatusId != null
      ? document.querySelector<HTMLElement>(`[data-lp-launch="${CSS.escape(activeStatusId)}"]`)?.closest<HTMLElement>("article") ?? null
      : null;
  for (const a of document.querySelectorAll<HTMLElement>("[data-lp-active-tweet]")) {
    if (a !== want) a.removeAttribute("data-lp-active-tweet");
  }
  if (want && !want.hasAttribute("data-lp-active-tweet")) want.setAttribute("data-lp-active-tweet", "");
}

function setActiveLaunch(statusId: string | null): void {
  const changed = activeStatusId !== statusId;
  activeStatusId = statusId;
  applyActiveLaunch();
  if (changed && statusId) {
    const article = document.querySelector<HTMLElement>(`[data-lp-launch="${CSS.escape(statusId)}"]`)?.closest("article");
    article?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function launchButton(info: TweetInfo): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("data-lp-launch", info.statusId);
  b.setAttribute("aria-label", "Launch");
  b.setAttribute("aria-pressed", "false");
  b.title = "Launch a coin from this post";
  b.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:34px",
    "height:34px",
    "margin:0",
    "padding:0",
    "border:0",
    "border-radius:999px",
    "background:transparent",
    "color:#00c805",
    "cursor:pointer",
    "flex:0 0 auto",
    "transition:transform .15s ease,background .15s ease",
  ].join(";");
  b.innerHTML = BUBBLE_SVG;
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const fresh = info.article ? scrape(info.article) ?? info : info;
    openSheet(fresh);
  });
  b.addEventListener("mouseenter", () => {
    if (b.hasAttribute("data-lp-active")) return;
    b.style.background = "rgba(0,200,5,.12)";
  });
  b.addEventListener("mouseleave", () => {
    if (b.hasAttribute("data-lp-active")) {
      b.style.background = "";
      return;
    }
    b.style.background = "transparent";
  });
  if (activeStatusId === info.statusId) {
    b.setAttribute("data-lp-active", "");
    b.setAttribute("aria-pressed", "true");
  }
  return b;
}

/** First time we saw each article without its icon row; the fallback spot is used only after it stays missing. */
const firstSeen = new WeakMap<HTMLElement, number>();
const FALLBACK_AFTER_MS = 2500;

/** The element in the header icon row to insert before: walk up from the ⋯ caret to the first ancestor with siblings. */
function rowSlot(article: HTMLElement): HTMLElement | null {
  const caret = article.querySelector<HTMLElement>('[data-testid="caret"]');
  let child: HTMLElement | null = caret;
  while (child && child.parentElement && child.parentElement !== article && child.parentElement.children.length < 2) child = child.parentElement;
  return child?.parentElement ? child : null;
}

function scan(): void {
  let articles: HTMLElement[] = [];
  try {
    articles = [...document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')];
  } catch {
    return;
  }
  for (const article of articles) {
    try {
      const info = scrape(article);
      if (!info) continue;
      const existing = article.querySelector<HTMLElement>("[data-lp-launch]");
      const slot = rowSlot(article);
      if (slot) {
        // X paints the name first and the icon row a beat later. If we placed early (or the row re-rendered),
        // move the button into the row so it always reads as one more icon beside ⋯.
        if (existing) {
          if (existing.nextElementSibling !== slot) slot.parentElement!.insertBefore(existing, slot);
          continue;
        }
        slot.parentElement!.insertBefore(launchButton(info), slot);
        continue;
      }
      if (existing) continue;
      // No icon row yet: wait for it. Only after it stays missing do we settle for the name line.
      const t = firstSeen.get(article);
      if (t === undefined) {
        firstSeen.set(article, Date.now());
        window.setTimeout(schedule, FALLBACK_AFTER_MS + 50);
        continue;
      }
      if (Date.now() - t < FALLBACK_AFTER_MS) continue;
      article.querySelector('[data-testid="User-Name"]')?.parentElement?.append(launchButton(info));
    } catch {
      /* one bad tweet never breaks the timeline */
    }
  }
  // X re-renders tweets often — re-pin the glow onto whatever node currently owns the active Launch icon.
  if (activeStatusId) applyActiveLaunch();
}

// ------------------------------------------------------------------ profile Tip button

/** `x.com/<handle>` (no sub-path) → handle; reserved top-level routes are not profiles. */
const NOT_PROFILE = new Set(["home", "explore", "notifications", "messages", "i", "search", "settings", "compose", "login", "signup", "intent", "share", "hashtag", "tos", "privacy", "about", "jobs"]);
function profileHandle(): string | null {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return null;
  const h = parts[0]!;
  if (NOT_PROFILE.has(h.toLowerCase()) || !/^[A-Za-z0-9_]{1,15}$/.test(h)) return null;
  // /handle, /handle/with_replies, /handle/media, /handle/likes — the header is the same.
  if (parts.length === 2 && !["with_replies", "highlights", "media", "likes", "articles", "superfollows"].includes(parts[1]!.toLowerCase())) return null;
  return h;
}

let tipButtonOn = true;

function tipButton(handle: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("data-lp-tip", handle);
  b.title = `Tip @${handle} from launchpost`;
  b.setAttribute("aria-label", `Tip @${handle}`);
  // One more round icon in X's own action row (⋯ · message · Follow): their 36px circle + border, our green mark.
  b.style.cssText = [
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:36px",
    "height:36px",
    "margin-right:8px",
    "margin-bottom:12px",
    "padding:0",
    "border:1px solid rgb(83,100,113)",
    "border-radius:999px",
    "background:transparent",
    "color:#00c805",
    "cursor:pointer",
    "flex:0 0 auto",
    "transition:background .15s ease",
  ].join(";");
  b.innerHTML = BUBBLE_SVG;
  b.addEventListener("mouseenter", () => (b.style.background = "rgba(0,200,5,.12)"));
  b.addEventListener("mouseleave", () => (b.style.background = "transparent"));
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const header = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    const avatarImg = header?.querySelector<HTMLImageElement>(`[data-testid="UserAvatar-Container-${handle}"] img, [data-testid^="UserAvatar-Container"] img`);
    const avatar = avatarImg?.src && /profile_images/.test(avatarImg.src) ? hiResPfp(avatarImg.src) : null;
    const name = header?.querySelector<HTMLElement>('[data-testid="UserName"] span')?.textContent?.trim() ?? "";
    openSheet({ statusId: "", url: `https://x.com/${handle}`, handle, name, text: "", image: null, avatar, article: null }, { tab: "tip" });
  });
  return b;
}

/** Put a Tip icon at the start of the profile header's action row (before ⋯); remove it when we leave the profile. */
function placeTipButton(): void {
  const handle = tipButtonOn ? profileHandle() : null;
  const existing = document.querySelector<HTMLElement>("[data-lp-tip]");
  if (!handle) {
    existing?.remove();
    return;
  }
  if (existing && existing.getAttribute("data-lp-tip") === handle && existing.isConnected) return;
  existing?.remove();
  const col = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
  if (!col) return;
  // Own profile: no point tipping yourself.
  if (col.querySelector('[data-testid="editProfileButton"]')) return;
  // The ⋯ in the header is `userActions`; the Follow button lives in the same flex row. Never a tweet's ⋯.
  const more = col.querySelector<HTMLElement>('[data-testid="userActions"]:not(article *)');
  const follow = col.querySelector<HTMLElement>('[data-testid$="-follow"]:not(article *), [data-testid$="-unfollow"]:not(article *)');
  // Walk up from ⋯ to the element that is a direct child of the row (X wraps buttons in a div or two).
  let slot: HTMLElement | null = more ?? follow;
  const row = (follow ?? more)?.closest<HTMLElement>('div[style*="flex"]')?.parentElement ?? null;
  while (slot && slot.parentElement && slot.parentElement.children.length < 2 && slot.parentElement !== col) slot = slot.parentElement;
  const parent = slot?.parentElement ?? row;
  if (!slot || !parent) return;
  const btn = tipButton(handle);
  // Match the siblings' bottom margin so the row stays one line.
  const sib = slot as HTMLElement;
  const mb = getComputedStyle(sib).marginBottom;
  if (mb) btn.style.marginBottom = mb;
  parent.insertBefore(btn, slot);
}

let scanTimer = 0;
function schedule(): void {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    scan();
    try {
      placeTipButton();
    } catch {
      /* never break the page */
    }
  }, 200);
}

function boot(): void {
  ensureActiveStyles();
  scan();
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(TIP_BUTTON_KEY, (v) => {
      tipButtonOn = v[TIP_BUTTON_KEY] !== false;
      schedule();
    });
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "local" || !(TIP_BUTTON_KEY in ch)) return;
      tipButtonOn = ch[TIP_BUTTON_KEY]?.newValue !== false;
      schedule();
    });
  }
  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("lp-sheet-target", ((e: CustomEvent<{ statusId: string | null }>) => {
    setActiveLaunch(e.detail?.statusId ?? null);
  }) as EventListener);
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg?.type !== "launch-url" || typeof msg.url !== "string") return;
      const m = msg.url.match(STATUS_RE);
      if (!m?.[1]) return;
      const article = [...document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')].find((a) => statusOf(a)?.id === m[1]);
      if (article) {
        const info = scrape(article);
        if (info) openSheet(info);
        return;
      }
      openSheet({ statusId: m[1], url: msg.url, handle: "", name: "", text: "", image: null, avatar: null, article: null });
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });
}

if (document.body) boot();
else document.addEventListener("DOMContentLoaded", boot);
