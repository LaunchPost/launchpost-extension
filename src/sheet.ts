import { PAIRS, buildBody, commandText, parsePost, suggestFromPost, BOT_HANDLES, type DevPlan, type LockDur } from "./command";
import { deploy, fetchPreview, getSession, makeLogo, openConnect, pollLaunch, selfLaunch, stats, type DeployResult, type Session } from "./api";
import { TIP_CSS, buildTipPane } from "./tip";

export interface TweetInfo {
  statusId: string;
  url: string;
  handle: string;
  name: string;
  text: string;
  image: string | null;
  /** True when `image` is a video poster frame (shown as Thumb; still defaults to that capture). */
  imageIsVideo?: boolean;
  /** The post author's avatar URL, when scraped. Offered as the coin logo when the post has no image. */
  avatar: string | null;
  /** Article the Launch button lived on, when we have it. Used to open X's own reply box. */
  article: HTMLElement | null;
}

/**
 * X timeline avatars are `_normal` (48×48). Match the engine (`platforms/x.ts`) and serve `_400x400`
 * so the sheet preview / coin logo isn't a blurry upscale of the thumb.
 */
export function hiResPfp(url: string): string {
  if (!/profile_images/i.test(url)) return url;
  return url.replace(/_(?:normal|bigger|mini|200x200)(\.(?:jpe?g|png|webp))?([?#]|$)/i, "_400x400$1$2");
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.back { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2147483646; }
.sheet {
  position: fixed; top: 0; right: 0; height: 100%; width: min(400px, 100vw); z-index: 2147483647;
  background: #0b0d10; color: #eef1f4; border-left: 1px solid #232830;
  font-family: Inter, "Segoe UI", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"; font-size: 14px;
  display: flex; flex-direction: column; box-shadow: -24px 0 60px rgba(0,0,0,.45);
}
.head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #1a1f26; }
.mark { width: 26px; height: 26px; border-radius: 8px; background: #00c805; color: #06120a; font-weight: 800; display: grid; place-items: center; }
.title { font-weight: 800; letter-spacing: -0.03em; font-size: 16px; }
.title b { color: #00c805; font-weight: 800; }
.x { margin-left: auto; background: transparent; border: 0; color: #8b95a1; font-size: 20px; cursor: pointer; }
.tabs { display: flex; gap: 2px; margin-left: 8px; padding: 2px; border-radius: 9px; background: #11151b; border: 1px solid #232830; }
.tab { border: 0; background: transparent; color: #8b95a1; font: inherit; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 7px; cursor: pointer; }
.tab.on { background: rgba(0,200,5,.14); color: #00c805; }
.body { overflow: auto; padding: 12px 14px 20px; display: flex; flex-direction: column; gap: 10px; }
.card { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid #232830; border-radius: 12px; background: #11151b; }
/* Post image IS the coin logo — show the whole thing, never a center crop. */
.card img.logo {
  width: 100%; max-height: 220px; height: auto; object-fit: contain; object-position: center;
  border-radius: 8px; background: #0b0d10; display: block;
}
.card .kicker { color: #00c805; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px; }
.card .who { font-weight: 700; font-size: 13.5px; }
.card .tx { color: #98a2ad; margin: 2px 0 0; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; }
.card .logo-note { color: #6f7a85; font-size: 11px; margin-top: 4px; }
/* Logo mode: one compact tab strip — hint below carries the long copy. */
.logopick { display: flex; flex-direction: column; gap: 6px; }
.logopick .lbl { color: #8b95a1; font-size: 11.5px; }
.logopick .opts {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(56px, 1fr)); gap: 4px;
  padding: 3px; border-radius: 10px; background: #11151b; border: 1px solid #232830;
}
.pick {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 8px 4px; border: 0; border-radius: 8px; background: transparent; color: #98a2ad;
  font-size: 11px; font-weight: 600; line-height: 1.15; text-align: center; cursor: pointer; min-height: 52px;
  position: relative;
}
.pick input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.pick.on { color: #00c805; background: rgba(0,200,5,.14); }
.pick:hover { color: #eef1f4; }
.pick.on:hover { color: #00c805; }
.pick img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; background: #0b0d10; }
.pick img.post-thumb { border-radius: 4px; }
.logopick .hint { color: #6f7a85; font-size: 11.5px; line-height: 1.35; }
.logoprev { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #232830; border-radius: 10px; background: #11151b; }
.logoprev img {
  width: 100%; max-height: 140px; object-fit: contain; object-position: center;
  border-radius: 8px; background: #0b0d10; display: block;
}
.logoprev .col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.logoprev .busy { color: #8b95a1; font-size: 12px; }
.logoprev .mini { display: flex; gap: 6px; }
.logoprev .mini button { background: transparent; color: #98a2ad; border: 1px solid #2a3038; border-radius: 8px; padding: 5px 9px; font: inherit; font-size: 12px; cursor: pointer; }
.logoprev .mini button:hover { color: #eef1f4; }
label { display: flex; flex-direction: column; gap: 3px; color: #8b95a1; font-size: 11.5px; }
label .opt { color: #5c6670; font-size: 10.5px; margin-left: 5px; }
input, textarea {
  width: 100%; padding: 7px 10px; border-radius: 9px; border: 1px solid #2a3038; background: #0b0d10; color: #eef1f4;
  font: inherit; font-size: 13.5px; outline: none;
}
textarea { resize: vertical; min-height: 52px; }
input:focus, textarea:focus, .pairbtn:focus, .pairbtn.open { border-color: #00c805; }
.ph::placeholder { color: #6f7a85; font-style: italic; }
/* In-DOM pair picker — native <select> menus paint as an OS popup and vanish in screen recordings. */
.pairwrap { position: relative; }
.pairbtn {
  width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 7px 10px; border-radius: 9px; border: 1px solid #2a3038; background: #0b0d10; color: #eef1f4;
  font: inherit; font-size: 13.5px; cursor: pointer; text-align: left;
}
.pairbtn .chev { color: #6f7a85; font-size: 10px; flex-shrink: 0; }
.pairmenu {
  position: fixed; z-index: 2147483647; max-height: min(280px, 45vh); overflow: auto;
  background: #11151b; border: 1px solid #2a3038; border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,.55); padding: 6px;
  display: flex; flex-direction: column; gap: 4px;
}
.pairmenu .pairq {
  width: 100%; padding: 6px 9px; border-radius: 7px; border: 1px solid #2a3038; background: #0b0d10;
  color: #eef1f4; font: inherit; font-size: 12.5px; outline: none; flex-shrink: 0;
}
.pairmenu .pairq:focus { border-color: #00c805; }
.pairmenu .plist { overflow: auto; display: flex; flex-direction: column; gap: 1px; min-height: 0; }
.pairmenu .plist button {
  display: block; width: 100%; text-align: left; border: 0; background: transparent;
  color: #eef1f4; padding: 7px 9px; border-radius: 7px; font: inherit; font-size: 12.5px; cursor: pointer;
}
.pairmenu .plist button:hover { background: rgba(0,200,5,.1); }
.pairmenu .plist button.on { background: rgba(0,200,5,.16); color: #00c805; font-weight: 700; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.check { flex-direction: row; align-items: center; gap: 8px; color: #eef1f4; font-size: 13px; }
.check input { width: auto; accent-color: #00c805; }
.pct { width: 72px !important; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
[hidden] { display: none !important; }
.chips button, .radios label { cursor: pointer; }
.chips button { border: 1px solid #2a3038; background: #11151b; color: #eef1f4; border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12.5px; }
.chips button.on { color: #00c805; border-color: rgba(0,200,5,.5); background: rgba(0,200,5,.12); }
.radios { display: flex; gap: 12px; color: #eef1f4; font-size: 13px; }
.radios label { flex-direction: row; align-items: center; gap: 6px; }
.radios input { accent-color: #00c805; }
pre {
  margin: 0; padding: 8px 10px; border-radius: 10px; background: #000; border: 1px solid #2f3336;
  font-family: "JetBrains Mono", Consolas, monospace, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"; font-size: 11.5px; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; color: #e7e9ea;
}
.err { color: #ff8a3d; font-size: 12px; margin: 0; }
.ok { color: #8b95a1; font-size: 11.5px; margin: 0; font-family: Consolas, monospace, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"; }
.actions { display: flex; gap: 8px; position: sticky; bottom: -4px; padding-top: 4px; background: linear-gradient(180deg, transparent, #0b0d10 28%); }
button.go { flex: 1; background: #00c805; color: #06120a; border: 0; border-radius: 10px; padding: 10px 12px; font-weight: 800; font-size: 14px; cursor: pointer; }
button.go:disabled { opacity: .45; cursor: default; }
button.alt { background: #0b0d10; color: #98a2ad; border: 1px solid #2a3038; border-radius: 10px; padding: 10px 12px; font: inherit; cursor: pointer; }
.note { color: #6f7a85; font-size: 11.5px; margin: 0; }
.deploy-callout {
  margin-top: 2px; padding: 10px; border: 1px solid #232830; border-radius: 12px; background: #0e1218;
  display: flex; flex-direction: column; gap: 6px;
}
.deploy-callout .hd { font-size: 12.5px; font-weight: 700; color: #c8d0d8; margin: 0; }
.deploy-callout .blurb { color: #6f7a85; font-size: 11.5px; margin: 0; line-height: 1.35; }
.deploy-callout button.quiet {
  width: 100%; background: transparent; color: #00c805; border: 1px solid rgba(0,200,5,.35);
  border-radius: 10px; padding: 8px 12px; font: inherit; font-weight: 700; font-size: 13px; cursor: pointer;
}
.deploy-callout button.quiet:disabled { opacity: .4; cursor: default; color: #6f7a85; border-color: #2a3038; }
.deploy-callout a { color: #98a2ad; }
.devrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.devrow .dlbl { color: #8b95a1; font-size: 11.5px; }
.switch {
  position: relative; width: 36px; height: 20px; border-radius: 999px; border: 1px solid #2a3038;
  background: #11151b; cursor: pointer; flex-shrink: 0; padding: 0;
}
.switch.on { background: rgba(0,200,5,.25); border-color: rgba(0,200,5,.55); }
.switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
  background: #6f7a85; transition: transform .15s ease, background .15s ease;
}
.switch.on::after { transform: translateX(16px); background: #00c805; }
.devsetup { color: #8b95a1; font-size: 11.5px; margin: 0; line-height: 1.35; }
.devsetup a { color: #00c805; }
.fields { display: flex; flex-direction: column; gap: 8px; }
`;

let host: HTMLElement | null = null;

/** Tell the content script which tweet the sheet is open on (null = closed). */
function emitSheetTarget(statusId: string | null): void {
  document.dispatchEvent(new CustomEvent("lp-sheet-target", { detail: { statusId } }));
}

function teardownSheet(clearTarget: boolean): void {
  host?.remove();
  host = null;
  if (clearTarget) emitSheetTarget(null);
}

export function closeSheet(): void {
  teardownSheet(true);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/**
 * Try X's own reply box first; intent URL if it doesn't appear in time. Never submits.
 * Callers close the sheet first — our backdrop sits above X's dialog and would swallow its focus.
 * X gives the home composer and the reply dialog the same `tweetTextarea_0` test id, so the dialog's
 * box is looked up inside `role="dialog"` only; the bare id is never used while a dialog is open.
 */
async function replyOnX(info: TweetInfo, text: string): Promise<void> {
  const article = info.article;
  const replyBtn = article?.querySelector<HTMLElement>('[data-testid="reply"]');
  if (replyBtn) {
    replyBtn.click();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const dialog = document.querySelector<HTMLElement>('div[role="dialog"]');
      const box = dialog?.querySelector<HTMLElement>('[data-testid="tweetTextarea_0"], [contenteditable="true"]') ?? null;
      if (box) {
        box.focus();
        // The dialog's editor is only writable once it has taken focus; give X a frame.
        await new Promise((r) => setTimeout(r, 60));
        const ok = document.execCommand("insertText", false, text);
        if (ok) return;
        break;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }
  // No post to reply under (profile tip) → a fresh compose; otherwise reply in the thread.
  const u = `https://x.com/intent/post?text=${encodeURIComponent(text)}${info.statusId ? `&in_reply_to=${encodeURIComponent(info.statusId)}` : ""}`;
  window.open(u, "_blank", "noopener,noreferrer");
}

/** First non-X/t.co link in the post — the article/video the story is about, offered as the coin's website. */
function storyLink(text: string): string {
  const urls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return urls.find((u) => !/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i.test(u) && !/^https?:\/\/t\.co\//i.test(u)) ?? "";
}

export type SheetTab = "launch" | "tip";

export function openSheet(info: TweetInfo, sheetOpts: { tab?: SheetTab } = {}): void {
  teardownSheet(false);
  host = document.createElement("div");
  host.setAttribute("data-lp-sheet", "");
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS + TIP_CSS;
  root.append(style);

  const back = el("div", "back");
  const sheet = el("div", "sheet");
  back.addEventListener("click", closeSheet);
  // Pin which Launch icon / tweet is live before the sheet paints, so the timeline lights up instantly.
  // A profile-page open has no status id — nothing to light up.
  emitSheetTarget(info.statusId || null);
  root.append(back, sheet);
  document.documentElement.append(host);

  const head = el("div", "head");
  head.append(el("div", "mark", "$"), el("div", "title"));
  head.querySelector(".title")!.innerHTML = "launch<b>post</b>";
  // Launch | Tip — Launch is the product; Tip is the quiet second tab.
  const tabs = el("div", "tabs");
  const tabLaunch = el("button", "tab", "Launch");
  tabLaunch.type = "button";
  const tabTip = el("button", "tab", "Tip");
  tabTip.type = "button";
  tabs.append(tabLaunch, tabTip);
  head.append(tabs);
  const x = el("button", "x", "×");
  x.type = "button";
  x.addEventListener("click", closeSheet);
  head.append(x);
  sheet.append(head);

  const body = el("div", "body");
  sheet.append(body);
  const tipBody = el("div", "body");
  tipBody.hidden = true;
  sheet.append(tipBody);

  let tipMounted = false;
  const showTab = (t: SheetTab) => {
    const tip = t === "tip";
    body.hidden = tip;
    tipBody.hidden = !tip;
    tabLaunch.classList.toggle("on", !tip);
    tabTip.classList.toggle("on", tip);
    if (tip && !tipMounted) {
      tipMounted = true;
      tipBody.append(
        buildTipPane(root, {
          target: { handle: info.handle, avatar: info.avatar ? hiResPfp(info.avatar) : null, name: info.name || null },
          // Close first so X's dialog is on top and takes the text (same as Reply on X in the Launch tab).
          draftOnX: (text) => {
            closeSheet();
            return replyOnX(info, text);
          },
          close: closeSheet,
        }),
      );
    }
  };
  tabLaunch.addEventListener("click", () => showTab("launch"));
  tabTip.addEventListener("click", () => showTab("tip"));
  // A profile open has no post to launch off — hide Launch entirely.
  if (!info.statusId) {
    tabLaunch.hidden = true;
    tabs.hidden = true;
  }

  const card = el("div", "card");
  // Big preview of whatever logo mode is selected — Post / Pfp / Upload / AI. Hidden for Attach.
  const cardLogo = document.createElement("img");
  cardLogo.className = "logo";
  cardLogo.alt = "Coin logo";
  cardLogo.hidden = true;
  card.append(cardLogo);
  const meta = el("div");
  meta.append(el("div", "kicker", "Launching under this post"));
  meta.append(el("div", "who", info.handle ? `@${info.handle.replace(/^@/, "")}` : "post"));
  meta.append(el("p", "tx", info.text.replace(/\s+/g, " ").trim() || "(no text)"));
  // With media (photo or video thumb), default logo is what we captured — they can switch to Pfp / Upload / AI.
  const logoNote = el("div", "logo-note", "Coin logo defaults to this image — use the tabs below to change it.");
  logoNote.hidden = !info.image;
  meta.append(logoNote);
  card.append(meta);
  body.append(card);

  // Logo picker always shown: Post/Thumb (when the narrative has media) · Pfp · Upload · AI · Attach.
  type LogoMode = "post" | "pfp" | "upload" | "generate" | "attach";
  let logoMode: LogoMode = info.image ? "post" : info.avatar ? "pfp" : "generate";
  let uploadUrl: string | null = null;
  let aiUrl: string | null = null;
  let logoBusy = false;
  let logoErr = "";
  const opHandle = () => (info.handle ? `@${info.handle.replace(/^@/, "")}` : "@op");
  const deployPrimary = () => !!(sess?.authenticated && sess.holder);
  const currentLogoUrl = () => (logoMode === "upload" ? uploadUrl : logoMode === "generate" ? aiUrl : logoMode === "post" ? info.image : null);
  /** What the hero preview should show for the active tab (pfp uses the avatar URL). */
  const cardLogoUrl = (): string | null => {
    if (logoMode === "post") return info.image;
    if (logoMode === "pfp") return info.avatar ? hiResPfp(info.avatar) : null;
    if (logoMode === "upload") return uploadUrl;
    if (logoMode === "generate") return aiUrl;
    return null;
  };
  const syncCardLogo = () => {
    const url = cardLogoUrl();
    if (url) {
      if (cardLogo.getAttribute("src") !== url) cardLogo.src = url;
      cardLogo.hidden = false;
      cardLogo.alt =
        logoMode === "post"
          ? "Coin logo — this post's image"
          : logoMode === "pfp"
            ? "Coin logo — profile picture"
            : logoMode === "upload"
              ? "Coin logo — your upload"
              : "Coin logo — AI generated";
    } else {
      cardLogo.removeAttribute("src");
      cardLogo.hidden = true;
    }
  };
  const overridingPost = () => !!info.image && logoMode !== "post";

  const picker = el("div", "logopick");
  picker.append(el("div", "lbl", info.image ? "Coin logo" : "No image on this post — logo"));
  const pickerOpts = el("div", "opts");

  const pickerImg = document.createElement("img");
  pickerImg.alt = "";
  if (info.avatar) pickerImg.src = hiResPfp(info.avatar);
  pickerImg.hidden = !info.avatar;
  const postThumb = document.createElement("img");
  postThumb.alt = "";
  postThumb.className = "post-thumb";
  if (info.image) postThumb.src = info.image;
  postThumb.hidden = !info.image;

  type Opt = { label: HTMLLabelElement; radio: HTMLInputElement; mode: LogoMode };
  const opts: Opt[] = [];
  const mkOpt = (mode: LogoMode, title: string, leading?: HTMLElement): Opt => {
    const label = el("label", "pick" + (mode === logoMode ? " on" : ""));
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "lp-logo";
    radio.checked = mode === logoMode;
    radio.addEventListener("change", () => selectMode(mode));
    label.append(radio);
    if (leading) label.append(leading);
    label.append(el("span", "pt", title));
    const o: Opt = { label, radio, mode };
    opts.push(o);
    return o;
  };
  const oPost = mkOpt("post", info.imageIsVideo ? "Thumb" : "Post", postThumb);
  const oPfp = mkOpt("pfp", "Pfp", pickerImg);
  const oUpload = mkOpt("upload", "Upload");
  const oGenerate = mkOpt("generate", "AI");
  const oAttach = mkOpt("attach", "Attach");
  pickerOpts.append(oPost.label, oPfp.label, oUpload.label, oGenerate.label, oAttach.label);

  // Preview of the chosen upload/generated logo, big enough to judge, with regenerate / change-file / remove.
  const previewImg = document.createElement("img");
  previewImg.alt = "";
  previewImg.hidden = true;
  const previewBusy = el("span", "busy");
  const regenBtn = el("button");
  regenBtn.type = "button";
  regenBtn.addEventListener("click", () => (logoMode === "upload" ? fileInput.click() : void doGenerate()));
  const clearBtn = el("button", "", "Remove");
  clearBtn.type = "button";
  clearBtn.addEventListener("click", () => {
    if (logoMode === "upload") uploadUrl = null;
    else aiUrl = null;
    logoErr = "";
    updatePicker();
    render();
  });
  const previewMini = el("div", "mini");
  previewMini.append(regenBtn, clearBtn);
  const previewCol = el("div", "col");
  previewCol.append(previewBusy, previewMini);
  const pickerPreview = el("div", "logoprev");
  pickerPreview.append(previewImg, previewCol);
  pickerPreview.hidden = true;

  const pickerErr = el("p", "err");
  pickerErr.hidden = true;
  const pickerHint = el("div", "hint");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  fileInput.hidden = true;
  fileInput.addEventListener("change", () => {
    const f = fileInput.files?.[0] ?? null;
    fileInput.value = "";
    if (f) void doUpload(f);
  });

  picker.append(pickerOpts, pickerPreview, pickerErr, pickerHint, fileInput);
  body.append(picker);

  // Reconcile the picker DOM with state. Never calls render()/syncDeploy() (they call it), so no loops.
  const updatePicker = () => {
    picker.hidden = false;
    const signedIn = !!sess?.authenticated;
    const hasPost = !!info.image;
    oPost.label.hidden = !hasPost;
    oPfp.label.hidden = false;
    oUpload.label.hidden = false;
    oGenerate.label.hidden = false;
    oAttach.label.hidden = false;
    // If the late preview filled an image while they were on pfp/generate, keep their pick; if mode was
    // impossible (post with no image), fall back.
    if (!hasPost && logoMode === "post") logoMode = info.avatar ? "pfp" : "generate";
    for (const o of opts) {
      o.radio.checked = o.mode === logoMode;
      o.label.classList.toggle("on", o.mode === logoMode);
    }

    // Generate/Upload preview panel — Generate shows its button even before sign-in (click kicks off Connect).
    const showPrev = logoMode === "generate" || logoMode === "upload";
    pickerPreview.hidden = !showPrev;
    if (showPrev) {
      const url = currentLogoUrl();
      if (url && previewImg.src !== url) previewImg.src = url;
      previewImg.hidden = !url;
      previewBusy.hidden = !logoBusy;
      previewBusy.textContent = logoBusy ? (logoMode === "upload" ? "Uploading…" : "Generating…") : "";
      regenBtn.textContent = logoMode === "upload" ? (url ? "Change file" : "Choose file") : url ? "Regenerate" : "Generate";
      regenBtn.disabled = logoBusy;
      clearBtn.hidden = logoBusy || !url;
    }

    pickerErr.hidden = !logoErr;
    pickerErr.textContent = logoErr;

    const url = currentLogoUrl();
    logoNote.hidden = !(hasPost && logoMode === "post");
    // Keep the Post/Thumb tab label in sync if late preview flips photo ↔ video.
    const postTitle = oPost.label.querySelector(".pt");
    if (postTitle) postTitle.textContent = info.imageIsVideo ? "Thumb" : "Post";
    syncCardLogo();
    pickerHint.textContent =
      logoMode === "post"
        ? info.imageIsVideo
          ? "Using this video frame as the coin logo. Switch to Pfp for the author’s picture."
          : "Using this post's image as the coin logo. Pick another tab to replace it."
        : logoMode === "pfp"
          ? `We'll use ${opHandle()}'s profile picture as the logo.`
          : logoMode === "upload"
            ? !signedIn
              ? "Sign in once — then pick a file from your PC and you'll see it here before Reply."
              : url
                ? "Your image — Reply on X uses exactly this. Change file if you want another."
                : "Pick a JPEG, PNG or WebP (max 2MB). You'll see it here before you Reply."
            : logoMode === "generate"
              ? !signedIn
                ? "Hit Generate — we'll ask you to sign in, then draw a preview you can Regenerate."
                : url
                  ? "Like it? Reply on X uses this exact image. Regenerate if not."
                  : "Hit Generate when you're ready — Regenerate until you like it, then Reply on X."
              : "Attach an image in X's reply box after you hit Reply on X.";
  };

  const selectMode = (mode: LogoMode) => {
    logoMode = mode;
    logoErr = "";
    updatePicker();
    render();
    if (logoBusy) return;
    // Generate waits for the Generate button — never auto-fires on tab select.
    if (mode === "upload") {
      if (!sess?.authenticated) {
        setDeployStatus("ok", "Opening launchpost sign-in — come back here to upload a logo.");
        void openConnect();
        startSessionPoll();
        return;
      }
      if (!uploadUrl) fileInput.click();
    }
  };

  const doGenerate = async () => {
    if (logoBusy) return;
    if (!sess?.authenticated) {
      setDeployStatus("ok", "Opening launchpost sign-in — come back here when you're done.");
      void openConnect();
      startSessionPoll();
      return;
    }
    const eff = effOf();
    const subject = [eff.name || eff.ticker, info.text].filter(Boolean).join(" — ").trim();
    if (!subject) {
      logoErr = "Add a ticker (or name) first so we know what to draw.";
      updatePicker();
      return;
    }
    logoBusy = true;
    logoErr = "";
    updatePicker();
    syncDeploy();
    try {
      const res = await makeLogo({ generate: true, name: eff.name, ticker: eff.ticker, subject });
      if (res.needsAuth) {
        sess = { authenticated: false };
        logoErr = "Session expired — reconnecting…";
        void openConnect();
        startSessionPoll();
      } else if (res.needsHolder) {
        // Generate is no longer holder-gated; if an old worker still says so, surface it plainly.
        logoErr = res.error ?? "Couldn't generate a logo.";
      } else if (res.url) {
        aiUrl = res.url;
      } else {
        logoErr = res.error ?? "Couldn't generate a logo — try again.";
      }
    } catch (e) {
      logoErr = e instanceof Error ? e.message : "Couldn't generate a logo.";
    } finally {
      logoBusy = false;
      updatePicker();
      syncDeploy();
      render();
    }
  };

  const doUpload = async (file: File) => {
    if (logoBusy) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      logoErr = "Use a PNG, JPEG or WebP image.";
      updatePicker();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      logoErr = "Image too large — keep it under 2MB.";
      updatePicker();
      return;
    }
    logoBusy = true;
    logoErr = "";
    updatePicker();
    syncDeploy();
    try {
      const image = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("couldn't read that file"));
        fr.readAsDataURL(file);
      });
      const res = await makeLogo({ image });
      if (res.needsAuth) {
        sess = { authenticated: false };
        logoErr = "Session expired — reconnecting…";
        void openConnect();
        startSessionPoll();
      } else if (res.url) {
        uploadUrl = res.url;
      } else {
        logoErr = res.error ?? "upload failed — try another image";
      }
    } catch (e) {
      logoErr = e instanceof Error ? e.message : "upload failed";
    } finally {
      logoBusy = false;
      updatePicker();
      syncDeploy();
      render();
    }
  };

  const suggestion = suggestFromPost(info.text, info.handle, info.name);
  let ticker = "";
  let name = "";
  let description = "";
  let pairSymbol = "ETH";
  let giftOn = false;
  let giftPct = 100;
  let devBuyOn = false;
  let devPlan: DevPlan = "none";
  let lockDur: LockDur = "30d";

  const field = (label: string, node: HTMLElement, hint?: string) => {
    const l = el("label");
    l.append(document.createTextNode(label));
    if (hint) l.append(el("span", "opt", hint));
    l.append(node);
    return l;
  };

  // Ticker is the one decision. Suggested only when the post hands us one; otherwise the user types it.
  const tickerIn = el("input") as HTMLInputElement;
  tickerIn.className = "ph";
  tickerIn.placeholder = suggestion.ticker || "Your ticker";
  tickerIn.autocapitalize = "characters";
  tickerIn.maxLength = 10;
  const nameIn = el("input") as HTMLInputElement;
  nameIn.className = "ph";
  nameIn.placeholder = suggestion.name || "Defaults to the ticker";
  // Never pre-filled: the post is already the story. This is for their own line.
  const descIn = document.createElement("textarea");
  descIn.className = "ph";
  descIn.placeholder = "Your own line, if you want one";
  descIn.rows = 2;

  const pairLabel = (sym: string) => {
    if (sym === "ETH") return "ETH (default)";
    const p = PAIRS.find((x) => x.symbol === sym);
    return p ? `${p.symbol} · ${p.name}` : sym;
  };
  // Custom list (not <select>) so the open menu paints inside the page — screen recorders capture it.
  const pairWrap = el("div", "pairwrap");
  const pairBtn = el("button", "pairbtn");
  pairBtn.type = "button";
  pairBtn.setAttribute("aria-haspopup", "listbox");
  pairBtn.setAttribute("aria-expanded", "false");
  const pairBtnText = el("span", "", pairLabel(pairSymbol));
  pairBtn.append(pairBtnText, el("span", "chev", "▾"));
  pairWrap.append(pairBtn);
  let pairMenu: HTMLElement | null = null;
  const closePairMenu = () => {
    pairMenu?.remove();
    pairMenu = null;
    pairBtn.classList.remove("open");
    pairBtn.setAttribute("aria-expanded", "false");
  };
  const syncPairBtn = () => {
    pairBtnText.textContent = pairLabel(pairSymbol);
  };
  const openPairMenu = () => {
    if (pairMenu) {
      closePairMenu();
      return;
    }
    pairBtn.classList.add("open");
    pairBtn.setAttribute("aria-expanded", "true");
    const menu = el("div", "pairmenu");
    menu.setAttribute("role", "listbox");
    pairMenu = menu;
    const q = el("input") as HTMLInputElement;
    q.className = "pairq";
    q.placeholder = "Search pairs…";
    q.addEventListener("click", (e) => e.stopPropagation());
    const list = el("div", "plist");
    const fill = (filter: string) => {
      list.replaceChildren();
      const f = filter.trim().toLowerCase();
      for (const p of PAIRS) {
        const label = pairLabel(p.symbol);
        if (f && !`${p.symbol} ${p.name}`.toLowerCase().includes(f)) continue;
        const b = el("button", p.symbol === pairSymbol ? "on" : "", label);
        b.type = "button";
        b.setAttribute("role", "option");
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          pairSymbol = p.symbol;
          syncPairBtn();
          closePairMenu();
          if (typeof chrome !== "undefined") void chrome.storage?.local.set({ pair: pairSymbol });
          render();
        });
        list.append(b);
      }
    };
    q.addEventListener("input", () => fill(q.value));
    fill("");
    menu.append(q, list);
    const place = () => {
      const r = pairBtn.getBoundingClientRect();
      menu.style.left = `${Math.round(r.left)}px`;
      menu.style.top = `${Math.round(r.bottom + 4)}px`;
      menu.style.width = `${Math.round(r.width)}px`;
    };
    place();
    root.append(menu);
    window.setTimeout(() => q.focus(), 20);
  };
  pairBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPairMenu();
  });
  // Close when they click the dimmer or elsewhere in the sheet.
  back.addEventListener("click", closePairMenu);
  sheet.addEventListener("click", () => closePairMenu());
  pairWrap.addEventListener("click", (e) => e.stopPropagation());

  const gift = document.createElement("input");
  gift.type = "checkbox";
  const giftLabel = el("label", "check");
  const giftSpan = el("span", "", `Fees to @${info.handle.replace(/^@/, "") || "op"}`);
  giftLabel.append(gift, giftSpan);
  const pct = el("input") as HTMLInputElement;
  pct.type = "number";
  pct.min = "1";
  pct.max = "100";
  pct.value = "100";
  pct.className = "pct";
  const pctRow = el("div", "row");
  pctRow.append(pct, el("span", "", "% (100 = full gift)"));
  pctRow.hidden = true;

  // Dev buy: toggle on → Lock / Burn (and lock duration) always show. Jar warning stays under them if it isn't funded yet.
  const devRow = el("div", "devrow");
  devRow.append(el("span", "dlbl", "Dev buy"));
  const devSwitch = el("button", "switch");
  devSwitch.type = "button";
  devSwitch.setAttribute("aria-label", "Dev buy");
  devSwitch.setAttribute("aria-pressed", "false");
  const devSetup = el("p", "devsetup");
  devSetup.hidden = true;
  const radios = el("div", "radios");
  radios.hidden = true;
  for (const v of ["lock", "burn"] as const) {
    const l = document.createElement("label");
    const r = document.createElement("input");
    r.type = "radio";
    r.name = "lp-dev";
    r.value = v;
    r.checked = v === "lock";
    r.addEventListener("change", () => {
      if (!devBuyOn) return;
      devPlan = v;
      chips.hidden = v !== "lock";
      render();
    });
    l.append(r, document.createTextNode(v === "lock" ? "Lock" : "Burn"));
    radios.append(l);
  }
  const chips = el("div", "chips");
  chips.hidden = true;
  for (const d of ["30d", "90d", "6m", "1y"] as const) {
    const b = el("button", d === "30d" ? "on" : "", d);
    b.type = "button";
    b.addEventListener("click", () => {
      lockDur = d;
      for (const c of chips.querySelectorAll("button")) c.classList.toggle("on", c.textContent === d);
      render();
    });
    chips.append(b);
  }
  const syncDevBuy = () => {
    devSwitch.classList.toggle("on", devBuyOn);
    devSwitch.setAttribute("aria-pressed", devBuyOn ? "true" : "false");
    if (!devBuyOn) {
      devPlan = "none";
      radios.hidden = true;
      chips.hidden = true;
      devSetup.hidden = true;
      return;
    }
    if (devPlan === "none") devPlan = "lock";
    radios.hidden = false;
    chips.hidden = devPlan !== "lock";
    for (const inp of radios.querySelectorAll<HTMLInputElement>("input")) inp.checked = inp.value === devPlan;
    const ready = !!(sess?.authenticated && sess.devBuyReady);
    if (ready) {
      devSetup.hidden = true;
      return;
    }
    // Still pick Lock/Burn; the jar warning sits under so they know Reply needs ETH funded first.
    devSetup.hidden = false;
    if (!sess?.authenticated) {
      devSetup.innerHTML = `Sign in, then fund a jar at <a href="https://launchpost.fun/claim?open=devbuy" target="_blank" rel="noopener">/claim</a> — Lock / Burn need a filled jar.`;
    } else if (!sess.claimed) {
      devSetup.innerHTML = `Link a wallet and fill your jar at <a href="https://launchpost.fun/claim?open=devbuy" target="_blank" rel="noopener">/claim</a> — then Lock or Burn works on Reply.`;
    } else {
      devSetup.innerHTML = `Fill your jar at <a href="https://launchpost.fun/claim?open=devbuy" target="_blank" rel="noopener">/claim</a> (set a per-launch amount) — Lock / Burn need ETH in the jar before you Reply.`;
    }
  };
  devSwitch.addEventListener("click", () => {
    devBuyOn = !devBuyOn;
    if (devBuyOn) {
      devPlan = "lock";
      lockDur = "30d";
      for (const c of chips.querySelectorAll("button")) c.classList.toggle("on", c.textContent === "30d");
    }
    syncDevBuy();
    render();
  });
  devRow.append(devSwitch);

  const preview = document.createElement("pre");
  const status = el("p", "ok");
  const go = el("button", "go", "Reply on X");
  go.type = "button";
  const alt = el("button", "alt", "Full composer");
  alt.type = "button";
  const actions = el("div", "actions");
  actions.append(go, alt);

  // ---- Deploy (bottom callout): holders can launch without an X reply / without @bot.
  // Most people — holders included — still Reply on X under the post. Deploy is opt-in when they don't want the bot tagged.
  let sess: Session | null = null;
  let allowSelfPosts = false;
  let anon = false;
  let deploying = false;
  let deployPoll = 0;
  let sessPoll = 0;

  const deployHd = el("p", "hd", "Don't want @bot in the reply?");
  const deployBlurb = el("p", "blurb");
  const deployBtn = el("button", "quiet", "Deploy without @bot");
  deployBtn.type = "button";
  const anonChk = document.createElement("input");
  anonChk.type = "checkbox";
  const anonLabel = el("label", "check");
  anonLabel.append(anonChk, el("span", "", "Hide me as creator (anonymous)"));
  anonLabel.hidden = true;
  const sessLine = el("p", "note");
  const deployStatus = el("p", "ok");
  deployStatus.hidden = true;
  const deployWrap = el("div", "deploy-callout");
  deployWrap.append(deployHd, deployBlurb, deployBtn, anonLabel, sessLine, deployStatus);

  const effOf = () => ({
    ticker: (ticker.trim() || suggestion.ticker).replace(/^\$/, "").toUpperCase(),
    name: name.trim() || suggestion.name,
    description: description.trim(),
  });
  const setDeployStatus = (cls: "ok" | "err", text: string) => {
    deployStatus.className = cls;
    deployStatus.textContent = text;
    deployStatus.hidden = !text;
  };
  const syncDeploy = () => {
    updatePicker();
    syncDevBuy();
    const t = effOf().ticker;
    const attachBlocks = logoMode === "attach";
    const needsLogo = (logoMode === "upload" || logoMode === "generate") && !currentLogoUrl();
    const isHolder = !!(sess?.authenticated && sess.holder);
    anonLabel.hidden = !isHolder;

    deployBlurb.textContent =
      "Reply on X is how most launches work — your reply sits under their post with @launchpostbot. Holders can also Deploy quietly: no reply, no bot tag.";

    if (!sess) {
      deployBtn.hidden = true;
      sessLine.textContent = "";
    } else if (!sess.authenticated) {
      deployBtn.hidden = false;
      deployBtn.textContent = "Connect to Deploy quietly";
      deployBtn.disabled = deploying;
      sessLine.textContent = "Optional. Only if you don't want @bot in the thread.";
    } else if (!sess.holder) {
      // Free path is Reply above — don't wave a locked "holders only" button at them.
      deployBtn.hidden = true;
      sessLine.innerHTML = `Optional holder perk — hold ${(sess.minTokens ?? 1_000_000).toLocaleString()} $LAUNCHPOST (<a href="https://launchpost.fun/claim" target="_blank" rel="noopener">claim</a>). Until then, Reply on X above.`;
    } else if (attachBlocks) {
      deployBtn.hidden = false;
      deployBtn.textContent = "Pick a logo for Deploy first";
      deployBtn.disabled = true;
      sessLine.textContent = "\"Attach\" only works with Reply on X. For Deploy, use Post, Pfp, Upload, or AI.";
    } else if (logoBusy) {
      deployBtn.hidden = false;
      deployBtn.textContent = logoMode === "upload" ? "Uploading logo…" : "Generating logo…";
      deployBtn.disabled = true;
      sessLine.textContent = "Hang on — getting your logo ready.";
    } else if (needsLogo) {
      deployBtn.hidden = false;
      deployBtn.textContent = logoMode === "upload" ? "Upload a logo first" : "Generate a logo first";
      deployBtn.disabled = true;
      sessLine.textContent = logoMode === "upload" ? "Choose an image — you'll see it before Deploy." : "Generate an AI logo — you'll see it before Deploy.";
    } else {
      deployBtn.hidden = false;
      deployBtn.textContent = t ? `Deploy $${t} without @bot${anon ? " · anon" : ""}` : "Deploy without @bot";
      deployBtn.disabled = deploying || !t;
      sessLine.textContent = `As @${sess.handle}${anon ? " · anonymous" : ""}. Skips the reply — coin still links to this post.`;
    }
  };
  anonChk.addEventListener("change", () => {
    anon = anonChk.checked;
    syncDeploy();
  });

  const refreshSession = async () => {
    sess = await getSession();
    syncDeploy();
    // After Connect, resume Upload file picker if that's the open tab — Generate stays manual.
    if (!logoBusy && sess?.authenticated) {
      if (logoMode === "upload" && !uploadUrl) fileInput.click();
      else updatePicker();
    } else updatePicker();
  };
  const startSessionPoll = () => {
    window.clearInterval(sessPoll);
    const until = Date.now() + 120_000;
    sessPoll = window.setInterval(async () => {
      if (!host?.isConnected || Date.now() > until) return window.clearInterval(sessPoll);
      sess = await getSession();
      syncDeploy();
      updatePicker();
      if (sess?.authenticated) {
        window.clearInterval(sessPoll);
        if (!logoBusy && logoMode === "upload" && !uploadUrl) fileInput.click();
      }
    }, 1500);
  };

  const showSuccess = (token: string, sym: string) => {
    window.clearInterval(deployPoll);
    deploying = false;
    const done = el("div");
    done.style.cssText = "display:flex;flex-direction:column;gap:12px";
    const h = el("div");
    h.style.cssText = "font-size:18px;font-weight:800";
    h.innerHTML = `🎉 <span style="color:#00c805">$${sym}</span> is live`;
    const sub = el("p", "note", "Deployed on Robinhood Chain — no post needed. Announcing is optional; you press Post.");
    const openBtn = el("button", "go", "Open coin ↗");
    openBtn.type = "button";
    openBtn.addEventListener("click", () => window.open(`https://launchpost.fun/coin/${token}`, "_blank", "noopener"));
    const announce = el("button", "alt", "Announce on X ↗");
    announce.type = "button";
    announce.addEventListener("click", () => {
      closeSheet();
      void replyOnX(info, `$${sym} is live on Robinhood Chain\n\nlaunchpost.fun/coin/${token}`);
    });
    const topRow = el("div", "actions");
    topRow.append(openBtn, announce);
    const doneBtn = el("button", "alt", "Close");
    doneBtn.type = "button";
    doneBtn.addEventListener("click", closeSheet);
    done.append(h, sub, topRow, doneBtn);
    body.replaceChildren(done);
  };
  const pollDone = (id: number, sym: string) => {
    window.clearInterval(deployPoll);
    const tick = () =>
      pollLaunch(id)
        .then((r) => {
          if (r.status === "launched" && r.token) showSuccess(r.token, r.symbol ?? sym);
          else if (r.status === "failed" || r.status === "rejected") {
            deploying = false;
            syncDeploy();
            setDeployStatus("err", r.reason ?? "launch failed");
          }
        })
        .catch(() => {});
    deployPoll = window.setInterval(() => (host?.isConnected ? void tick() : window.clearInterval(deployPoll)), 2500);
    void tick();
  };
  const deployGo = async () => {
    if (!sess?.authenticated) {
      setDeployStatus("ok", "Opening launchpost sign-in — come back here when you're done.");
      void openConnect();
      startSessionPoll();
      return;
    }
    if (!sess.holder) return;
    const eff = effOf();
    if (!eff.ticker) {
      setDeployStatus("err", "Pick a ticker first.");
      return;
    }
    deploying = true;
    syncDeploy();
    setDeployStatus("ok", "Deploying…");
    try {
      // Deploy logo: post/thumb image when mode is "post" (pass URL so video thumbs work — API media is photo-only unless filled);
      // else pfp / hosted upload-AI / monogram. Engine only trusts this post / pbs.twimg.com / our media CDN.
      const logo =
        logoMode === "post" && info.image
          ? info.image
          : logoMode === "pfp"
            ? (info.avatar ? hiResPfp(info.avatar) : "none")
            : logoMode === "upload" || logoMode === "generate"
              ? (currentLogoUrl() ?? "none")
              : info.image && !info.imageIsVideo
                ? undefined
                : "none";
      const res: DeployResult = await deploy({ url: info.url, ticker: eff.ticker, name: eff.name, description: eff.description, pair: pairSymbol, website: storyLink(info.text), anon, logo });
      if (res.needsAuth) {
        sess = { authenticated: false };
        deploying = false;
        syncDeploy();
        setDeployStatus("ok", "Session expired — reconnecting…");
        void openConnect();
        startSessionPoll();
        return;
      }
      if (res.post && (res.kind === "queued" || res.post.status === "launched")) {
        pollDone(res.post.id, eff.ticker);
        return;
      }
      deploying = false;
      syncDeploy();
      setDeployStatus("err", res.reason ?? res.error ?? res.kind ?? "couldn't deploy");
    } catch (e) {
      deploying = false;
      syncDeploy();
      setDeployStatus("err", e instanceof Error ? e.message : "couldn't deploy");
    }
  };
  deployBtn.addEventListener("click", () => void deployGo());

  const render = () => {
    const effTicker = ticker.trim() || suggestion.ticker;
    const effName = name.trim() || suggestion.name;
    const effDesc = description.trim();
    if (!effTicker) {
      preview.textContent = "@launchpostbot $…";
      status.className = "err";
      status.textContent = "Pick a ticker — that's the only thing the post can't tell us.";
      go.disabled = true;
      go.onclick = null;
      syncDeploy();
      return;
    }
    const built = buildBody({
      ticker: effTicker,
      pairSymbol,
      name: effName,
      description: effDesc,
      // Lock/Burn go in the command when selected. Intake still needs a funded jar — the warning under the radios says so.
      devPlan: devBuyOn && (devPlan === "lock" || devPlan === "burn") ? devPlan : "none",
      lockDur,
      giftOn,
      giftPct,
      giftHandle: info.handle || "op",
      pfp: logoMode === "pfp",
      ai: logoMode === "generate",
      upload: logoMode === "upload" && !!uploadUrl,
    });
    const text = commandText(built);
    preview.textContent = text || "—";
    const parsed = text
      ? parsePost(text, { botHandles: BOT_HANDLES, narrativeHandle: giftOn ? info.handle.replace(/^@/, "") || "op" : null })
      : null;
    const needsLogoPreview = (logoMode === "generate" && !aiUrl) || (logoMode === "upload" && !uploadUrl);
    const ok = parsed?.ok === true && !needsLogoPreview && !logoBusy;
    go.disabled = !ok;
    if (needsLogoPreview || logoBusy) {
      status.className = "err";
      status.textContent = !sess?.authenticated
        ? logoMode === "upload"
          ? "Sign in to upload a logo from your PC before you Reply."
          : "Sign in to preview the AI logo here before you Reply."
        : logoBusy
          ? logoMode === "upload"
            ? "Uploading…"
            : "Generating logo preview…"
          : logoMode === "upload"
            ? "Choose a file — you'll see it here before Reply."
            : "Generate a logo preview first — Regenerate if you don't like it.";
    } else if (parsed?.ok) {
      status.className = "ok";
      const l = parsed.launch;
      const logoBit =
        logoMode === "post"
          ? " · post"
          : l.logoFrom === "pfp"
            ? " · pfp"
            : l.logoFrom === "ai"
              ? " · ai"
              : l.logoFrom === "upload"
                ? " · upload"
                : logoMode === "attach"
                  ? " · attach"
                  : "";
      status.textContent = `$${l.symbol} · ${l.name}${l.pair ? ` · ${l.pair}` : ""}${logoBit}${l.giftTo ? ` · gift @${l.giftTo}` : ""}${l.devPlan ? ` · ${l.devPlan}` : ""}`;
    } else if (parsed) {
      status.className = "err";
      status.textContent =
        parsed.reason === "ticker_too_long"
          ? "Ticker too long — max 10 characters."
          : parsed.reason === "ticker_too_short" || parsed.reason === "bad_ticker"
            ? "Ticker too short — use at least 2 characters."
            : parsed.reason === "unknown_pair"
              ? `Unknown pair — try ETH or a stock like MSTR, NVDA, TSLA.`
              : parsed.reason === "no_ticker"
                ? "Pick a ticker — that's the only thing the post can't tell us."
                : parsed.reason;
    } else {
      status.className = "ok";
      status.textContent = "";
    }
    go.onclick = () => {
      if (!ok || !text) return;
      if (allowSelfPosts) {
        // Demo: post as the bot + launch in one API call (X never delivers self-mentions).
        go.disabled = true;
        const prev = go.textContent;
        go.textContent = "Launching…";
        status.className = "ok";
        status.textContent = "Posting reply and launching — hang on.";
        void selfLaunch(info.url, text)
          .then((r) => {
            if (r.kind === "queued" || r.kind === "launched" || r.post?.status === "launched" || r.post?.token) {
              status.className = "ok";
              status.textContent = r.post?.token
                ? r.mode === "post"
                  ? `Live — $${r.post.symbol ?? ""} (X blocked a thread reply, so it's a top-level post with that narrative).`
                  : `Live — $${r.post.symbol ?? ""} is on the thread.`
                : "Queued — the bot reply should land on the thread now.";
              go.textContent = "Done";
              if (r.replyUrl) window.open(r.replyUrl, "_blank", "noopener");
              return;
            }
            status.className = "err";
            status.textContent = r.reason || r.error || `Didn't launch (${r.kind}).`;
            go.disabled = false;
            go.textContent = prev || "Post & launch";
          })
          .catch((e) => {
            status.className = "err";
            status.textContent = e instanceof Error ? e.message : "Launch failed";
            go.disabled = false;
            go.textContent = prev || "Post & launch";
          });
        return;
      }
      closeSheet();
      void replyOnX(info, text);
    };
    syncDeploy();
  };

  tickerIn.addEventListener("input", () => {
    ticker = tickerIn.value.replace(/^\$/, "");
    tickerIn.classList.toggle("ph", !ticker);
    render();
  });
  nameIn.addEventListener("input", () => {
    name = nameIn.value;
    nameIn.classList.toggle("ph", !name);
    render();
  });
  descIn.addEventListener("input", () => {
    description = descIn.value;
    descIn.classList.toggle("ph", !description);
    render();
  });
  gift.addEventListener("change", () => {
    giftOn = gift.checked;
    pctRow.hidden = !giftOn;
    render();
  });
  pct.addEventListener("input", () => {
    giftPct = Number(pct.value) || 100;
    render();
  });
  alt.addEventListener("click", () => {
    window.open(`https://launchpost.fun/compose?url=${encodeURIComponent(info.url)}`, "_blank", "noopener");
  });

  body.append(
    field("Ticker", tickerIn),
    field("Name", nameIn, "optional"),
    field("Description", descIn, "optional"),
    field("Pair", pairWrap),
    giftLabel,
    pctRow,
    devRow,
    devSetup,
    radios,
    chips,
    preview,
    status,
    actions,
    el("p", "note", "You press Post. We never post for you. Edit anything in X's box before you do."),
    // Deploy is opt-in at the bottom — same product, just skip @bot when a holder asks for it.
    deployWrap,
  );
  // The one field they must touch gets the cursor. On a suggested ticker they can just hit Reply.
  if ((sheetOpts.tab ?? "launch") === "launch" && info.statusId) window.setTimeout(() => tickerIn.focus(), 30);

  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get("pair", (v) => {
      if (typeof v.pair === "string" && PAIRS.some((p) => p.symbol === v.pair)) {
        pairSymbol = v.pair;
        syncPairBtn();
        render();
      }
    });
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (pairMenu) {
      closePairMenu();
      e.stopPropagation();
      return;
    }
    closeSheet();
  };
  document.addEventListener("keydown", onKey);
  host.addEventListener("remove", () => document.removeEventListener("keydown", onKey));

  // Load the launchpost session for the Deploy gate, and re-check it when the /connect tab hands one over
  // (background broadcasts "lp-auth") or when the user tabs back to X.
  void refreshSession();
  void stats()
    .then((s) => {
      allowSelfPosts = !!s.allowSelfPosts;
      if (allowSelfPosts) {
        go.textContent = "Post & launch";
        render();
      }
    })
    .catch(() => null);
  const onAuth = (m: { type?: string }) => {
    if (m?.type === "lp-auth") void refreshSession();
  };
  chrome.runtime?.onMessage?.addListener(onAuth);
  const onFocus = () => {
    if (host?.isConnected) void refreshSession();
  };
  window.addEventListener("focus", onFocus);

  // custom element remove doesn't fire "remove" on the host when we call .remove(). Use a cleanup on close.
  const orig = closeSheet;
  // closeSheet is module-level; key listener leak is one sheet at a time — remove listener inside close by wrapping host.
  const obs = new MutationObserver(() => {
    if (!host?.isConnected) {
      document.removeEventListener("keydown", onKey);
      chrome.runtime?.onMessage?.removeListener(onAuth);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(sessPoll);
      window.clearInterval(deployPoll);
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true });

  render();
  void orig;
  showTab(sheetOpts.tab ?? (info.statusId ? "launch" : "tip"));

  // Profile opens have no post to preview.
  if (info.statusId && (!info.text || info.text.endsWith("…") || info.text.length < 20)) {
    void fetchPreview(info.url)
      .then((p) => {
        if (!host?.isConnected) return;
        if (p.text && p.text.length > info.text.length) {
          info.text = p.text;
          const next = suggestFromPost(p.text, p.authorHandle || info.handle);
          suggestion.ticker = next.ticker;
          suggestion.name = next.name;
          suggestion.description = next.description;
          if (!ticker) tickerIn.placeholder = next.ticker;
          if (!name) nameIn.placeholder = next.name;
          if (!description) descIn.placeholder = next.description;
          const tx = card.querySelector(".tx");
          if (tx) tx.textContent = p.text;
          render();
        }
        if (p.authorHandle && !info.handle) {
          info.handle = p.authorHandle;
          giftSpan.textContent = `Fees to @${p.authorHandle}`;
          const who = card.querySelector(".who");
          if (who) who.textContent = `@${p.authorHandle.replace(/^@/, "")}`;
          updatePicker();
        }
        // Late avatar (fallback open with no article) fills the Pfp tab thumbnail.
        if (p.authorAvatar && !info.avatar) {
          info.avatar = hiResPfp(p.authorAvatar);
          pickerImg.src = info.avatar;
          pickerImg.hidden = false;
          updatePicker();
        }
        // Late media: show Post/Thumb and default to the capture (photo or video frame).
        if (p.image && !info.image) {
          const video = /(?:ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)/i.test(p.image);
          info.image = p.image;
          info.imageIsVideo = video;
          postThumb.src = p.image;
          postThumb.hidden = false;
          logoMode = "post";
          logoNote.hidden = false;
          updatePicker();
          render();
        }
      })
      .catch(() => null);
  }
}
