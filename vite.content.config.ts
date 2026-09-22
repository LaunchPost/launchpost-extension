import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/** One classic script — MV3 content scripts cannot be ES modules. */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("./src/content.ts", import.meta.url)),
      name: "Launchpost",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: { extend: true, inlineDynamicImports: true },
    },
  },
});
