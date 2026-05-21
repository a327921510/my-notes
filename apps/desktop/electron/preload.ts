import { contextBridge } from "electron";

/**
 * 暴露最小桌面端能力到渲染进程。
 *
 * 当前为纯本地应用，先不开放文件系统 / 存储路径等 IPC；
 * 仅注入 `__MY_NOTES_DESKTOP__` 标识，便于前端在需要时区分桌面端环境。
 */
contextBridge.exposeInMainWorld("__MY_NOTES_DESKTOP__", {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
