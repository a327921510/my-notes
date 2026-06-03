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
| `pnpm dev` | 并行启动 `@my-notes/web` Vite 开发服与 Electron 主窗口（自动等待 `http://127.0.0.1:5173`）；**须保持该终端不退出**，退出会连带结束 Vite，Electron 将无法热更新 |
| `pnpm build` | 先构建 Web 产物，再编译主进程 TS 到 `dist/` |
| `pnpm dist:win` | 一键产出 Windows `.exe`（NSIS 安装包 + Portable）到 `release/`；默认经 [npmmirror](https://npmmirror.com/mirrors/electron/) 下载 Electron，避免 GitHub 超时 |
| `pnpm dist:linux` | 产出 Linux AppImage（用于本地 / 容器内验证） |

> 注意：Windows 端 `.exe` 必须在 **Windows 主机** 或具备 `wine` 的 CI 环境上执行 `pnpm dist:win`；本仓库的 cloud agent / Linux 容器仅用于编译主进程脚本，最终安装包请在 Windows 机器上打包。
>
> 若打包报 `ENOENT ... apps\api\node_modules\@fastify\cors`：说明已下线的 `apps/api` 里还留着失效的 `node_modules` 链接。删除 `apps/api/node_modules` 后重试；桌面端已在 `build.npmRebuild: false` 跳过原生依赖重建。
>
> 若需直连 GitHub（例如海外 CI），打包前可清空镜像：`$env:ELECTRON_MIRROR=''; $env:ELECTRON_BUILDER_BINARIES_MIRROR=''; pnpm dist:win`（Linux/macOS 用 `env -u ELECTRON_MIRROR -u ELECTRON_BUILDER_BINARIES_MIRROR pnpm dist:win`）。
>
> 若报 `cannot access ... app.asar ... being used by another process`：说明 `release\win-unpacked` 被占用。请 **托盘退出 MyNotes**、关闭打开该文件夹的资源管理器窗口，必要时任务管理器结束 `MyNotes.exe`；仍失败时脚本会改输出到 `release-build-<时间戳>/`，或把旧目录重命名为 `win-unpacked.locked-*`。占用解除后可手动删除整个 `apps/desktop/release` 再打包。

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
- **应用图标**：把 `resources/icon.png`（256×256）与 `resources/icon.ico` 放入 `resources/` 即被 `electron-builder` 自动选用；未放置时托盘使用内置品牌色 16×16 占位图。
- **关闭按钮**：点窗口关闭会隐藏到托盘（与 `Ctrl+H` 一致），需从托盘菜单或 `Ctrl+Q` 退出进程。

## 开发时：浏览器 vs Electron 窗口

| 现象 | 原因 |
| --- | --- |
| 页面数据不一致 | 即使都是 `http://127.0.0.1:5173`，**系统浏览器与 Electron 使用不同的 Chromium 存储分区**，IndexedDB 互不共享；各自导出/导入 JSON 才能对齐数据。 |
| Electron 无热更新、与浏览器不同步 | ① **先托盘完全退出安装版 MyNotes**（与 dev 抢单实例锁会导致 dev 秒退、你看到的仍是旧窗口）。② 开发窗口标题必须是 **`MyNotes [开发] — http://127.0.0.1:5173/...`**，否则不是 dev。③ `pnpm dev:desktop` 终端须保持不退出。 |
| 地址请统一 | 开发服绑定 `127.0.0.1`，请用 `http://127.0.0.1:5173/`，不要用 `localhost`（在部分环境下会解析到 `::1` 导致连不上 Vite）。 |

## 与 Web 端的关系

- 桌面端不再依赖远端 API；所有数据走 `IndexedDB`（由 `@my-notes/local-db` 提供），跨设备迁移通过 **用户信息 → 导出 / 导入 JSON** 完成。
- 渲染层完全复用 `apps/web` 的构建产物（`apps/web/dist`），由 `extraResources` 复制到安装目录的 `resources/web/`；打包时请走 `pnpm build` / `dist:win`（会执行 `build:desktop`，使用相对资源路径与 Hash 路由）。勿单独 `vite build` 后打包，否则 `file://` 下会出现白屏。
- 产出物：`MyNotes-Setup-*.exe`（NSIS 安装包）与 `MyNotes-Portable-*.exe`（免安装）；二者均含完整 UI，区别仅为分发形式。
