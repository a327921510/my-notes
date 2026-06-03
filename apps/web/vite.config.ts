import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  /** Electron 打包后通过 file:// 加载；相对 base 才能让 JS/CSS 路径正确解析。 */
  base: mode === "desktop" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@my-notes/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
      "@my-notes/local-db": path.resolve(__dirname, "../../packages/local-db/src/index.ts"),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  /** Web 端纯本地运行，无后端代理；Electron 桌面端直接加载构建产物。 */
  server: {
    port: 5173,
    /** 与 Electron dev（`MY_NOTES_DEV_URL` / dev.cjs 健康检查）一致，避免 Windows 上仅监听 ::1。 */
    host: "127.0.0.1",
    strictPort: true,
    /** Electron 内嵌 Chromium 需显式指定 HMR WebSocket，否则热更新常失效。 */
    hmr: {
      host: "127.0.0.1",
      port: 5173,
      clientPort: 5173,
    },
  },
}));
