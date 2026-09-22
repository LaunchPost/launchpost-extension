/**
 * Fee model. These mirror the constants baked into CreatorVault.sol; change both or neither.
 *
 *  - Every trade on the curve (and the graduated pool) pays a creator tax of CREATOR_TAX_BPS on top of
 *    the launchpad's base fee. Pons credits that tax to the coin's fee recipient — our CreatorVault.
 *  - The vault splits everything it collects: CREATOR_SHARE_BPS to the creator, the rest to the protocol.
 */
export const CREATOR_TAX_BPS = 200; // 2%
export const CREATOR_SHARE_BPS = 7000; // 70% creator
export const PROTOCOL_SHARE_BPS = 10_000 - CREATOR_SHARE_BPS; // 30% protocol

/** Pons v2 on Robinhood Chain. */
export const PONS = {
  chainId: 4663,
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  feeEscrow: "0xd3afeb2a57f70ef218aa82451c51b2fb0416ac9e",
  /** Launch fee the factory charges per launch (wei). Read live via launch-meta; this is the current value. */
  launchFeeWei: 500_000_000_000_000n, // 0.0005 ETH
  /** Default launch config: 4.2 ETH graduation threshold, ETH pair. */
  launchConfigId: 0n,
  graduationThresholdEth: 4.2,
  /** pons' live frontend (pons.family does not resolve as of Sep 2026). */
  site: (token: string) => `https://www.ponsfamily.com/launchpad/${token}`,
} as const;

/** Whole $LAUNCHPOST a claimed wallet must hold for the holder tier (launch limits) and the tipping allowance. */
const HOLDER_MIN_TOKENS = 1_000_000;

/** Anti-abuse rules applied before anything is launched. */
export const RULES = {
  /** 0 = disabled. Switched off 17 Sep 2026 for testing (brand-new bot accounts); was 30. */
  minAccountAgeDays: 0 as number,
  /**
   * Every launch costs the launcher wallet ~0.0008 ETH (pons fee + gas), so one account hammering the bot
   * drains it. One launch per account per cooldown window; 0 = disabled.
   */
  launchCooldownMinutes: 10 as number,
  /**
   * Hard daily ceiling per account on top of the cooldown. 0 = unlimited. Owner's call (18 Sep, 23:35): 10 — enough
   * for anyone with real ideas, a wall for serial zero-volume launchers; the holder tier is the fast lane.
   */
  maxLaunchesPerIdentityPerDay: 10 as number,
  /**
   * Holder tier: a poster whose claimed wallet holds at least `minTokens` $LAUNCHPOST (whole tokens) gets
   * the relaxed limits below. The token is the key to the product — that's the flywheel.
   */
  holderTier: { minTokens: HOLDER_MIN_TOKENS, cooldownMinutes: 1, maxPerDay: 50 },
  /**
   * Holder tipping allowance: an account whose claimed wallet holds ≥ `minTokens` $LAUNCHPOST can tip up to
   * `perDay` $LAUNCHPOST a day (UTC) out of the protocol tip pool (identity `protocol:pool`) instead of its own
   * pot. Anything over the allowance comes from the sender's own balance. 0 = off.
   */
  tipAllowance: { perDay: 10_000, minTokens: HOLDER_MIN_TOKENS },
  /**
   * Welcome tip: the first time an identity is verified (code or sign-in) it gets `amount` $LAUNCHPOST from the
   * protocol tip pool, at most `maxPerDay` identities a day (UTC). X accounts must pass `freshAccount` first.
   * Runtime kill switch: env WELCOME_TIP="false".
   */
  welcomeTip: { amount: 1_000, maxPerDay: 200, enabled: true as boolean },
  /**
   * Global circuit breaker. Above this many launches in the trailing hour, non-holders are turned away
   * until it cools. Bounds what a sybil swarm can burn from the launcher wallet. 0 = off.
   */
  globalMaxLaunchesPerHour: 60 as number,
  /**
   * Fresh-account gate, platforms that expose age/followers (X). An account younger than `minAgeDays`
   * AND with fewer than `minFollowers` followers can't launch unless it's holder tier.
   */
  // TEMP (screen record 22 Sep): was { minAgeDays: 3, minFollowers: 5 }. Restore after recording.
  freshAccount: { minAgeDays: 0, minFollowers: 0 },
  /** Ops alert when launches in the trailing 10 minutes exceed this. */
  surgeAlertPer10Min: 30 as number,
  /**
   * Proof of demand (owner, 21 Sep): the daily cap is earned, not handed out per account. A non-holder whose last
   * `lookback` coins (each at least `minAgeHours` old) all sit at zero curve progress drops to `reducedPerDay`
   * until one of their coins trades. Real launchers never notice; serial zero-volume launchers hit the wall, and a
   * second account starts with no record and hits the same wall. 0 = off.
   */
  proofOfDemand: { lookback: 5, minAgeHours: 24, reducedPerDay: 4 },
  /**
   * Private chats (Telegram DM, Discord DM) are launches nobody can see: no group, no post, no audience — the cheapest
   * spam surface. Non-holders get this cap there instead of the normal daily one. 0 = off.
   */
  privateChatMaxPerDay: 3 as number,
  tickerMin: 2,
  tickerMax: 10,
  nameMax: 32,
  descriptionMax: 280,
} as const;
