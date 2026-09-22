import type { PlatformId } from "./types.ts";

/**
 * An identity is (platform, platform user id). On-chain it is keccak256("platform:userId") — see
 * IdentityRegistry.sol. Handles can be renamed; ids cannot, so ids are what vaults are bound to.
 */
export function identityString(platform: PlatformId, userId: string): string {
  return `${platform}:${userId}`;
}

/** Claim codes: LP-XXXXXX, 6 chars from an unambiguous alphabet (no 0/O/1/I). */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeClaimCode(random: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[(random[i] ?? 0) % ALPHABET.length];
  return `LP-${s}`;
}
