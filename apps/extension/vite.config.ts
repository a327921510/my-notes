import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync } from "node:fs";

export default defineConfig({
  define: {
    "import.meta.env.VITE_API_BASE": JSON.stringify(process.env.VITE_API_BASE ?? "http://127.0.0.1:3001"),
  },
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
      "@my-notes/local-db": path.resolve(__dirname, "../../packages/local-db/src/index.ts"),
      "@my-notes/sync-client": path.resolve(__dirname, "../../packages/sync-client/src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
    emptyDirBeforeWrite: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "popup.html"),
        background: path.resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: ({ name }) => (name === "background" ? "background.js" : "popup.js"),
        assetFileNames: "[name][extname]",
      },
    },
  },
});
