import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  shell,
  Tray,
  nativeImage,
} from "electron";

import { createPlaceholderTrayIcon } from "./trayPlaceholder";

const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = process.env.MY_NOTES_DEV_URL || "http://127.0.0.1:5173";

if (IS_DEV) {
  app.setName("MyNotes-Dev");
  app.setPath("userData", path.join(app.getPath("appData"), "MyNotes-Dev"));
}

/**
 * Resolve the bundled web `index.html`.
 *
 * - Dev (`app.isPackaged === false`): expect `pnpm --filter @my-notes/web dev`
 *   to be running on `DEV_SERVER_URL`.
 * - Prod: electron-builder copies `apps/web/dist/**` into
 *   `process.resourcesPath/web/` via the `extraResources` config.
 */
function getWebEntryUrl(): string {
  if (IS_DEV) return DEV_SERVER_URL;
  const indexPath = path.join(process.resourcesPath, "web", "index.html");
  return pathToFileURL(indexPath).toString();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, "..", "resources", "icon.png"),
    path.join(process.resourcesPath ?? "", "icon.png"),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

function getTrayIcon(): Electron.NativeImage {
  const iconPath = getIconPath();
  if (iconPath) {
    const image = nativeImage.createFromPath(iconPath);
    if (!image.isEmpty()) {
      if (process.platform === "win32") {
        return image.resize({ width: 16, height: 16 });
      }
      return image;
    }
  }
  return createPlaceholderTrayIcon();
}

function buildAppMenu(window: BrowserWindow): Menu {
  const isMac = process.platform === "darwin";
  const macHeader: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : [];

  return Menu.buildFromTemplate([
    ...macHeader,
    /**
     * macOS 上 Cmd+C / Cmd+V / Cmd+X 等剪贴板快捷键依赖 Edit 菜单的 role 绑定；
     * 缺少此项时，Markdown 编辑器等 textarea 内无法复制粘贴（非 Web 组件问题）。
     */
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac ? [{ role: "pasteAndMatchStyle" as const }] : []),
        { type: "separator" },
        { role: "selectAll" },
      ],
    },
    {
      label: "文件",
      submenu: [
        {
          label: "最小化",
          accelerator: "CommandOrControl+M",
          click: () => window.minimize(),
        },
        {
          label: "最大化 / 还原",
          accelerator: "CommandOrControl+Shift+M",
          click: () => {
            if (window.isMaximized()) window.unmaximize();
            else window.maximize();
          },
        },
        {
          label: "隐藏到托盘",
          accelerator: "CommandOrControl+H",
          click: () => window.hide(),
        },
        { type: "separator" },
        {
          label: "退出",
          accelerator: isMac ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", accelerator: "CommandOrControl+R" },
        { role: "forceReload", accelerator: "CommandOrControl+Shift+R" },
        { role: "toggleDevTools", accelerator: "F12" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen", accelerator: "F11" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "项目主页",
          click: () => {
            void shell.openExternal("https://github.com/a327921510/my-notes");
          },
        },
      ],
    },
  ]);
}

function createMainWindow(): BrowserWindow {
  const icon = getIconPath();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: IS_DEV ? "MyNotes [开发]" : "MyNotes",
    autoHideMenuBar: false,
    backgroundColor: "#f5f5f5",
    icon: icon ? nativeImage.createFromPath(icon) : undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(buildAppMenu(window));

  window.once("ready-to-show", () => {
    window.show();
    window.focus();
  });

  /** 安全：外链一律交给系统浏览器，避免 Electron 内嵌跳转。 */
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const entry = getWebEntryUrl();
    if (!url.startsWith(entry) && !url.startsWith(DEV_SERVER_URL)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  window.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    window.hide();
  });

  const entryUrl = getWebEntryUrl();
  if (IS_DEV) {
    console.info(`[MyNotes dev] 加载 ${entryUrl}`);
  }
  void window.loadURL(entryUrl);

  if (IS_DEV) {
    window.webContents.on("did-finish-load", () => {
      const loaded = window.webContents.getURL();
      window.setTitle(`MyNotes [开发] — ${loaded}`);
    });
  }

  return window;
}

