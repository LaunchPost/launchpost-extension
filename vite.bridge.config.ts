import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/** The launchpost.fun bridge — a second classic (IIFE) content script alongside content.js. */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/bridge.ts", import.meta.url)),
      name: "LaunchpostBridge",
      formats: ["iife"],
      fileName: () => "bridge.js",
    },
    rollupOptions: {
      output: { extend: true, inlineDynamicImports: true },
    },
  },
});
