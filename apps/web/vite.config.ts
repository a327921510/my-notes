import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@my-notes/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@my-notes/local-db": path.resolve(__dirname, "../../packages/local-db/src/index.ts"),
    },
  },
  /** Web 端纯本地运行，无后端代理；Electron 桌面端直接加载构建产物。 */
  server: {
    port: 5173,
  },
});
