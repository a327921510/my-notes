#!/usr/bin/env node
/**
 * macOS 安装包：先 build，再 electron-builder 产出 .dmg。
 * 默认经 npmmirror 拉取 Electron 运行时，避免 GitHub 超时。
 */
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

require("./electron-mirror-env.cjs");

const DESKTOP_DIR = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(DESKTOP_DIR, "release");
const MAC_UNPACKED = path.join(RELEASE_DIR, "mac");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: DESKTOP_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function sleepMs(ms) {
  spawnSync("sleep", [String(Math.ceil(ms / 1000))], { stdio: "ignore" });
}

/** 结束可能占用 release 目录的 MyNotes 进程。 */
function stopProcessesInRelease() {
  if (process.platform !== "darwin") return;

  spawnSync("pkill", ["-x", "MyNotes"], { stdio: "ignore" });
  spawnSync("pkill", ["-f", `${RELEASE_DIR}/`], { stdio: "ignore" });
}

/** 尝试删除 mac-unpacked；失败则返回 false（不阻断打包，改走新输出目录）。 */
function tryRemoveMacUnpacked() {
  if (!fs.existsSync(MAC_UNPACKED)) return true;

  for (let attempt = 1; attempt <= 5; attempt++) {
    stopProcessesInRelease();
    sleepMs(500);
    try {
      fs.rmSync(MAC_UNPACKED, { recursive: true, force: true });
      return true;
    } catch {
      // 继续重试
    }
  }
  return false;
}

/**
 * 若 release/mac 被占用无法删除，改用带时间戳的输出目录，
 * 避免 electron-builder 清理旧目录时失败。
 */
function resolveBuilderOutputDir() {
  if (tryRemoveMacUnpacked()) {
    return "release";
  }

  const staleDir = path.join(RELEASE_DIR, `mac.locked-${Date.now()}`);
  try {
    fs.renameSync(MAC_UNPACKED, staleDir);
    console.warn(
      `\n[dist:mac] 已将占用的 mac 重命名为 ${path.basename(staleDir)}，继续写入 release/。\n`,
    );
    return "release";
  } catch {
    const fallback = `release-build-${Date.now()}`;
    console.warn(
      `\n[dist:mac] release/mac 仍被其它程序占用（运行中的 MyNotes、Finder 窗口等）。`,
    );
    console.warn(
      `[dist:mac] 本次安装包将输出到 apps/desktop/${fallback}/ ，完成后可手动删除 release 下旧目录。\n`,
    );
    return fallback;
  }
}

if (process.platform !== "darwin") {
  console.error("[dist:mac] macOS 安装包必须在 macOS 主机上执行。");
  process.exit(1);
}

run("pnpm", ["run", "build"]);
stopProcessesInRelease();

const outputDir = resolveBuilderOutputDir();
const builderArgs = [
  "exec",
  "electron-builder",
  "--mac",
  "dmg",
  `-c.directories.output=${outputDir}`,
];

run("pnpm", builderArgs);
