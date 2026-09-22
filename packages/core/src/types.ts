/** Every social platform a coin can be launched from. Adding one = one adapter file in the engine. */
export type PlatformId =
  | "x"
  | "telegram"
  | "discord"
  | "reddit"
  | "instagram"
  | "tiktok";

/**
 * How a platform gets posts to us.
 *  - auto:  the bot sees the post the moment it's made (mention poll / webhook / bot message).
 *  - paste: the platform gives us no mention feed until an app review passes; the creator posts,
 *           then pastes the post link on our site. Same launch, one extra step.
 *  - both:  auto once the platform approved us, paste as the always-on fallback.
 */
export type IntakeMode = "auto" | "paste" | "both";

export interface PlatformDef {
  id: PlatformId;
  label: string;
  /** Our account/bot users address on that platform, without the @. Placeholder until accounts exist. */
  handle: string;
  intake: IntakeMode;
  /** Short "how to post" line shown in the UI. */
  howTo: string;
  /** Regex a pasted post URL must match (paste flow). */
  postUrl: RegExp | null;
  /** Which claim method proves ownership of an identity on this platform. */
  verify: ("oauth" | "code")[];
  /** Brand colour for chips. */
  color: string;
  /** Shown as "coming soon" everywhere on the site, even if the adapter is configured. */
  soon?: boolean;
}

/**
 * The post a launch post was replying to. When someone replies "$X" under a post, that post is what the
 * coin is about: it becomes the coin's narrative link, its image the fallback logo. The replier is still
 * the creator; the narrative's author is credited, not paid.
 */
export interface Narrative {
  platform: PlatformId;
  url: string;
  /** Platform-native id of the parent's author, when known — a tip with no @handle goes to this account. */
  authorId?: string;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  text: string;
  image: string | null;
}

/** A post/message as normalised by a platform adapter, before parsing. */
export interface IncomingPost {
  /** Parent post for replies/quotes, when the platform exposes it. */
  narrative?: Narrative | null;
  /** Platform-native id of the post this replies to or quotes — set even when the parent is the author's own. */
  parentId?: string | null;
  platform: PlatformId;
  /** Platform-native post/message id; (platform, postId) is the dedupe key. */
  postId: string;
  url: string;
  authorId: string;
  authorHandle: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorFollowers: number | null;
  /** Unix ms the author's account was created, when the platform exposes it. */
  authorCreatedAt: number | null;
  text: string;
  /** Image URLs attached to the post, in order. First one becomes the logo. */
  media: string[];
  createdAt: number;
  /** Where we got it: mention poll, webhook, bot command, pasted link, or the site's own launch button (no real post behind it). */
  source: "poll" | "webhook" | "bot" | "paste" | "web";
  /** Nobody but the bot can see this post (Telegram DM, Discord DM). Stricter launch caps apply. */
  private?: boolean;
}

/** Links found in a post, sorted into the coin's social slots. */
export interface CoinLinks {
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
}

/** What the parser extracts from a post. */
export interface ParsedLaunch {
  symbol: string;
  name: string;
  description: string;
  /** First attached image, or null → the UI renders a monogram; nothing is invented. */
  logo: string | null;
  /**
   * Where the logo should come from when the post carries no image of its own.
   * "pfp" → narrative/OP avatar. "ai" → skip avatar and generate (or use Compose AI preview).
   * "upload" → use the Compose/extension file they already previewed.
   * Null → narrative image, else OP avatar, else link/AI/monogram (OP avatar is the silent default for imageless narrative launches).
   */
  logoFrom: "pfp" | "ai" | "upload" | null;
  /** Any URLs the poster included, classified. A website link prefills the coin's website. */
  links: CoinLinks;
  /** Quote asset written as $TICKER/PAIR (e.g. $HOOD/MSTR). Null = ETH. Always a known pair when ok. */
  pair: string | null;
  /**
   * "$NEIL Neil the Seal for @mcdonaldsboy_": the poster gives the creator fees to someone else, usually the
   * author of the post they're replying to. Handle as written, without "@". Null = fees to the poster.
   */
  giftTo: string | null;
  /**
   * Share of the creator fees going to `giftTo`, in bps. 10000 = the whole creator share (a gift); anything
   * less is a split, with the rest staying with the poster. Null when giftTo is null.
   */
  giftBps: number | null;
  /**
   * What to do with the dev buy, inside the launch transaction. "lock 90d" / "lock 6m" → "lock" with
   * `devLockSeconds`; "burn" → the dev buy goes straight to 0x…dEaD. Null = tokens to the poster's wallet.
   * Only meaningful when the poster has a dev buy configured; the engine tells them otherwise.
   */
  devPlan: "lock" | "burn" | null;
  devLockSeconds: number | null;
}

