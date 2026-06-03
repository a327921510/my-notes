import { contextBridge, ipcRenderer } from "electron";

export type OpenPathInExplorerResult =
  | { ok: true; openedParent?: boolean }
  | { ok: false; error: string };

/**
 * 暴露最小桌面端能力到渲染进程。
 */
contextBridge.exposeInMainWorld("__MY_NOTES_DESKTOP__", {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  openPathInExplorer: (targetPath: string): Promise<OpenPathInExplorerResult> =>
    ipcRenderer.invoke("desktop:open-path-in-explorer", targetPath),
});
