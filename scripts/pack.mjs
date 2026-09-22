/**
 * Zip `dist/` for sideload installs. Output: `launchpost-extension.zip` in the repo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const dist = join(root, "dist");
const zipPath = join(root, "launchpost-extension.zip");

if (!existsSync(join(dist, "manifest.json"))) {
  console.error("pack: dist/manifest.json missing — run pnpm build first");
  process.exit(1);
}

rmSync(zipPath, { force: true });

if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Compress-Archive -Path '${dist}\\*' -DestinationPath '${zipPath}' -Force`],
    { stdio: "inherit" },
  );
} else {
  execFileSync("zip", ["-r", "-q", zipPath, "."], { cwd: dist, stdio: "inherit" });
}

console.log(`pack: ${zipPath}`);
