import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/** Background (ES module service worker) + welcome page. Content script is a separate IIFE build. */
export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: fileURLToPath(new URL("./src/background.ts", import.meta.url)),
        welcome: fileURLToPath(new URL("./welcome.html", import.meta.url)),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
