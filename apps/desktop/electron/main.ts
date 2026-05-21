import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  shell,
  Tray,
  nativeImage,
} from "electron";

const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = process.env.MY_NOTES_DEV_URL || "http://127.0.0.1:5173";

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

function getIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, "..", "resources", "icon.png"),
    path.join(process.resourcesPath ?? "", "icon.png"),
  ];
  return candidates.find((p) => p && fs.existsSync(p));
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
    title: "MyNotes",
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

  void window.loadURL(getWebEntryUrl());

  return window;
}

function ensureTray(window: BrowserWindow): void {
  if (tray) return;
  const icon = getIconPath();
  const trayIcon = icon ? nativeImage.createFromPath(icon) : nativeImage.createEmpty();
  tray = new Tray(trayIcon);
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

function setupSingleInstance(): boolean {
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
    if (process.platform !== "darwin") app.quit();
  });
}

bootstrap();