export type ParseFailure =
  | "no_ticker"
  | "bad_ticker"
  /** $TICKER longer than RULES.tickerMax. */
  | "ticker_too_long"
  /** $TICKER shorter than RULES.tickerMin. */
  | "ticker_too_short"
  | "is_claim_code"
  /** $TICKER/XYZ where XYZ isn't a supported pair. `pair` carries what they wrote. */
  | "unknown_pair";

export type ParseResult =
  | { ok: true; launch: ParsedLaunch }
  | { ok: false; reason: ParseFailure; claimCode?: string; pair?: string };

export type LaunchStatus = "queued" | "launching" | "launched" | "rejected" | "failed";

export interface Identity {
  platform: PlatformId;
  userId: string;
  handle: string;
  name: string | null;
  avatar: string | null;
  wallet: string | null;
  verifiedVia: "oauth" | "code" | null;
  verifiedAt: number | null;
}

export interface CoinSummary {
  token: string;
  curve: string;
  vault: string;
  symbol: string;
  name: string;
  description: string;
  logo: string | null;
  platform: PlatformId;
  /** Launched from the site's Radar Deploy button: launcher kept private, creator fields are placeholders. */
  anonymous?: boolean;
  /** Protocol Daily Pick off Radar (creator fees → burn pot). */
  dailyPick?: boolean;
  creatorHandle: string;
  creatorName: string | null;
  creatorAvatar: string | null;
  creatorUserId: string | null;
  /** Gifted launch: who posted it. The creator fields above are the fee recipient (usually the narrative's author). */
  launchedBy?: { handle: string; name: string | null; avatar: string | null } | null;
  /** Split vault: the second fee recipient and its share (bps of the creator share), with its own owed/paid figures. */
  split?: { handle: string; userId: string; bps: number; owedEth: number; paidEth: number; payoutWallet: string | null } | null;
  postUrl: string;
  postText: string | null;
  narrative: Narrative | null;
  links: CoinLinks;
  /** Quote asset the coin trades against. All *Eth fields below are in this asset's units when it isn't ETH. */
  pair: { symbol: string; address: string; decimals: number; cls: string };
  /** ETH the creator bought with in the launch transaction (pre-funded dev buy; ETH pairs only). */
  devBuyEth: number;
  /** What happened to that dev buy inside the launch tx: locked on HoodLock (until `devLockUntil`) or burned. Null = to the wallet. */
  devPlan?: "lock" | "burn" | null;
  devPlanTokens?: number | null;
  devLockId?: number | null;
  devLockUntil?: number | null;
  launchedAt: number;
  txHash: string;
  // Curve state (refreshed by the indexer)
  graduated: boolean;
  progress: number;
  priceEth: number;
  marketCapEth: number;
  realQuoteEth: number;
  thresholdEth: number;
  // Fees
  creatorTaxBps: number;
  creatorOwedEth: number;
  creatorPaidEth: number;
  protocolPaidEth: number;
  pendingOnCurveEth: number;
  pendingInEscrowEth: number;
  claimed: boolean;
  /** Wallet bound to the creator's identity (controls settings). */
  creatorWallet: string | null;
  /** Wallet this coin's creator share is paid to (per-coin override or the bound wallet). */
  payoutWallet: string | null;
  refreshedAt: number;
}
