#!/usr/bin/env node
/**
 * 同时启动 Vite 开发服务（来自 @my-notes/web）与 Electron 主进程。
 *
 * 1. 先后台拉起 `pnpm --filter @my-notes/web dev`；
 * 2. 等待端口 5173 可用；
 * 3. 编译主进程 TS（`tsc -p tsconfig.json`），再以 `electron .` 启动。
 *
 * 退出主进程时一并清理 Vite 子进程，避免端口占用。
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DESKTOP_DIR = path.resolve(__dirname, "..");

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  child.on("error", (err) => {
    console.error(`[dev] ${command} failed:`, err);
    process.exit(1);
  });
  return child;
}

function waitForUrl(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        reject(new Error(`Vite dev server did not become ready: ${url}`));
        return;
      }
      const u = new URL(url);
      const lib = u.protocol === "https:" ? require("node:https") : require("node:http");
      const req = lib.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else setTimeout(attempt, 500);
      });
      req.on("error", () => setTimeout(attempt, 500));
    };
    attempt();
  });
}

(async () => {
  const vite = run("pnpm", ["--filter", "@my-notes/web", "dev"], { cwd: REPO_ROOT });

  const cleanup = () => {
    if (!vite.killed) vite.kill();
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  try {
    await waitForUrl("http://127.0.0.1:5173");
  } catch (err) {
    console.error(err);
    cleanup();
    process.exit(1);
  }

  const tsc = run("pnpm", ["exec", "tsc", "-p", "tsconfig.json"], { cwd: DESKTOP_DIR });
  await new Promise((resolve) => tsc.on("exit", resolve));

  const electron = run("pnpm", ["exec", "electron", "."], {
    cwd: DESKTOP_DIR,
    env: { ...process.env, MY_NOTES_DEV_URL: "http://127.0.0.1:5173" },
  });
  electron.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
})();
