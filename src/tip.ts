import { coin, getSession, openConnect, sendTip, stats, tipAllowance, tipBalances, type Session, type TipBalanceEntry, type TipResult } from "./api";
import { BOT_HANDLES } from "./command";

/**
 * The Tip tab of the sheet. Tips move the signed-in account's TipVault balance to another X account by handle —
 * either quietly (POST /compose/tip, no post) or by drafting "@launchpostbot tip @handle 1000 $SYM" in X's
 * compose box for them to post. The engine does every check (self-tip, balance, allowance, recipient lookup).
 */

export const TIP_BUTTON_KEY = "lp:tipButton";

export interface TipTarget {
  /** Recipient @handle without the @. Empty → the user types one. */
  handle: string;
  avatar: string | null;
  name: string | null;
}

export interface TipPaneOpts {
  target: TipTarget;
  /** Draft the text in X's compose box (reply under the post when there is one), never submits. */
  draftOnX: (text: string) => Promise<void>;
  close: () => void;
}

export const TIP_CSS = `
.tip { display: flex; flex-direction: column; gap: 10px; }
.tip .who { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid #232830; border-radius: 12px; background: #11151b; }
.tip .who img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #0b0d10; flex-shrink: 0; }
.tip .who .ph { width: 40px; height: 40px; border-radius: 50%; background: #1a1f26; flex-shrink: 0; }
.tip .who .col { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.tip .who .kicker { color: #00c805; font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.tip .who input { padding: 5px 8px; font-size: 14px; font-weight: 700; }
.tip .amt { display: flex; gap: 6px; align-items: stretch; }
.tip .amt input { flex: 1; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.tip .usd { color: #8b95a1; font-size: 12px; margin: -4px 0 0; min-height: 15px; font-variant-numeric: tabular-nums; }
.tip .usd b { color: #eef1f4; font-weight: 700; }
.tip .other { display: flex; gap: 6px; }
.tip .other input { flex: 1; font-family: Consolas, monospace; font-size: 12.5px; }
.tip .other button { padding: 7px 10px; }
.tip .tokbtn {
  display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 9px; border: 1px solid #2a3038;
  background: #0b0d10; color: #eef1f4; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.tip .tokbtn .chev { color: #6f7a85; font-size: 10px; }
.tip .tokbtn.open { border-color: #00c805; }
.tip .bal { display: flex; justify-content: space-between; gap: 8px; color: #8b95a1; font-size: 11.5px; margin: 0; }
.tip .bal b { color: #eef1f4; font-weight: 700; font-variant-numeric: tabular-nums; }
.tip .bal .ld { display: inline-block; width: 46px; height: 11px; border-radius: 4px; vertical-align: -1px;
  background: linear-gradient(90deg, #1a1f26 25%, #2a3038 50%, #1a1f26 75%); background-size: 200% 100%; animation: lp-shimmer 1.1s linear infinite; }
@keyframes lp-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.tip .bal .more { color: #5c6670; font-size: 10.5px; }
.tip .bal a { color: #00c805; text-decoration: none; }
.tip .actions { position: static; background: none; padding-top: 0; }
.tip .done { display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px solid rgba(0,200,5,.35); border-radius: 12px; background: rgba(0,200,5,.06); }
.tip .done .h { font-size: 16px; font-weight: 800; }
.tip .done .h b { color: #00c805; }
.tip .pref { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 6px; border-top: 1px solid #1a1f26; }
.tip .pref .lbl { color: #8b95a1; font-size: 11.5px; }
.tokmenu {
  position: fixed; z-index: 2147483647; max-height: min(260px, 45vh); overflow: auto;
  background: #11151b; border: 1px solid #2a3038; border-radius: 10px; box-shadow: 0 16px 48px rgba(0,0,0,.55); padding: 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.tokmenu button {
  display: flex; justify-content: space-between; gap: 10px; width: 100%; text-align: left; border: 0; background: transparent;
  color: #eef1f4; padding: 7px 9px; border-radius: 7px; font: inherit; font-size: 12.5px; cursor: pointer;
}
.tokmenu button span.b { color: #8b95a1; font-variant-numeric: tabular-nums; }
.tokmenu button:hover { background: rgba(0,200,5,.1); }
.tokmenu button.on { background: rgba(0,200,5,.16); color: #00c805; font-weight: 700; }
.tokmenu button.more { color: #8b95a1; border-top: 1px solid #232830; border-radius: 0 0 7px 7px; margin-top: 3px; padding-top: 9px; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 6 });

/** "5000", "5,000", "2.5k", "1m" → number; null when it isn't one. */
function parseAmount(raw: string): number | null {
  const m = /^\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*([kKmM])?\s*$/.exec(raw);
  if (!m) return null;
  let n = Number(`${m[1]!.replace(/,/g, "")}${m[2] ? `.${m[2]}` : ""}`);
  const s = (m[3] ?? "").toLowerCase();
  if (s === "k") n *= 1_000;
  else if (s === "m") n *= 1_000_000;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Show "2.5k" style in the draft when it round-trips exactly, else the plain number. */
function amountText(n: number): string {
  if (n >= 1_000_000 && Number.isInteger(n / 1_000_000)) return `${n / 1_000_000}M`;
  if (n >= 1_000 && Number.isInteger(n / 1_000)) return `${n / 1_000}k`;
  return String(n);
}

/** `token` null = $LAUNCHPOST by symbol (engine fills the address). `custom` = typed by the user, not from their balances. */
type Tok = { token: string | null; symbol: string; balance: number | null; custom?: boolean };
const LAUNCHPOST: Tok = { token: null, symbol: "LAUNCHPOST", balance: null };

const isCa = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
const shortCa = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function buildTipPane(root: ShadowRoot, opts: TipPaneOpts): HTMLElement {
  const pane = el("div", "tip");

  let sess: Session | null = null;
  let toHandle = opts.target.handle.replace(/^@/, "");
  let amount: number | null = 1000;
  let tok: Tok = LAUNCHPOST;
  let toks: Tok[] = [LAUNCHPOST];
  let allowanceLeft: number | null = null;
  let busy = false;
  let err = "";
  /** Balance reads in flight: "fast" = first $LAUNCHPOST read; "full" = the token discovery behind it. */
  let balLoading: "fast" | "full" | null = null;

  // ---- pricing: ETH/USD once; each token's curve price (in its pair) as we meet it. Missing → the ≈$ line hides.
  let ethUsd: number | null = null;
  let lpToken: string | null = null;
  /** lowercase token address → USD per whole token, null = unknown / not a launchpost coin. */
  const usdPer = new Map<string, number | null>();
  const priceAsked = new Set<string>();
  const priceToken = (addr: string) => {
    const a = addr.toLowerCase();
    if (priceAsked.has(a)) return;
    priceAsked.add(a);
    coin(a)
      .then((r) => {
        const c = r.coin;
        if (!c || !(c.priceEth > 0)) return usdPer.set(a, null);
        const pair = c.pair?.symbol ?? "ETH";
        // priceEth is in pair units. ETH → spot; USDG is a dollar; anything else we can't price here.
        if (pair === "ETH") usdPer.set(a, ethUsd === null ? null : c.priceEth * ethUsd);
        else if (pair === "USDG") usdPer.set(a, c.priceEth);
        else usdPer.set(a, null);
      })
      .catch(() => usdPer.set(a, null))
      .then(() => render());
  };
  const tokAddr = (t: Tok) => t.token ?? (t.symbol === "LAUNCHPOST" ? lpToken : null);
  const usdOf = (n: number | null, t: Tok): string | null => {
    const a = tokAddr(t);
    if (n === null || !a) return null;
    const p = usdPer.get(a.toLowerCase());
    if (p === undefined) {
      priceToken(a);
      return null;
    }
    if (p === null) return null;
    const v = n * p;
    return v < 0.01 ? "<$0.01" : `≈$${v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
  };
  stats()
    .then((s) => {
      ethUsd = s.ethUsd;
      lpToken = s.flywheel?.token ?? null;
      // ETH/USD arrived after a price did → recompute the ETH-paired ones.
      for (const a of [...usdPer.keys()]) {
        usdPer.delete(a);
        priceAsked.delete(a);
      }
      render();
    })
    .catch(() => null);

  // ---- recipient
  const who = el("div", "who");
  const av = opts.target.avatar ? Object.assign(document.createElement("img"), { src: opts.target.avatar, alt: "" }) : el("div", "ph");
  const col = el("div", "col");
  col.append(el("div", "kicker", "Tipping"));
  const handleIn = el("input") as HTMLInputElement;
  handleIn.placeholder = "@handle";
  handleIn.value = toHandle ? `@${toHandle}` : "";
  handleIn.autocapitalize = "off";
  handleIn.spellcheck = false;
  handleIn.addEventListener("input", () => {
    toHandle = handleIn.value.replace(/^@/, "").trim();
    err = "";
    render();
  });
  col.append(handleIn);
  who.append(av, col);

  // ---- amount + token
  const amtRow = el("div", "amt");
  const amtIn = el("input") as HTMLInputElement;
  amtIn.inputMode = "decimal";
  amtIn.placeholder = "1000";
  amtIn.value = "1000";
  amtIn.addEventListener("input", () => {
    amount = parseAmount(amtIn.value);
    err = "";
    render();
  });
  const tokBtn = el("button", "tokbtn");
  tokBtn.type = "button";
  const tokTxt = el("span", "", "$LAUNCHPOST");
  tokBtn.append(tokTxt, el("span", "chev", "▾"));
  amtRow.append(amtIn, tokBtn);

  // What the amount is worth, live, under the field.
  const usdLine = el("p", "usd");

  const chips = el("div", "chips");
  for (const v of [1000, 5000, 10000]) {
    const b = el("button", "", amountText(v));
    b.type = "button";
    b.addEventListener("click", () => {
      amount = v;
      amtIn.value = String(v);
      err = "";
      render();
    });
    chips.append(b);
  }

  // "Other coin…": any launchpost coin by $SYMBOL, or any Robinhood Chain ERC-20 by contract address.
  // The engine resolves it at send time; a launchpost CA also gets its symbol + price here.
  const other = el("div", "other");
  other.hidden = true;
  const otherIn = el("input") as HTMLInputElement;
  otherIn.placeholder = "$SYMBOL or 0x… contract";
  otherIn.autocapitalize = "characters";
  otherIn.spellcheck = false;
  const otherOk = el("button", "alt", "Use");
  otherOk.type = "button";
  const otherCancel = el("button", "alt", "×");
  otherCancel.type = "button";
  other.append(otherIn, otherOk, otherCancel);
  const useOther = () => {
    const raw = otherIn.value.trim();
    const v = raw.replace(/^\$/, "");
    if (isCa(v)) {
      tok = { token: v, symbol: shortCa(v), balance: null, custom: true };
      // A launchpost coin: name it properly (and price it). Anything else keeps the short address.
      coin(v.toLowerCase())
        .then((r) => {
          if (r.coin?.symbol && tok.token?.toLowerCase() === v.toLowerCase()) {
            tok = { ...tok, symbol: r.coin.symbol };
            render();
          }
        })
        .catch(() => null);
    } else if (/^[A-Za-z][A-Za-z0-9]{0,19}$/.test(v)) {
      tok = { token: null, symbol: v.toUpperCase(), balance: null, custom: true };
    } else {
      err = "Type a coin symbol like $NEIL, or paste its 0x contract address.";
      render();
      return;
    }
    // Their balance in it, if the vault knows one.
    const known = toks.find((t) => (tok.token && t.token?.toLowerCase() === tok.token.toLowerCase()) || t.symbol === tok.symbol);
    if (known) tok = known;
    err = "";
    other.hidden = true;
    otherIn.value = "";
    render();
  };
  otherOk.addEventListener("click", (e) => {
    e.stopPropagation();
    useOther();
  });
  otherIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      useOther();
    }
    if (e.key === "Escape") {
      e.stopPropagation();
      other.hidden = true;
    }
  });
  otherCancel.addEventListener("click", (e) => {
    e.stopPropagation();
    other.hidden = true;
  });
  other.addEventListener("click", (e) => e.stopPropagation());

  // Token menu — in-DOM (never a native <select>) so it shows in screen recordings.
  let menu: HTMLElement | null = null;
  const closeMenu = () => {
    menu?.remove();
    menu = null;
    tokBtn.classList.remove("open");
  };
  tokBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu) return closeMenu();
    tokBtn.classList.add("open");
    const m = el("div", "tokmenu");
    const rows = tok.custom && !toks.some((t) => t.symbol === tok.symbol) ? [...toks, tok] : toks;
    for (const t of rows) {
      const b = el("button", t.symbol === tok.symbol ? "on" : "");
      b.type = "button";
      b.append(el("span", "", `$${t.symbol}`), el("span", "b", t.balance === null ? "" : fmt(t.balance)));
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        tok = t;
        closeMenu();
        render();
      });
      m.append(b);
    }
    const more = el("button", "more");
    more.type = "button";
    more.append(el("span", "", "Other coin…"), el("span", "b", "$SYMBOL or 0x"));
    more.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeMenu();
      other.hidden = false;
      window.setTimeout(() => otherIn.focus(), 20);
    });
    m.append(more);
    const r = tokBtn.getBoundingClientRect();
    m.style.right = `${Math.round(window.innerWidth - r.right)}px`;
    m.style.top = `${Math.round(r.bottom + 4)}px`;
    m.style.minWidth = `${Math.round(Math.max(r.width, 220))}px`;
    root.append(m);
    menu = m;
  });
  pane.addEventListener("click", () => closeMenu());

  const bal = el("p", "bal");
  const errP = el("p", "err");
  errP.hidden = true;

  // ---- one button; the switch above it decides who tells the recipient (and therefore how the tip is sent):
  //   on  → "Send tip": quiet, from your tip balance; @launchpost posts the mention with the claim link.
  //   off → "Tip on X": you post "@launchpost tip @handle 1k" from your account; the bot executes and replies.
  // Signed out, only the X path exists, so the switch is pinned off.
  const actions = el("div", "actions");
  const send = el("button", "go", "Send tip");
  send.type = "button";
  actions.append(send);
  const note = el("p", "note", "");

  const NOTIFY_KEY = "lp:tipNotify";
  let notify = true;
  const notifyRow = el("div", "pref");
  notifyRow.style.borderTop = "0";
  notifyRow.style.paddingTop = "0";
  const notifyLbl = el("span", "lbl", "");
  const notifySw = el("button", "switch");
  notifySw.type = "button";
  notifySw.setAttribute("aria-label", "Who lets them know");
  const botPath = () => notify && !!sess?.authenticated;
  const syncNotify = () => {
    const on = botPath();
    notifySw.classList.toggle("on", on);
    notifySw.setAttribute("aria-pressed", on ? "true" : "false");
    notifySw.disabled = !sess?.authenticated;
    notifySw.style.opacity = sess?.authenticated ? "" : ".45";
    notifyLbl.textContent = !sess?.authenticated
      ? "You tell them — post the tip from your account. Sign in to let @launchpost do it."
      : on
        ? "@launchpost tells them — quiet tip, bot posts the claim link"
        : "You tell them — post the tip from your account";
    note.textContent = on
      ? "Moves it from your tip balance now. Nothing posts from you; @launchpost mentions them with the claim link."
      : "Opens X with the tip written for you. You press Post; @launchpost executes it and replies with the claim link.";
  };
  notifySw.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!sess?.authenticated) return;
    notify = !notify;
    syncNotify();
    render();
    if (typeof chrome !== "undefined") void chrome.storage?.local.set({ [NOTIFY_KEY]: notify });
  });
  notifyRow.append(notifyLbl, notifySw);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(NOTIFY_KEY, (v) => {
      notify = v[NOTIFY_KEY] !== false;
      syncNotify();
      render();
    });
  } else syncNotify();

  // ---- footer pref: profile Tip button on/off
  const pref = el("div", "pref");
  pref.append(el("span", "lbl", "Show a Tip button on X profiles"));
  const sw = el("button", "switch");
  sw.type = "button";
  sw.setAttribute("aria-label", "Tip button on profiles");
  let profileBtn = true;
  const syncSw = () => {
    sw.classList.toggle("on", profileBtn);
    sw.setAttribute("aria-pressed", profileBtn ? "true" : "false");
  };
  sw.addEventListener("click", (e) => {
    e.stopPropagation();
    profileBtn = !profileBtn;
    syncSw();
    if (typeof chrome !== "undefined") void chrome.storage?.local.set({ [TIP_BUTTON_KEY]: profileBtn });
  });
  pref.append(sw);
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(TIP_BUTTON_KEY, (v) => {
      profileBtn = v[TIP_BUTTON_KEY] !== false;
      syncSw();
    });
  } else syncSw();

  pane.append(who, el("label", "", "Amount"), amtRow, usdLine, other, chips, bal, errP, notifyRow, actions, note, pref);
  // "Amount" label styling: reuse the sheet's label look (flex column) but keep it a plain heading.
  const amtLbl = pane.querySelector("label")!;
  amtLbl.style.marginBottom = "-4px";

  const selfTip = () => !!sess?.handle && toHandle.toLowerCase() === sess.handle.replace(/^@/, "").toLowerCase();

  const render = () => {
    tokTxt.textContent = `$${tok.symbol}`;
    for (const c of chips.querySelectorAll("button")) c.classList.toggle("on", parseAmount(c.textContent ?? "") === amount);

    // ≈$ for the typed amount; also tag each chip so they read as money at a glance.
    const usd = usdOf(amount, tok);
    if (usd) {
      usdLine.replaceChildren(el("b", "", usd), ` for ${fmt(amount!)} $${tok.symbol}`);
    } else if (tok.custom && tok.token === null) {
      usdLine.textContent = `$${tok.symbol} — the engine finds the coin when you send`;
    } else {
      usdLine.textContent = "";
    }
    for (const c of chips.querySelectorAll("button")) {
      const v = parseAmount(c.textContent?.split(" ")[0] ?? "");
      const u = v === null ? null : usdOf(v, tok);
      c.title = u ? `${u}` : "";
    }

    const signedIn = !!sess?.authenticated;
    if (!signedIn) {
      const a = el("a", "", "Sign in");
      a.href = "#";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void openConnect();
      });
      const s = el("span");
      s.append(a, " to see your tip balance and let @launchpost tell them");
      bal.replaceChildren(s);
    } else {
      const have = tok.balance;
      const left = el("span");
      left.append("Balance ");
      if (have === null && !tok.custom && balLoading) {
        left.append(el("span", "ld"));
      } else {
        left.append(Object.assign(el("b"), { textContent: have === null ? "—" : fmt(have) }));
      }
      left.append(` $${tok.symbol}`);
      const haveUsd = have === null ? null : usdOf(have, tok);
      if (haveUsd) left.append(` · ${haveUsd}`);
      const right = el("span");
      if (balLoading === "full" && have !== null) {
        // First number is in; the other coins are still being discovered.
        right.append(el("span", "more", "checking other coins…"));
      } else if (tok.symbol === "LAUNCHPOST" && allowanceLeft !== null) {
        right.append("allowance ");
        right.append(Object.assign(el("b"), { textContent: fmt(allowanceLeft) }));
        right.append(" left today");
      } else if (have === 0) {
        const a = el("a", "", "Fund tip jar ↗");
        a.href = "https://launchpost.fun/claim?open=tips";
        a.target = "_blank";
        a.rel = "noopener";
        right.append(a);
      }
      bal.replaceChildren(left, right);
    }

    errP.hidden = !err;
    errP.textContent = err;

    const ready = !!toHandle && amount !== null && !busy;
    send.disabled = !ready || selfTip();
    send.textContent = busy ? "Sending…" : botPath() ? "Send tip" : "Tip on X";
    syncNotify();
  };

  // Posted form: "$SYM" names a launchpost coin; a pasted CA pins any ERC-20 (the parser reads both).
  const draft = () => {
    const amt = amount === null ? "" : amountText(amount);
    const isAddrSym = tok.custom && tok.token && tok.symbol === shortCa(tok.token);
    const coinBit = tok.symbol === "LAUNCHPOST" ? "" : isAddrSym ? ` ${tok.token}` : ` $${tok.symbol}${tok.token && tok.custom ? ` ${tok.token}` : ""}`;
    return `@${BOT_HANDLES[0]} tip @${toHandle} ${amt}${coinBit}`.trim();
  };

  const showDone = (r: Extract<TipResult, { ok: true }>) => {
    const done = el("div", "done");
    const h = el("div", "h");
    h.innerHTML = `✓ <b>${fmt(r.amount)} $${r.symbol}</b> → @${r.toHandle}`;
    const told = !!r.notified;
    const allowanceBit = r.allowanceUsed > 0 ? ` ${fmt(r.allowanceLeft ?? 0)} allowance left today.` : "";
    // Told by the bot → they'll see the mention. Otherwise the nudge is the primary action: an untold tip sits unclaimed.
    const sub = el("p", "note", told
      ? `@launchpost mentioned them with the claim link. They claim at https://launchpost.fun/claim with their X account — no wallet needed.${allowanceBit}`
      : `It's in their launchpost balance, but nothing was posted — they won't know unless you tell them. They claim at https://launchpost.fun/claim with their X account, no wallet needed.${allowanceBit}`);
    const tell = el("button", told ? "alt" : "go", told ? "Post about it too" : `Let @${r.toHandle} know`);
    tell.type = "button";
    tell.addEventListener("click", () => {
      const msg = `@${r.toHandle} I tipped you ${fmt(r.amount)} $${r.symbol} on launchpost — claim it at https://launchpost.fun/claim with your X account (no wallet needed)`;
      void opts.draftOnX(msg);
    });
    const row = el("div", "actions");
    const again = el("button", "alt", "Tip again");
    again.type = "button";
    again.addEventListener("click", () => {
      done.remove();
      pane.hidden = false;
      void loadBalances();
    });
    const closeB = el("button", told ? "go" : "alt", "Done");
    closeB.type = "button";
    closeB.addEventListener("click", opts.close);
    row.append(again, closeB);
    if (told) {
      const viewIt = el("a", "note", "View the bot's post ↗");
      viewIt.href = `https://x.com/i/status/${r.notified}`;
      viewIt.target = "_blank";
      viewIt.rel = "noopener";
      viewIt.style.color = "#00c805";
      done.append(h, sub, viewIt, row, tell);
    } else {
      done.append(h, sub, tell, row);
    }
    pane.hidden = true;
    pane.parentElement?.insertBefore(done, pane);
  };

  send.addEventListener("click", async () => {
    if (busy || !toHandle || amount === null) return;
    // Switch off (or signed out): the X path — draft the tip post, they press Post.
    if (!botPath()) {
      void opts.draftOnX(draft());
      return;
    }
    busy = true;
    err = "";
    render();
    try {
      // A CA pins the exact coin; a bare symbol lets the engine pick (LAUNCHPOST, or the best-matching launchpost coin).
      const symbol = tok.custom && tok.token ? "LAUNCHPOST" : tok.symbol;
      const r = await sendTip({ toHandle, amount, symbol, notify: true, ...(tok.token ? { tokenAddress: tok.token } : {}) });
      if (r.ok) showDone(r);
      else if (r.needsAuth) {
        sess = { authenticated: false };
        err = "Session expired — sign in again.";
        void openConnect();
      } else err = r.reason || "couldn't send that tip";
    } catch (e) {
      err = e instanceof Error ? e.message : "network error — try again";
    } finally {
      busy = false;
      render();
    }
  });

  const applyBalances = (b: { balance: number; balances: TipBalanceEntry[] }) => {
    const lp = b.balances.find((x) => x.symbol === "LAUNCHPOST");
    const rest = b.balances.filter((x) => x.symbol !== "LAUNCHPOST" && x.balance > 0);
    // Fast answer has $LAUNCHPOST only — keep any other coins we already know until the full list replaces them.
    const known = rest.length ? rest.map((x) => ({ token: x.token, symbol: x.symbol, balance: x.balance })) : toks.filter((t) => t.symbol !== "LAUNCHPOST" && !t.custom);
    toks = [{ token: lp?.token ?? lpToken, symbol: "LAUNCHPOST", balance: b.balance }, ...known];
    // Keep a typed "Other coin" unless the vault turns out to know it (then show its balance).
    tok = toks.find((t) => t.symbol === tok.symbol || (tok.token && t.token?.toLowerCase() === tok.token.toLowerCase())) ?? (tok.custom ? tok : toks[0]!);
  };

  /** Paint the $LAUNCHPOST number in one read, then fill in the other coins (log discovery, slower). */
  let loadSeq = 0;
  const loadBalances = async () => {
    if (!sess?.authenticated || !sess.userId) return;
    const uid = sess.userId;
    const seq = ++loadSeq;
    balLoading = "fast";
    render();
    const allowanceP = tipAllowance(uid).catch(() => null);
    const fast = await tipBalances(uid, true).catch(() => null);
    if (seq !== loadSeq) return;
    if (fast) applyBalances(fast);
    balLoading = "full";
    render();
    const [full, a] = await Promise.all([tipBalances(uid).catch(() => null), allowanceP]);
    if (seq !== loadSeq) return;
    if (full) applyBalances(full);
    allowanceLeft = a?.holder ? a.left : null;
    balLoading = null;
    render();
  };

  const refresh = async () => {
    sess = await getSession();
    render();
    await loadBalances();
  };
  void refresh();
  const onAuth = (m: { type?: string }) => {
    if (m?.type === "lp-auth") void refresh();
  };
  chrome.runtime?.onMessage?.addListener(onAuth);
  const onFocus = () => {
    if (pane.isConnected) void refresh();
  };
  window.addEventListener("focus", onFocus);
  const obs = new MutationObserver(() => {
    if (!pane.isConnected && !pane.parentElement) {
      chrome.runtime?.onMessage?.removeListener(onAuth);
      window.removeEventListener("focus", onFocus);
      closeMenu();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true });

  render();
  window.setTimeout(() => (toHandle ? amtIn : handleIn).focus(), 30);
  return pane;
}
