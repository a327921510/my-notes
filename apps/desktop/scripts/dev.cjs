#!/usr/bin/env node
/**
 * 同时启动 Vite 开发服务（来自 @my-notes/web）与 Electron 主进程。
 *
 * 1. 先后台拉起 `pnpm --filter @my-notes/web dev`；
 * 2. 等待端口 5173 可用；
 * 3. 编译主进程 TS（`tsc -p tsconfig.json`），再以 `electron .` 启动；
 * 4. 阻塞直到 Electron 退出，再清理 Vite。
 *
 * Windows 上勿对长期子进程使用 `shell: true`，否则父进程会过早退出并误杀 Vite。
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DESKTOP_DIR = path.resolve(__dirname, "..");
const DEV_URL = "http://127.0.0.1:5173";
const IS_WIN = process.platform === "win32";

/** Windows 下 .cmd 不能无 shell 直接 spawn；长期子进程用 cmd /c，避免 shell:true 导致父进程过早退出。 */
function runPnpm(args, options = {}) {
  const child = IS_WIN
    ? spawn("cmd.exe", ["/d", "/s", "/c", "pnpm", ...args], {
        stdio: "inherit",
        shell: false,
        ...options,
      })
    : spawn("pnpm", args, { stdio: "inherit", shell: false, ...options });
  child.on("error", (err) => {
    console.error("[dev] failed to start pnpm:", err);
    process.exit(1);
  });
  return child;
}

function runExecutable(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
  child.on("error", (err) => {
    console.error(`[dev] failed to start ${command}:`, err);
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

function resolveElectronExecutable() {
  const entry = require.resolve("electron", { paths: [DESKTOP_DIR, REPO_ROOT] });
  return require(entry);
}

function waitForExit(child, label) {
  return new Promise((resolve) => {
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

(async () => {
  const vite = runPnpm(["--filter", "@my-notes/web", "dev"], { cwd: REPO_ROOT });

  const cleanup = () => {
    if (vite && !vite.killed) vite.kill();
  };

  const interrupt = () => {
    cleanup();
    process.exit(0);
  };
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", interrupt);

  try {
    await waitForUrl(DEV_URL);
    await new Promise((r) => setTimeout(r, 300));
    if (vite.exitCode !== null) {
      console.error(
        "[dev] Vite 子进程已退出（常见：5173 被占用）。请结束占用端口的进程后重试，勿同时开多个 dev:desktop / pnpm dev。",
      );
      cleanup();
      process.exit(1);
    }
  } catch (err) {
    console.error(err);
    cleanup();
    process.exit(1);
  }

  vite.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`[dev] Vite 异常退出 (code=${code})，Electron 将无法热更新`);
    }
  });

  const tsc = runPnpm(["exec", "tsc", "-p", "tsconfig.json"], { cwd: DESKTOP_DIR });
  const tscCode = await waitForExit(tsc, "tsc");
  if (tscCode !== 0) {
    cleanup();
    process.exit(tscCode);
  }

  let electronBin;
  try {
    electronBin = resolveElectronExecutable();
  } catch {
    console.error("[dev] 未找到 electron，请在仓库根目录执行 pnpm install");
    cleanup();
    process.exit(1);
  }

  console.log(`[dev] Electron 加载 ${DEV_URL}`);
  console.log("[dev] 若窗口无热更新：请先托盘退出安装版 MyNotes，标题栏应显示「MyNotes [开发]」");
  const electronStartedAt = Date.now();
  const electron = runExecutable(electronBin, ["."], {
    cwd: DESKTOP_DIR,
    env: { ...process.env, MY_NOTES_DEV_URL: DEV_URL },
  });

  const electronCode = await waitForExit(electron, "electron");
  const electronRanMs = Date.now() - electronStartedAt;
  if (electronRanMs < 3000 && electronCode === 0) {
    console.error(
      "[dev] Electron 几秒内退出：多半仍有安装版 MyNotes 在运行，或 dev 主进程未编译。",
    );
    console.error("[dev] 1) 托盘退出 MyNotes.exe  2) 再执行 pnpm dev:desktop");
    console.error("[dev] Vite 保持运行，浏览器可继续；也可在 apps/desktop 另开终端: pnpm exec electron .");
    process.exit(1);
  }
  cleanup();
  process.exit(electronCode);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