function ensureTray(window: BrowserWindow): void {
  if (tray) return;
  tray = new Tray(getTrayIcon());
  tray.setToolTip("MyNotes");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "显示主窗口",
        click: () => {
          window.show();
          window.focus();
        },
      },
      {
        label: "隐藏主窗口",
        click: () => window.hide(),
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => {
    if (window.isVisible()) window.hide();
    else {
      window.show();
      window.focus();
    }
  });
}

function registerGlobalShortcuts(window: BrowserWindow): void {
  /** Ctrl+Shift+N 在全系统范围唤起主窗口；冲突时静默忽略。 */
  globalShortcut.register("CommandOrControl+Shift+N", () => {
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    window.focus();
  });
}

const WIN_DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const WIN_UNC_PATH = /^\\\\[^\\]+\\[^\\]+/;
const MAC_ABSOLUTE_PATH = /^(?:~(?:\/|$)|\/)/;

function expandHome(raw: string): string {
  if (raw.startsWith("~/") || raw === "~") {
    return path.join(os.homedir(), raw.slice(1));
  }
  return raw;
}

function isAllowedWindowsPath(raw: string): boolean {
  const p = raw.trim();
  if (!p || p.includes("\0")) return false;
  return WIN_DRIVE_PATH.test(p) || WIN_UNC_PATH.test(p);
}

function isAllowedMacPath(raw: string): boolean {
  const p = raw.trim();
  if (!p || p.includes("\0")) return false;
  return MAC_ABSOLUTE_PATH.test(p);
}

function isAllowedLocalPath(raw: string): boolean {
  if (process.platform === "win32") return isAllowedWindowsPath(raw);
  if (process.platform === "darwin") return isAllowedMacPath(raw);
  return isAllowedMacPath(raw);
}

function normalizeLocalPath(raw: string): string {
  const trimmed = raw.trim();
  const expanded = expandHome(trimmed);
  if (process.platform === "win32") {
    return path.normalize(expanded.replace(/\//g, "\\"));
  }
  return path.normalize(expanded.replace(/\\/g, "/"));
}

async function openLocalPath(rawPath: string): Promise<
  | { ok: true; openedParent?: true }
  | { ok: false; error: string }
> {
  const normalized = normalizeLocalPath(rawPath);
  if (fs.existsSync(normalized)) {
    const stat = fs.statSync(normalized);
    if (stat.isFile()) {
      shell.showItemInFolder(normalized);
      return { ok: true };
    }
    const err = await shell.openPath(normalized);
    if (err) return { ok: false, error: err };
    return { ok: true };
  }
  const parent = path.dirname(normalized);
  if (fs.existsSync(parent)) {
    const err = await shell.openPath(parent);
    if (err) return { ok: false, error: err };
    return { ok: true, openedParent: true };
  }
  return { ok: false, error: "路径不存在" };
}

function registerDesktopIpc(): void {
  ipcMain.handle("desktop:open-path-in-explorer", async (_event, rawPath: unknown) => {
    if (typeof rawPath !== "string" || !isAllowedLocalPath(rawPath)) {
      return { ok: false as const, error: "路径无效" };
    }
    try {
      return await openLocalPath(rawPath);
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "无法打开路径",
      };
    }
  });
}

function setupSingleInstance(): boolean {
  /** 开发态不与安装版 MyNotes 抢单实例锁，否则 dev 进程会秒退、窗口仍是旧安装包。 */
  if (IS_DEV) return true;

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
  return true;
}

function bootstrap(): void {
  if (!setupSingleInstance()) return;

  void app.whenReady().then(() => {
    registerDesktopIpc();
    mainWindow = createMainWindow();
    ensureTray(mainWindow);
    registerGlobalShortcuts(mainWindow);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
        ensureTray(mainWindow);
        registerGlobalShortcuts(mainWindow);
      } else {
        mainWindow?.show();
      }
    });
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", () => {
    // 隐藏到托盘时窗口仍存在，不在此退出；仅显式「退出」或 macOS dock 行为才结束进程
    if (process.platform === "darwin" && !isQuitting) return;
    if (!isQuitting) return;
    app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });
}

bootstrap();
