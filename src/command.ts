import { PAIRS, RULES, parsePost, type ParseResult } from "@launchpost/core";

export const BOT_HANDLES = ["launchpost", "launchpostbot"];
export { PAIRS, parsePost };
export type { ParseResult };

export type DevPlan = "none" | "lock" | "burn";
export type LockDur = "30d" | "90d" | "6m" | "1y";

const STOP = new Set(["this", "is", "the", "a", "an", "we", "shall", "will", "into", "being", "of", "to", "and", "in", "on", "for", "it", "its", "that", "with", "as", "at", "by", "be", "are", "was", "our", "your", "you", "i", "my", "me", "so", "just", "has", "have", "from", "dont", "what", "when", "why", "how", "who", "here", "there", "they", "them", "their", "he", "she", "his", "her", "not", "no", "yes", "all", "any", "some", "if", "but", "or", "than", "then", "now", "new", "one", "two", "can", "could", "would", "should", "do", "does", "did", "get", "got", "like", "about", "over", "under", "after", "before", "more", "most", "very", "much", "many", "lol", "lmao", "wow", "ok", "okay", "im", "ive", "youre", "were", "thats", "whats", "gm", "gn"]);

export interface Suggestion {
  /** Empty when the post gives no real signal — the user picks. */
  ticker: string;
  /** Empty unless a proper noun was found; the bot names the coin after the ticker otherwise. */
  name: string;
  /** Always empty: the post is the story. Kept so callers can override. */
  description: string;
  /** Where the ticker came from. */
  from: "cashtag" | "noun" | "author" | "none";
}

/**
 * Only suggest when the post hands us something: a $TAG, a proper noun (Seranox, Cybertruck, WOJAK), or a
 * $TAG in the author's display name. "Longest word" guesses (WATCHLIST, FUTURE) are worse than a blank field.
 */
export function suggestFromPost(text: string, handle: string, authorName = ""): Suggestion {
  const clean = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/@\w+/g, " ")
    .replace(/#\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  void handle;

  const tag = (s: string) => s.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/)?.[1]?.toUpperCase() ?? "";
  const inText = tag(text);
  if (inText) return { ticker: inText, name: "", description: "", from: "cashtag" };

  // Proper-noun phrases: runs of capitalised words ("Heavy Cav", "Supreme Intelligence", "Neil the Seal"). A phrase
  // counts when it has 2+ words, an ALL-CAPS word, or a capitalised word that doesn't open its sentence. A lone
  // capitalised sentence-opener ("Waiting big coming", "Perps are…") is just grammar and never counts.
  const CONNECT = new Set(["the", "of", "and", "&", "de", "da", "del", "von", "van"]);
  const tokens = clean.split(/\s+/);
  type Phrase = { words: string[]; strong: boolean; first: number };
  const phrases: Phrase[] = [];
  let cur: Phrase | null = null;
  let pendingConnector: string | null = null;
  let sentenceStart = true;
  const flush = () => {
    if (cur && cur.words.length) phrases.push(cur);
    cur = null;
    pendingConnector = null;
  };
  tokens.forEach((raw, i) => {
    const w = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
    const endsSentence = /[.!?:;]$/.test(raw) || /\n/.test(raw);
    const wordOk = !!w && /^[A-Za-z][A-Za-z0-9]*$/.test(w);
    const caps = wordOk && w === w.toUpperCase() && w.length >= 3;
    const cap = wordOk && /^[A-Z]/.test(w) && !STOP.has(w.toLowerCase());
    if (cap || caps) {
      if (cur && pendingConnector) cur.words.push(pendingConnector);
      pendingConnector = null;
      if (!cur) cur = { words: [], strong: false, first: i };
      cur.words.push(w);
      if (caps || !sentenceStart) cur.strong = true;
    } else if (cur && wordOk && CONNECT.has(w.toLowerCase()) && !pendingConnector) {
      pendingConnector = w; // kept only if another capitalised word follows
    } else {
      flush();
    }
    if (endsSentence) flush();
    sentenceStart = endsSentence || (sentenceStart && !wordOk);
  });
  flush();

  const key = (p: Phrase) => p.words.join(" ").toUpperCase();
  const counts = new Map<string, number>();
  for (const p of phrases) counts.set(key(p), (counts.get(key(p)) ?? 0) + 1);
  const scored = phrases.map((p) => ({ p, n: (p.words.length >= 2 || p.strong ? 2 : 1) + (counts.get(key(p)) ?? 1) - 1 }));
  const best = scored.sort((a, b) => b.n - a.n || a.p.first - b.p.first)[0];
  if (best && best.n >= 2) {
    const words = best.p.words.filter((x) => !CONNECT.has(x.toLowerCase())).map((x) => x.replace(/[^A-Za-z0-9]/g, ""));
    const joined = words.join("");
    const fits = (s: string) => s.length >= RULES.tickerMin && s.length <= RULES.tickerMax;
    const pick = fits(joined) ? joined : fits(words[0] ?? "") ? words[0]! : (words.filter(fits).sort((a, b) => b.length - a.length)[0] ?? "");
    if (pick) return { ticker: pick.toUpperCase(), name: best.p.words.join(" ").slice(0, RULES.nameMax), description: "", from: "noun" };
  }

  const inAuthor = tag(authorName);
  if (inAuthor) return { ticker: inAuthor, name: "", description: "", from: "author" };

  return { ticker: "", name: "", description: "", from: "none" };
}

/** Body after @launchpostbot — ticker, name, pfp, lock/burn, gift, then description. */
export function buildBody(opts: {
  ticker: string;
  pairSymbol: string;
  name: string;
  description: string;
  devPlan: DevPlan;
  lockDur: LockDur;
  giftOn: boolean;
  giftPct: number;
  giftHandle: string;
  /** Post has no image and the user chose the OP's profile picture as the logo → append the `pfp` token. */
  pfp?: boolean;
  /** Post has no image and the user chose AI generation → append `ai` (skips the OP-avatar default). */
  ai?: boolean;
  /** Post has no image and the user uploaded a preview in Compose/extension → append `upload`. */
  upload?: boolean;
}): string {
  const sym = opts.ticker.trim().replace(/^\$/, "").toUpperCase();
  if (!sym) return "";
  const tickerText = opts.pairSymbol === "ETH" || !opts.pairSymbol ? `$${sym}` : `$${sym}/${opts.pairSymbol}`;
  let s = tickerText;
  const name = opts.name.trim();
  if (name) s += ` ${name}`;
  if (opts.pfp) s += " pfp";
  else if (opts.ai) s += " ai";
  else if (opts.upload) s += " upload";
  if (opts.devPlan === "burn") s += " burn";
  else if (opts.devPlan === "lock") s += ` lock ${opts.lockDur}`;
  if (opts.giftOn) {
    const handle = opts.giftHandle.replace(/^@/, "") || "op";
    const pct = Math.min(100, Math.max(1, Math.round(opts.giftPct)));
    s += pct >= 100 ? ` for @${handle}` : ` ${pct}% to @${handle}`;
  }
  const desc = opts.description.trim();
  if (desc) s += ` - ${desc}`;
  return s.trim();
}

export function commandText(body: string): string {
  return body ? `@launchpostbot ${body}` : "";
}
