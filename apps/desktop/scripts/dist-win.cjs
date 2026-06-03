#!/usr/bin/env node
/**
 * Windows 安装包：先 build，再 electron-builder。
 * 默认经 npmmirror 拉取 Electron 运行时，避免 GitHub 超时。
 */
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

require("./electron-mirror-env.cjs");

const DESKTOP_DIR = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(DESKTOP_DIR, "release");
const WIN_UNPACKED = path.join(RELEASE_DIR, "win-unpacked");

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
  spawnSync(
    "powershell",
    ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`],
    { stdio: "ignore", shell: true },
  );
}

/** 结束可能占用 release 目录的 MyNotes / 从 release 启动的 electron。 */
function stopProcessesInRelease() {
  if (process.platform !== "win32") return;

  spawnSync("taskkill", ["/IM", "MyNotes.exe", "/F"], {
    stdio: "ignore",
    shell: true,
  });

  const releaseEscaped = RELEASE_DIR.replace(/'/g, "''");
  const ps = `
    $release = '${releaseEscaped}'
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.ExecutablePath -and (
          $_.ExecutablePath.StartsWith($release, [System.StringComparison]::OrdinalIgnoreCase) -or
          $_.Name -eq 'MyNotes.exe'
        )
      } |
      ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
      }
  `;
  spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { stdio: "ignore", shell: true },
  );
}

/** 尝试删除 win-unpacked；失败则返回 false（不阻断打包，改走新输出目录）。 */
function tryRemoveWinUnpacked() {
  if (!fs.existsSync(WIN_UNPACKED)) return true;

  for (let attempt = 1; attempt <= 5; attempt++) {
    stopProcessesInRelease();
    sleepMs(500);
    try {
      fs.rmSync(WIN_UNPACKED, { recursive: true, force: true });
      return true;
    } catch {
      // 继续重试
    }
  }
  return false;
}

/**
 * 若 release/win-unpacked 被占用无法删除，改用带时间戳的输出目录，
 * 避免 electron-builder 清理旧目录时失败。
 */
function resolveBuilderOutputDir() {
  if (tryRemoveWinUnpacked()) {
    return "release";
  }

  const staleDir = path.join(
    RELEASE_DIR,
    `win-unpacked.locked-${Date.now()}`,
  );
  try {
    fs.renameSync(WIN_UNPACKED, staleDir);
    console.warn(
      `\n[dist:win] 已将占用的 win-unpacked 重命名为 ${path.basename(staleDir)}，继续写入 release/。\n`,
    );
    return "release";
  } catch {
    const fallback = `release-build-${Date.now()}`;
    console.warn(
      `\n[dist:win] release\\win-unpacked 仍被其它程序占用（托盘 MyNotes、资源管理器窗口、杀毒扫描等）。`,
    );
    console.warn(
      `[dist:win] 本次安装包将输出到 apps/desktop/${fallback}/ ，完成后可手动删除 release 下旧目录。\n`,
    );
    return fallback;
  }
}

run("pnpm", ["run", "build"]);
stopProcessesInRelease();

const outputDir = resolveBuilderOutputDir();
const builderArgs = [
  "exec",
  "electron-builder",
  "--win",
  "nsis",
  "portable",
  "--x64",
  `-c.directories.output=${outputDir}`,
];

run("pnpm", builderArgs);
