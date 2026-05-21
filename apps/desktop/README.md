# @my-notes/desktop

基于 [Electron](https://www.electronjs.org/) 的桌面端壳，复用 `@my-notes/web` 构建产物，目标平台以 **Windows (.exe)** 为主，同时兼容 macOS / Linux 调试。

## 目录结构

```
apps/desktop/
├── electron/             # 主进程与 preload（TypeScript）
│   ├── main.ts
│   └── preload.ts
├── resources/            # 打包资源：icon.png/icon.ico 等（可选）
├── scripts/
│   └── dev.cjs           # 开发模式：并行启动 Web Vite + Electron
├── tsconfig.json
└── package.json
```

## 常用脚本（在 `apps/desktop` 目录执行）

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动 `@my-notes/web` Vite 开发服与 Electron 主窗口（自动等待 `http://127.0.0.1:5173`） |
| `pnpm build` | 先构建 Web 产物，再编译主进程 TS 到 `dist/` |
| `pnpm dist:win` | 一键产出 Windows `.exe`（NSIS 安装包 + Portable）到 `release/` |
| `pnpm dist:linux` | 产出 Linux AppImage（用于本地 / 容器内验证） |

> 注意：Windows 端 `.exe` 必须在 **Windows 主机** 或具备 `wine` 的 CI 环境上执行 `pnpm dist:win`；本仓库的 cloud agent / Linux 容器仅用于编译主进程脚本，最终安装包请在 Windows 机器上打包。

## 已实现的桌面端能力

- **单实例锁**：再次启动会激活已有窗口。
- **窗口控制快捷键**（应用菜单 + 加速键）
  - `Ctrl/Cmd + M`：最小化
  - `Ctrl/Cmd + Shift + M`：最大化 / 还原
  - `Ctrl/Cmd + H`：隐藏到托盘
  - `F11`：切换全屏
  - `F12`：开发者工具
  - `Ctrl/Cmd + Q`：退出
- **全局快捷键** `Ctrl/Cmd + Shift + N`：从其它应用一键唤起主窗口。
- **系统托盘**：左键切换显示/隐藏，右键弹出菜单（显示/隐藏/退出）。
- **外链安全策略**：所有 `target=_blank` 与跨域跳转都交给系统浏览器，避免 Electron 内嵌跳出 SPA 边界。
- **应用图标**：把 `resources/icon.png`（256×256）与 `resources/icon.ico` 放入 `resources/` 即被 `electron-builder` 自动选用。

## 与 Web 端的关系

- 桌面端不再依赖远端 API；所有数据走 `IndexedDB`（由 `@my-notes/local-db` 提供），跨设备迁移通过 **用户信息 → 导出 / 导入 JSON** 完成。
- 渲染层完全复用 `apps/web` 的构建产物（`apps/web/dist`）；UI 变更只需修改 Web 端，无需改桌面壳。
