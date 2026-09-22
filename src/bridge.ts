/**
 * Content script on launchpost.fun. Bridges the site's /connect page (which holds the Privy session) to the
 * extension background: the page posts its access token to its own origin, we relay it to the background so the
 * X button can Deploy. The token is read only here, in the site's origin — no page on any other site can see it.
 */
interface ConnectMsg {
  source?: string;
  type?: string;
  token?: string;
  handle?: string | null;
  platform?: string | null;
}

window.addEventListener("message", (e: MessageEvent) => {
  if (e.source !== window) return;
  const d = e.data as ConnectMsg | null;
  if (!d || d.source !== "launchpost-connect") return;
  if (d.type === "token" && typeof d.token === "string") {
    chrome.runtime?.sendMessage({ type: "lp-token", token: d.token, handle: d.handle ?? null, platform: d.platform ?? null });
  } else if (d.type === "signout") {
    chrome.runtime?.sendMessage({ type: "lp-signout" });
  } else if (d.type === "hello") {
    // The page (re)mounted and is asking whether the extension is here.
    window.postMessage({ source: "launchpost-ext", type: "present" }, window.location.origin);
  }
});

// Announce presence so /connect can confirm the extension is installed and hand its session over.
window.postMessage({ source: "launchpost-ext", type: "present" }, window.location.origin);
