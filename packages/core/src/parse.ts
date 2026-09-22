import { RULES } from "./fees.ts";
import { findPair } from "./pairs.ts";
import type { CoinLinks, ParseResult } from "./types.ts";

/**
 * The post grammar. Deliberately tiny so it works the same in a tweet, a Telegram message, a Reddit
 * comment or an Instagram caption:
 *
 *     $TICKER                          → symbol TICKER, name "TICKER", no description
 *     $TICKER Some Name                → name "Some Name"
 *     Some Name $TICKER                → name "Some Name"  (name before the ticker also works)
 *     $TICKER Some Name - one line     → description "one line"  (dash, en/em dash, colon or pipe)
 *     $TICKER Some Name
 *     The description on the next line → description from the following lines
 *
 * Our own handle, URLs and a leading "/launch" command are ignored. The first attached image becomes the
 * logo; the parser only reports it. A bare `pfp` token asks for the OP's avatar; `ai` / `generate logo`
 * opts into AI generation (skips the engine's silent OP-avatar default for imageless narrative launches).
 * A post that carries a claim code (LP-XXXXXX) is a verification, not a launch, and is reported as such.
 */

const CLAIM_CODE = /\bLP-([A-Z0-9]{6})\b/;
const URL_RE = /https?:\/\/\S+/gi;
/**
 * Bare domains people actually type: "neiltheseal.xyz", "t.me/neil", "x.com/neil". Must start a word, have a
 * real-looking TLD, and not be part of an email or a number. Promoted to https:// before link classification.
 */
const BARE_DOMAIN_RE = /(?<![\w@.\/:])((?:[a-z0-9-]+\.)+(?:xyz|com|fun|io|app|net|org|co|me|gg|lol|wtf|ai|dev|finance|money|cash|club|world|so|to|tv|sh|link|site|online|info|biz|us|uk|de|fr|jp|ca|au|eth|sol)(?:\/[^\s)]*)?)(?![\w.])/gi;
const promoteBareDomains = (text: string) =>
  text.replace(BARE_DOMAIN_RE, (m, d: string) => {
    const host = d.split("/")[0]!.toLowerCase();
    // "$1.5m", "v2.0", "e.g." → never; keep tickers-with-dots and abbreviations out of the link pile.
    if (/^\d/.test(host)) return m;
    if (host.length < 5 && !/^(t\.me|x\.com)$/.test(host)) return m;
    return `https://${d}`;
  });
const SEPARATOR = /\s+[-–—|]\s+|\s*[:|]\s+|\s+[-–—]\s*$|^\s*[-–—:]\s*/;

export interface ParseOptions {
  /** Handles that refer to us on this platform (without @), removed from the text before parsing. */
  botHandles?: string[];
  media?: string[];
  /** URLs to ignore (the post's own permalink, our site, platform media stubs). */
  ignoreUrls?: string[];
  /**
   * Handle (without @) of the author of the post being replied to. "for @thatperson" is then a gift wherever it
   * appears in the post, not only at the end: nobody writes "for @op" mid-sentence about the OP by accident.
   */
  narrativeHandle?: string | null;
}

const NOISE_HOSTS = /^(t\.co|pic\.twitter\.com|pbs\.twimg\.com)$/i;
const NOISE_PATHS = /^https?:\/\/(www\.)?(x|twitter)\.com\/i\//i;

/**
 * Sort a post's URLs into the coin's social slots. The first ordinary link is the website; X / Telegram /
 * Discord links go to their own slots. The post's own permalink and CDN stubs are never links.
 */
