import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-manifest",
      closeBundle() {
        const out = path.resolve(__dirname, "dist");
        mkdirSync(out, { recursive: true });
        copyFileSync(
          path.resolve(__dirname, "public/manifest.json"),
          path.resolve(out, "manifest.json"),
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@my-notes/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: path.resolve(__dirname, "popup.html"),
      output: {
        entryFileNames: "popup.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
