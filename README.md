# launchpost — X extension

Open-source browser extension for [launchpost.fun](https://launchpost.fun). Deploy a coin from any post on X — we never post for you.

**Install (no Chrome Web Store):** [launchpost.fun/extension](https://launchpost.fun/extension)

## Load unpacked

1. Download the zip from the site, **or** build from this repo (`pnpm install && pnpm build` → use the `dist/` folder).
2. Open `chrome://extensions` (Brave / Edge: same idea).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder / `dist/` (must contain `manifest.json`).
4. Visit [launchpost.fun/connect](https://launchpost.fun/connect), sign in with X, then return to x.com.

Chrome will warn that the extension is unpacked. That’s expected without the Web Store.

## Build from source

```bash
pnpm install
pnpm build
# optional zip of dist/:
pnpm pack
```

Requires Node 20+ and pnpm 9.

## What’s in here

- `src/` — extension (content script on x.com, background, `/connect` bridge)
- `packages/core` — shared ticker/parse helpers (vendored from the private launchpost monorepo)

## Permissions

- `x.com` / `twitter.com` — inject the Deploy UI on posts
- `launchpost.fun` — session handoff and Deploy API

No wallet keys, no seed phrases, nothing posted on your behalf.

## License

Source is published so you can inspect and build it. The launchpost product and brand remain with StratsTeam.