export function classifyLinks(urls: string[], ignore: string[] = []): CoinLinks {
  const out: CoinLinks = { website: null, twitter: null, telegram: null, discord: null };
  const skip = new Set(ignore.map((u) => u.replace(/\/+$/, "").toLowerCase()));
  for (const raw of urls) {
    const url = raw.replace(/[),.;!?]+$/, "");
    if (skip.has(url.replace(/\/+$/, "").toLowerCase())) continue;
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!host || NOISE_HOSTS.test(host) || NOISE_PATHS.test(url)) continue;
    if (/^(x\.com|twitter\.com)$/.test(host)) {
      if (/\/status\//.test(url)) continue; // a linked post is context, not a profile
      out.twitter ??= url;
    } else if (/^(t\.me|telegram\.me)$/.test(host)) out.telegram ??= url;
    else if (/^(discord\.gg|discord\.com)$/.test(host)) out.discord ??= url;
    else out.website ??= url;
  }
  return out;
}

function stripBot(text: string, handles: string[]): string {
  let out = text;
  for (const h of handles) {
    const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // "@handle", "u/handle", and the hashtag form "#handle" used on Instagram/TikTok where mentions aren't queryable.
    out = out.replace(new RegExp(`(^|\\s)(@|#|u/|/u/)${esc}\\b:?`, "gi"), "$1");
  }
  return out;
}

/** "$500K", "$1.6M", "$10B", "$100k" — dollar amounts, which people write constantly and never mean as tickers. */
const isAmount = (raw: string) => /^\d+(?:\.\d+)?[KMB]$/i.test(raw);

function clean(s: string): string {
  return s
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/^[\s\-–—:|,.]+|[\s\-–—:|,]+$/g, "")
    .trim();
}

/**
 * People talk to the bot like a person: "launch artificial Pepe, ticket $APEPE and use this picture". None of
 * the instruction words are the coin's name. Strip them (both sides of the ticker) before choosing a name.
 */
const INSTRUCTION_RE = new RegExp(
  [
    // verbs addressed to the bot, with optional politeness/object
    String.raw`\b(?:please|pls|plz|kindly)\b`,
    String.raw`\b(?:can|could|would)\s+(?:you|u)\s+(?:please\s+)?`,
    String.raw`\b(?:launch|deploy|create|make|mint|start|drop|ship|spin\s+up)\s+(?:me\s+|us\s+|a\s+|the\s+|this\s+|my\s+)?(?:coin|token|memecoin|meme\s*coin|one|it)?\b(?:\s+(?:called|named|for me|for us))?`,
    String.raw`\b(?:ticker|ticket|symbol|name)\s*(?:is|:|=)?\s*$`,
    String.raw`\b(?:ticker|ticket|symbol)\b\s*(?:is|:|=)?`,
    // the image
    String.raw`\b(?:and\s+)?(?:use|using|with|take|pick|attach|set)\s+(?:this|the|that|my|attached)?\s*(?:pic(?:ture)?|image|img|photo|logo|art(?:work)?)(?:\s+(?:as|for)\s+(?:the\s+)?(?:logo|image|pfp))?\b`,
    String.raw`\b(?:this|the)\s+(?:pic(?:ture)?|image|photo)\s+(?:is|as)\s+(?:the\s+)?logo\b`,
    String.raw`\b(?:for\s+me|for\s+us|on\s+launchpost|on\s+robinhood(?:\s+chain)?)\b`,
  ].join("|"),
  "gi",
);
const stripInstructions = (s: string) => clean(s.replace(INSTRUCTION_RE, " "));
/** "and use this picture", "with the image", "then pair with…" — a continuation, never a name. */
const STARTS_AS_CONTINUATION = /^(?:and|with|using|then|plus|also|so|but|or)\b/i;

export function extractClaimCode(text: string): string | null {
  const m = CLAIM_CODE.exec(text.toUpperCase());
  return m ? `LP-${m[1]}` : null;
}

