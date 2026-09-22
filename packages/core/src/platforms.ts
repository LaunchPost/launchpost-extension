import type { PlatformDef, PlatformId } from "./types.ts";

/** The bot's handle. Same on every platform (X, Reddit, Telegram: @launchpostbot); change here if one differs. */
export const BOT_HANDLE = "launchpostbot";

export const PLATFORMS: Record<PlatformId, PlatformDef> = {
  x: {
    id: "x",
    label: "X",
    handle: BOT_HANDLE,
    intake: "auto",
    howTo: `Post or reply mentioning @${BOT_HANDLE} with $TICKER. Add a name, a dash and a description if you like. Attach an image for the logo.`,
    postUrl: /^https?:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]+\/status\/(\d+)/i,
    verify: ["oauth", "code"],
    color: "#e7e9ea",
  },
  telegram: {
    id: "telegram",
    label: "Telegram",
    handle: BOT_HANDLE,
    intake: "auto",
    howTo: `Message @${BOT_HANDLE} — just $TICKER is enough in a DM. In a group, mention @${BOT_HANDLE} or use /launch. Send the image in the same message.`,
    postUrl: /^https?:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)/i,
    verify: ["oauth", "code"],
    color: "#2AABEE",
  },
  discord: {
    id: "discord",
    label: "Discord",
    handle: BOT_HANDLE,
    intake: "auto",
    howTo: `In any server with the bot, type /launch and put $TICKER Name - description in the text field. Add the image in the image field for the logo.`,
    postUrl: /^https?:\/\/(www\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/i,
    verify: ["oauth", "code"],
    color: "#5865F2",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    handle: BOT_HANDLE,
    intake: "auto",
    howTo: `Post or comment mentioning u/${BOT_HANDLE} with $TICKER. Image posts become the logo.`,
    postUrl: /^https?:\/\/(www\.|old\.)?reddit\.com\/r\/[A-Za-z0-9_]+\/comments\/([a-z0-9]+)/i,
    verify: ["oauth", "code"],
    color: "#FF4500",
    // Adapter exists; Reddit hasn't approved the app yet. Flip when it does.
    soon: true,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    handle: BOT_HANDLE,
    intake: "both",
    howTo: `Post tagging @${BOT_HANDLE} in the caption with $TICKER, then paste the post link here. The post image is the logo.`,
    postUrl: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/([A-Za-z0-9_-]+)/i,
    verify: ["oauth", "code"],
    color: "#E1306C",
    soon: true,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    handle: BOT_HANDLE,
    intake: "both",
    howTo: `Put #${BOT_HANDLE} and $TICKER in the caption of a video or photo (web uploader: title and description, put it in both). We pick it up once TikTok indexes it, or paste the post link here for instant. The cover is the logo.`,
    postUrl: /^https?:\/\/((www|vm|vt)\.)?tiktok\.com\/(@[A-Za-z0-9_.]+\/(?:video|photo)\/(\d+)|t\/[A-Za-z0-9]+|[A-Za-z0-9]+\/?$)/i,
    // Code only until TikTok approves Login Kit; the paste-link path needs no approval at all (public oEmbed).
    verify: ["code"],
    color: "#69C9D0",
  },
};

export const PLATFORM_LIST: PlatformDef[] = Object.values(PLATFORMS);
/** Platforms the site presents as usable (everything not flagged `soon`). */
export const LIVE_PLATFORMS: PlatformDef[] = PLATFORM_LIST.filter((p) => !p.soon);

/**
 * Platforms shown as "soon" on the site with no adapter at all. (Reddit is `soon` too, but stays in
 * PLATFORMS because its adapter exists.) These two are display-only.
 */
export type SoonPlatformId = "bluesky" | "farcaster";
export interface SoonPlatform {
  id: SoonPlatformId;
  label: string;
  handle: string;
  howTo: string;
  color: string;
}
export const COMING_SOON: SoonPlatform[] = [
  {
    id: "bluesky",
    label: "Bluesky",
    handle: `${BOT_HANDLE}.bsky.social`,
    howTo: `Post or reply mentioning @${BOT_HANDLE}.bsky.social with $TICKER.`,
    color: "#0285FF",
  },
  {
    id: "farcaster",
    label: "Farcaster",
    handle: BOT_HANDLE,
    howTo: `Cast or reply mentioning @${BOT_HANDLE} with $TICKER.`,
    color: "#855DCD",
  },
];

export function isPlatformId(v: string): v is PlatformId {
  return v in PLATFORMS;
}

/** Guess the platform from a pasted URL. */
export function platformForUrl(url: string): PlatformDef | null {
  for (const p of PLATFORM_LIST) if (p.postUrl && p.postUrl.test(url.trim())) return p;
  return null;
}