export function parsePost(rawText: string, opts: ParseOptions = {}): ParseResult {
  const claimCode = extractClaimCode(rawText);
  if (claimCode) return { ok: false, reason: "is_claim_code", claimCode };

  const normalised = promoteBareDomains(rawText.replace(/\r\n?/g, "\n"));
  const links = classifyLinks(normalised.match(URL_RE) ?? [], opts.ignoreUrls ?? []);
  let text = normalised.replace(URL_RE, " ");
  // Contract addresses and long hashes are never a name or description — people paste CAs next to tickers.
  text = text.replace(/\b0x[a-fA-F0-9]{16,}\b/g, " ").replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, " ");
  text = stripBot(text, opts.botHandles ?? []);
  text = text.replace(/^\s*\/launch\b/i, " ");

  // Gift / split clause: "for @op", "fees to @op", "gift to @op", "100% to @op" give the whole creator share away;
  // "50% to @op", "half to @op", "25% of fees to @op" split it. Accepted in the two places people put it: at the
  // very end ("$X Name - desc for @op"), or between the ticker/name and the description's dash ("$X Name 50% to
  // @op - desc"). Never mid-description, so "…hard for @everyone" in prose stays prose. Removed from the text so
  // the handle doesn't leak into the name or description.
  let giftTo: string | null = null;
  let giftBps: number | null = null;
  {
    const firstTicker = text.search(/\$[A-Za-z]/);
    if (firstTicker >= 0) {
      const afterTicker = text.slice(firstTicker);
      const sepRel = afterTicker.search(/\s[-–—:]\s|\n/);
      const descStart = sepRel < 0 ? text.length : firstTicker + sepRel;
      const re =
        /(?:^|\s)(?:(?<pct>\d{1,3})\s*%\s*(?:of\s+(?:the\s+)?fees\s+)?to|(?<half>half)\s+(?:of\s+(?:the\s+)?fees\s+)?to|(?:all\s+)?(?:the\s+)?fees\s+(?:go\s+)?to|for|gift(?:ed)?(?:\s+to)?)\s+@(?<handle>[A-Za-z0-9_]{1,32})(?=\s*[.!,]?\s*$|\s+[-–—:]\s|\n)/gi;
      for (const m of text.matchAll(re)) {
        const idx = m.index ?? -1;
        const handle = m.groups?.handle;
        if (idx <= firstTicker || !handle) continue;
        const pct = m.groups?.half ? 50 : m.groups?.pct ? Number(m.groups.pct) : 100;
        if (pct <= 0 || pct > 100) continue;
        const end = idx + m[0].length;
        const trailing = /^\s*[.!,]?\s*$/.test(text.slice(end));
        const beforeDesc = idx < descStart;
        if (trailing || beforeDesc) {
          giftTo = handle;
          giftBps = pct * 100;
          // Take the clause out along with a comma that led into it and any punctuation that closed it.
          const before = text.slice(0, idx).replace(/[,;]\s*$/, "");
          const after = text.slice(end).replace(/^\s*[.!,]+/, "");
          text = `${before} ${after}`;
          break;
        }
      }
      // Second pass, OP only: "for @op" anywhere after the ticker is a gift, whatever follows it ("$X Name for @op
      // Send it to 100M"). What follows becomes the description when the post has no dash of its own.
      const op = opts.narrativeHandle?.replace(/^@/, "");
      if (!giftTo && op) {
        const reOp = new RegExp(
          `(?:^|\\s)(?:(?<pct>\\d{1,3})\\s*%\\s*(?:of\\s+(?:the\\s+)?fees\\s+)?to|(?<half>half)\\s+(?:of\\s+(?:the\\s+)?fees\\s+)?to|(?:all\\s+)?(?:the\\s+)?fees\\s+(?:go\\s+)?to|for|gift(?:ed)?(?:\\s+to)?)\\s+@(?<handle>${op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![A-Za-z0-9_])`,
          "i",
        );
        const m = reOp.exec(text);
        const idx = m?.index ?? -1;
        if (m && idx > firstTicker) {
          const pct = m.groups?.half ? 50 : m.groups?.pct ? Number(m.groups.pct) : 100;
          if (pct > 0 && pct <= 100) {
            giftTo = m.groups?.handle ?? op;
            giftBps = pct * 100;
            const end = idx + m[0].length;
            const before = text.slice(0, idx).replace(/[,;]\s*$/, "");
            const after = text.slice(end).replace(/^\s*[.!,]+/, "").trim();
            text = after && sepRel < 0 ? `${before} - ${after}` : `${before} ${after}`;
          }
        }
      }
    }
  }

  // Dev-buy plan: "lock 90d", "lock 6m", "lock 1y", "lock for 30 days", "lock dev buy 3 months", or plain "burn" /
  // "burn dev buy". Same placement rules as the gift clause: at the end, or before the description's dash, never
  // mid-sentence, so "we lock in gains" or "burn it all" inside prose stays prose. Bare "lock" = 30 days.
  let devPlan: "lock" | "burn" | null = null;
  let devLockSeconds: number | null = null;
  {
    const firstTicker = text.search(/\$[A-Za-z]/);
    if (firstTicker >= 0) {
      const afterTicker = text.slice(firstTicker);
      const sepRel = afterTicker.search(/\s[-–—:]\s|\n/);
      const descStart = sepRel < 0 ? text.length : firstTicker + sepRel;
      const re =
        /(?:^|\s)(?:(?<lock>lock)(?:\s+(?:the\s+)?dev\s*buy)?(?:\s+for)?(?:\s+(?<n>\d{1,3})\s*(?<u>d|days?|w|weeks?|m|mo|months?|y|yr|years?)\b)?|(?<burn>burn)(?:\s+(?:the\s+)?dev\s*buy)?)(?=\s*[.!,]?\s*$|\s+[-–—:]\s|\n)/gi;
      for (const m of text.matchAll(re)) {
        const idx = m.index ?? -1;
        if (idx <= firstTicker) continue;
        const end = idx + m[0].length;
        const trailing = /^\s*[.!,]?\s*$/.test(text.slice(end));
        if (!(trailing || idx < descStart)) continue;
        if (m.groups?.burn) devPlan = "burn";
        else if (m.groups?.lock) {
          devPlan = "lock";
          const n = m.groups.n ? Number(m.groups.n) : 30;
          const u = (m.groups.u ?? "d").toLowerCase();
          const day = 86_400;
          const secs = u.startsWith("w") ? n * 7 * day : u.startsWith("y") ? n * 365 * day : u.startsWith("m") ? n * 30 * day : n * day;
          // Sane bounds: an hour is meaningless, ten years is forever.
          devLockSeconds = Math.max(day, Math.min(10 * 365 * day, secs));
        }
        const before = text.slice(0, idx).replace(/[,;]\s*$/, "");
        const after = text.slice(end).replace(/^\s*[.!,]+/, "");
        text = `${before} ${after}`;
        break;
      }
    }
  }

  // Logo source clauses (like gift / lock): at the end or right before the description dash, never mid-prose.
  // "pfp" → OP's avatar. "ai" / "gen logo" → skip the avatar and generate (or use a Compose preview).
  // "upload" → use the Compose/extension file they already previewed. With neither, the engine still
  // prefers the OP's avatar over a random AI image when there's a narrative and no post photo.
  let logoFrom: "pfp" | "ai" | "upload" | null = null;
  {
    const firstTicker = text.search(/\$[A-Za-z]/);
    if (firstTicker >= 0) {
      const afterTicker = text.slice(firstTicker);
      const sepRel = afterTicker.search(/\s[-–—:]\s|\n/);
      const descStart = sepRel < 0 ? text.length : firstTicker + sepRel;
      const take = (re: RegExp, kind: "pfp" | "ai" | "upload") => {
        for (const m of text.matchAll(re)) {
          const idx = m.index ?? -1;
          if (idx <= firstTicker) continue;
          const end = idx + m[0].length;
          const trailing = /^\s*[.!,]?\s*$/.test(text.slice(end));
          if (!(trailing || idx < descStart)) continue;
          logoFrom = kind;
          const before = text.slice(0, idx).replace(/[,;]\s*$/, "");
          const after = text.slice(end).replace(/^\s*[.!,]+/, "");
          text = `${before} ${after}`;
          return true;
        }
        return false;
      };
      // pfp first so "use op's pfp" wins over a stray "ai" / "upload" elsewhere.
      take(/(?:^|\s)(?:use\s+)?(?:the\s+)?(?:op['’]?s?\s+)?(?:pfp|profile\s+pic(?:ture)?)(?=\s*[.!,]?\s*$|\s+[-–—:]\s|\n)/gi, "pfp") ||
        take(/(?:^|\s)(?:use\s+)?(?:ai|gen(?:erate)?(?:\s+logo)?)(?=\s*[.!,]?\s*$|\s+[-–—:]\s|\n)/gi, "ai") ||
        take(/(?:^|\s)upload(?=\s*[.!,]?\s*$|\s+[-–—:]\s|\n)/gi, "upload");
    }
  }

  let pair: string | null = null;
  // Natural-language pair: "pair with $META", "paired with MSTR", "pair: NVDA". Resolved here and removed from
  // the text so "pair with" never ends up as the coin's name. The $TICKER/PAIR form below still wins if present.
  const spokenPair = /\b(?:pair(?:ed)?(?:\s+(?:it\s+)?with|\s*:)|quoted\s+in)\s+\$?([A-Za-z][A-Za-z0-9.]{0,15})\b/i.exec(text);
  if (spokenPair?.[1]) {
    const p = findPair(spokenPair[1]);
    if (!p) return { ok: false, reason: "unknown_pair", pair: spokenPair[1].toUpperCase() };
    pair = p.cls === "native" ? null : p.symbol;
    text = text.slice(0, spokenPair.index) + " " + text.slice(spokenPair.index + spokenPair[0].length);
  }

  // First $TICKER, optionally with a quote asset as $TICKER/PAIR (trading-pair notation). At least one letter
  // in the ticker so "$100" is never a coin.
  const tickerRe = /\$([A-Za-z0-9]+)(?:\/([A-Za-z][A-Za-z0-9]{0,15}))?/g;
  let symbol: string | null = null;
  let tickerAsWritten = "";
  let tokenLength = 0;
  let tickerIndex = -1;
  let sawTooLong = false;
  let sawTooShort = false;
  // A post that name-drops several coins ("Hit $500K MCAP … $MFEED … $SHUFFLE") is a discussion, not a launch.
  const distinct = new Set<string>();
  for (const m of text.matchAll(tickerRe)) {
    const raw = (m[1] ?? "").toUpperCase();
    if (/[A-Za-z]/.test(raw) && !isAmount(raw)) distinct.add(raw);
  }
  if (distinct.size >= 3) return { ok: false, reason: "no_ticker" };

  for (const m of text.matchAll(tickerRe)) {
    const raw = m[1] ?? "";
    if (!/[A-Za-z]/.test(raw)) continue;
    // "$500K", "$1M", "$10B" are money, not coins.
    if (isAmount(raw)) continue;
    if (raw.length > RULES.tickerMax) {
      sawTooLong = true;
      continue;
    }
    if (raw.length < RULES.tickerMin) {
      sawTooShort = true;
      continue;
    }
    symbol = raw.toUpperCase();
    tickerAsWritten = raw;
    tokenLength = m[0].length - 1; // without the leading $
    tickerIndex = m.index ?? -1;
    if (m[2]) {
      const p = findPair(m[2]);
      if (!p) return { ok: false, reason: "unknown_pair", pair: m[2].toUpperCase() };
      pair = p.cls === "native" ? null : p.symbol;
    }
    break;
  }
  if (!symbol) {
    if (sawTooLong) return { ok: false, reason: "ticker_too_long" };
    if (sawTooShort) return { ok: false, reason: "ticker_too_short" };
    return { ok: false, reason: "no_ticker" };
  }

  // Split around the ticker on its own line; everything after that line is description material.
  const before = text.slice(0, tickerIndex);
  const after = text.slice(tickerIndex + tokenLength + 1);
  const lineStart = before.lastIndexOf("\n") + 1;
  const lineEndRel = after.indexOf("\n");
  const sameLineBefore = before.slice(lineStart);
  const sameLineAfter = lineEndRel === -1 ? after : after.slice(0, lineEndRel);
  const followingLines = lineEndRel === -1 ? "" : after.slice(lineEndRel + 1);

  let name = "";
  let description = "";

  const sep = SEPARATOR.exec(sameLineAfter);
  if (sep && sep.index > 0) {
    name = clean(sameLineAfter.slice(0, sep.index));
    description = clean(sameLineAfter.slice(sep.index + sep[0].length));
  } else if (sep && sep.index === 0) {
    // "$TICKER - description" with no name on the line.
    description = clean(sameLineAfter.slice(sep[0].length));
  } else {
    name = clean(sameLineAfter);
  }

  // "$APEPE and use this picture" → the after-part is an instruction, not a name. Drop it and look before.
  if (name && STARTS_AS_CONTINUATION.test(name)) name = "";
  name = stripInstructions(name);

  if (!name) {
    const b = stripInstructions(sameLineBefore.replace(/\$[A-Za-z0-9]+/g, " "));
    if (b && /[A-Za-z0-9]/.test(b)) name = b;
  }
  if (!name) name = tickerAsWritten;

  const rest = clean(followingLines);
  if (rest) description = description ? `${description}\n${rest}` : rest;
  // Instructions to the bot never belong in the description either ("…, use this image as logo").
  if (description) description = stripInstructions(description).replace(/\s+\n/g, "\n");

  // Never let a second ticker or a stray mention leak into the name; a name ends at a quote or a sentence.
  name = clean(name.replace(/\$[A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?/g, " ").replace(/(^|\s)@[A-Za-z0-9_.]+/g, " "));
  name = clean(name.split(/["“”]/)[0] ?? "");
  const sentence = /\.\s+[A-Z]/.exec(name);
  if (sentence && sentence.index > 0) name = clean(name.slice(0, sentence.index));
  if (!name) name = tickerAsWritten;
  // "$GWEALTH 👀🧡" — trailing emoji is decoration, not a name. No letter or digit anywhere → the ticker is the name.
  if (!/[\p{L}\p{N}]/u.test(name)) name = tickerAsWritten;
  if (name.length > RULES.nameMax) {
    // Too long for a name: cut at the last word boundary that fits and let the rest lead the description.
    const cut = name.slice(0, RULES.nameMax + 1);
    const at = cut.lastIndexOf(" ");
    const head = clean(at > RULES.nameMax / 2 ? cut.slice(0, at) : name.slice(0, RULES.nameMax));
    const tail = clean(name.slice(head.length));
    name = head || tickerAsWritten;
    if (tail) description = description ? `${tail} ${description}` : tail;
  }
  if (description.length > RULES.descriptionMax) description = `${description.slice(0, RULES.descriptionMax - 1).trim()}…`;

  const logo = opts.media?.find((m) => /^https?:\/\//i.test(m)) ?? null;
  return { ok: true, launch: { symbol, name, description, logo, logoFrom, links, pair, giftTo, giftBps, devPlan, devLockSeconds } };
}

// ------------------------------------------------------------------------------------------ tips

export type ParsedTip =
  | {
      ok: true;
      handle: string | null;
      amount: number;
      symbol: string;
      /** First 0x… contract address in the text, when the tipper pasted one to pin down which coin they mean. */
      tokenAddress?: string;
    }
  | { ok: false };

const TOKEN_ADDRESS_RE = /\b0x[0-9a-fA-F]{40}\b/;

/**
 * Amount: "5000", "5,000", "2.5k", "1M". Never a digit run inside a handle, a ticker, a URL or a decimal that
 * belongs to something else — so the character before must not be a word char, "@", "$", "." or ",".
 */
const TIP_AMOUNT_RE = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?([kKmM])?\b(?![.,]?\d)/;
const TIP_WORD_RE = /\btip\b/i;
/**
 * What may sit between "tip" and the amount: the recipient (@handle, Discord's <@id>) and/or a $TICKER, at most
 * two of them. Anything else — "tip test", "tip them tomorrow", "tip of the day" — means this is prose, not a
 * command, and no number later in the post is an amount.
 */
const TIP_LEAD_RE = /^[:,]?\s*(?:(?:<@!?\d+>|@[A-Za-z0-9_]{1,32}|\$[A-Za-z][A-Za-z0-9]*)\s+){0,2}/;

/** The amount right after the word "tip" (past an optional recipient / ticker); null when it isn't there. */
function tipAmountAfter(rest: string): number | null {
  const lead = TIP_LEAD_RE.exec(rest)?.[0] ?? "";
  const m = TIP_AMOUNT_RE.exec(rest.slice(lead.length).trimStart());
  if (!m) return null;
  const whole = m[1]!.replace(/,/g, "");
  let n = Number(m[2] ? `${whole}.${m[2]}` : whole);
  const suffix = (m[3] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  else if (suffix === "m") n *= 1_000_000;
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * The tip grammar: the word "tip" plus an amount, optionally a $TICKER (default LAUNCHPOST) and a recipient.
 *
 *     tip @someone 5000 $LAUNCHPOST
 *     tip @someone 5000
 *     tip 5000 $LAUNCHPOST @someone
 *     @someone tip 5k
 *     tip @someone 2.5k
 *     /tip @someone 1000 $LAUNCHPOST     (bot command form on Telegram / Discord; "/tip@botname" too)
 *
 * No @handle → `handle` is null and the caller decides (the author of the post being replied to). Only the
 * whole word "tip" counts — "tips", "tipping" and ordinary launch posts never match. The amount must follow the
 * word "tip" directly (past an optional @recipient / $ticker); a number elsewhere in the post is never an amount,
 * so a post *about* tipping ("first live tip test … 500,000 … @someone") is prose, not a command.
 *
 * Any coin launched on launchpost can be tipped: `$NEIL` names it by symbol; a pasted contract address
 * (`0x…`, reported as `tokenAddress`) pins down exactly which one when symbols collide.
 */
export function parseTip(rawText: string, opts: { botHandles: string[] }): ParsedTip {
  // "/tip …" and Telegram's group form "/tip@launchpostbot …" are the plain word.
  let text = stripBot(rawText.replace(/\r\n?/g, "\n").replace(/^\s*\/tip(?:@\w+)?\b/i, "tip"), opts.botHandles).replace(URL_RE, " ");
  const tokenAddress = TOKEN_ADDRESS_RE.exec(text)?.[0];
  // The address is never an amount or a handle; take it out before the rest of the grammar looks.
  if (tokenAddress) text = text.replace(new RegExp(TOKEN_ADDRESS_RE.source, "g"), " ");
  const tipAt = TIP_WORD_RE.exec(text);
  if (!tipAt) return { ok: false };
  const amount = tipAmountAfter(text.slice(tipAt.index + tipAt[0].length));
  if (amount === null) return { ok: false };
  const ticker = /\$([A-Za-z][A-Za-z0-9]*)\b/.exec(text);
  const symbol = ticker ? ticker[1]!.toUpperCase() : "LAUNCHPOST";
  // First mention that isn't us (bot handles are already stripped). Case as written; X handles are case-insensitive.
  // Up to 32 chars: X allows 15, Telegram 32, and Discord's "<@snowflake>" form is 17-20 digits.
  const mention = /(?:^|[^\w@])@([A-Za-z0-9_]{1,32})\b/.exec(text);
  return { ok: true, handle: mention ? mention[1]! : null, amount, symbol, ...(tokenAddress ? { tokenAddress } : {}) };
}

/**
 * Description used when the poster wrote none. For a narrative launch the post being replied to *is* the story,
 * so its own words become the description. Otherwise the coin's name — never a line about who posted where;
 * that's provenance, and it lives on the launchpost page, not on the token.
 */
export function defaultDescription(name: string, narrativeText?: string | null): string {
  const story = (narrativeText ?? "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/(^|\s)@[A-Za-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (story.split(" ").filter(Boolean).length >= 3) return story.length > RULES.descriptionMax ? `${story.slice(0, RULES.descriptionMax - 1).trim()}…` : story;
  return name.trim();
}
