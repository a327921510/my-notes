# 产品需求文档（PRD）

**项目名称**：My Notes  
**版本**：V0.5（本地优先 + 桌面端 MVP）  
**文档状态**：评审稿  
**日期**：2026-05-21

---

## 1. 产品背景与定位

用户在网页阅读、工作记录、项目文档编写过程中存在大量「即时摘录」「分站点 / 分项目沉淀」需求；同时，关注隐私的用户希望**数据全部留在本地**、不依赖任何云端服务。

本期把 My Notes 收敛为 **纯本地优先** 的轻量笔记 + 项目信息管理工具：

- 数据存储于浏览器 / 桌面端的 IndexedDB；
- 跨设备迁移完全通过「文件导出 / 导入（JSON）」完成；
- 提供 Windows 桌面客户端（基于 Electron），界面复用 Web 端。

V0.5 不再包含任何「服务端登录、上传 / 拉取、冲突合并」逻辑（历史代码已在备份分支保留）。

---

## 2. 产品目标

### 2.1 核心目标

- **本地优先 + 离线可用**：所有 CRUD 不依赖网络；刷新 / 关机 / 断网均不丢数据。
- **文件级迁移**：用户可一键导出全部本地数据为 JSON，并在另一台设备导入合并。
- **桌面化体验**：提供 Windows `.exe`（NSIS 安装版 + Portable）安装包；支持窗口最小化、全局快捷键、系统托盘、最小化到托盘等桌面级常规交互。
- **统一界面**：桌面端 100% 复用 Web 端构建产物，避免双端 UI 漂移。

### 2.2 MVP 成功标准

- Web 端 / 桌面端均可完成「新建笔记 → 编辑 → 关闭重启 → 数据仍在」。
- 用户可在桌面端按 `Ctrl + Shift + N` 从其它应用唤起主窗口。
- 桌面端可最小化、最大化、最小化到托盘、托盘菜单退出。
- 在 A 设备导出 JSON 后，能在 B 设备导入并看到完整数据。

---

## 3. 产品范围

### 3.1 本期范围（In Scope）

- Web 端主应用：笔记区、站点信息区、项目信息区、项目文档、云盘工作台、用户信息（导出 / 导入）。
- 桌面端壳（Electron，目标 Windows .exe，兼容 macOS / Linux 调试）。
- 数据迁移：站点 + 项目 JSON 导出 / 导入（已实现）。

### 3.2 非本期范围（Out of Scope）

- 任何形式的远端账号、登录、注册、JWT。
- 远端上传 / 拉取 / 双向同步 / 冲突合并。
- 浏览器扩展（已下线）。
- 多人协作 / 多端实时同步。

---

## 4. 关键概念

| 概念 | 说明 |
| --- | --- |
| 本地笔记 | 仅存于浏览器 / 桌面端 IndexedDB 的笔记数据。 |
| 站点信息区 | 按 `address/domain` 隔离的短文本条目集合（账号、密码、ID、备注等）。 |
| 项目信息区 | 站点之上的「项目」聚合层；同一项目可包含多个站点与跨站点的条目。 |
| 项目文档 | 项目级 Markdown 文档；其中的「凭证表（地址/账号/密码/备注）」会自动镜像为各站点下的只读条目，便于在站点视图复制。 |
| 云盘工作台 | 本地目录 + 文件二进制（IndexedDB `blobs`）管理，仅用于「在本机内组织二进制资源」，不与远端云盘交互。 |
| 导出 / 导入 | 离线 JSON 文件迁移，是本期唯一的跨端数据通路。 |

---

## 5. 功能需求

### 5.1 Web 端 / 桌面端共用功能

#### 5.1.1 笔记区（`/notes`）

- 文件夹 / 笔记树结构，CRUD 完整。
- 富文本编辑器（Quill）；支持粘贴、拖拽、文件选择三种图片插入方式，图片二进制写入本地 `blobs`。
- 单层文件夹 + 笔记两级；条目右侧省略号菜单提供「重命名 / 删除」。

#### 5.1.2 站点信息区（`/sites`）

- 站点列表 + 详情：左侧站点列表（支持按项目筛选、关键字搜索），右侧条目流。
- 站点字段：`name`（必填）、`address`、`projectId`、`version`。
- 条目字段：`name`（可空）、`content`（必填），可由项目文档镜像得到只读条目。
- 操作：新增站点 / 复制站点 / 删除站点；条目新增 / 编辑 / 删除 / 复制。

#### 5.1.3 项目信息区（`/projects`）

- 项目维度组织站点 + 条目，列表 + 详情。
- 详情区按「无站点条目 → 按站点分组」顺序展示，每个站点分组显示 `address (name)`。
- 删除项目时：项目级条目同步删除；其下站点解除绑定（不级联删除站点）。

#### 5.1.4 项目文档（`/project-markdown`）

- 项目级 Markdown 文档（含「地址/账号/密码/备注」凭证表）。
- 凭证表行自动同步为对应站点下「只读镜像条目」（前缀 `__pm_cred_mirror__`），便于在站点页一键复制。

#### 5.1.5 云盘工作台（`/cloud-drive`）

- 本地目录 + 文件二进制管理；文件二进制写入 IndexedDB `blobs`，仅在本机有效。
- 目录与文件支持创建、删除、重命名、下载（导出本地文件）。

#### 5.1.6 用户信息与数据迁移（`/user`）

- 当前账户固定为「本地账户」，不再有登录态。
- 提供：
  - **导出 JSON**：把当前本地的项目 + 站点 + 条目打包为可迁移文件。
  - **导入 JSON**：解析后与本地数据按「项目名称 / 站点名称+地址 / 条目名称+正文」三级去重合并写入。

#### 5.1.7 全局搜索

- 顶部搜索栏，命中笔记 / 站点条目 / 项目条目，可直接跳转并定位。

---

### 5.2 桌面端独有功能

| 能力 | 实现 |
| --- | --- |
| Windows `.exe` 安装包 | `electron-builder --win nsis portable --x64` 在 Windows 主机产出 NSIS 安装版与 Portable 单文件。 |
| 单实例锁 | 重复启动会激活已有窗口。 |
| 窗口控制快捷键 | `Ctrl+M` 最小化 / `Ctrl+Shift+M` 最大化-还原 / `Ctrl+H` 隐藏 / `F11` 全屏 / `F12` DevTools / `Ctrl+Q` 退出。 |
| 全局快捷键 | `Ctrl+Shift+N` 在任意应用前台一键唤起主窗口。 |
| 系统托盘 | 左键切换显示 / 隐藏，右键菜单（显示 / 隐藏 / 退出）。 |
| 外链安全 | 所有跨域跳转走系统浏览器，避免 SPA 内嵌跳出。 |
| 多平台调试 | macOS / Linux 仅作开发联调，正式分发仅 Windows。 |

---

## 6. 数据模型（IndexedDB）

| 表 | 主要字段 |
| --- | --- |
| `folders` | `id, name, parentId, updatedAt, deletedAt?` |
| `notes` | `id, folderId, title, contentText, updatedAt, deletedAt?` |
| `images` | `id, noteId, localBlobRef, checksum?, sortOrder` |
| `snippets` | `id, type, content, sourceDomain, sourceUrl?, sourceTitle?, createdAt, updatedAt` |
| `site_spaces` | `id, sourceDomain, displayName, createdAt, updatedAt` |
| `clips` | `id, content, sourceUrl?, sourceDomain?, sourceTitle?, createdAt, status` |
| `projects` | `id, name, updatedAt` |
| `sites` | `id, name, address, projectId?, version, updatedAt` |
| `site_items` | `id, siteId?, projectId?, name, content, updatedAt` |
| `drive_folders` | `id, name, parentId, path?, createdAt, updatedAt` |
| `drive_files` | `id, folderId, name, mimeType?, sizeBytes, checksum?, localBlobRef?, localPath?, createdAt, updatedAt` |
| `blobs` | `key, blob`（二进制缓存） |

**版本约定**：Dexie 仅声明 `version(1)`，库名常量 `NOTES_DB_NAME` 当前为 `my_notes_v2`。Web 与桌面端各 origin 各一份物理数据库。

---

## 7. 业务流程

### 7.1 本地编辑流程

1. 用户在任意区域执行 CRUD；
2. 前端实时写入 IndexedDB；
3. UI 通过 `useLiveQuery` 即时响应变更。

### 7.2 文件级数据迁移

1. 用户在 A 端「用户信息」页点击「导出 JSON」，得到 `site-project-backup-*.json`；
2. 在 B 端「用户信息」页选择该文件「导入 JSON」；
3. 系统按「项目名 / 站点名+地址 / 条目名+正文」三级去重合并；
4. UI 显示新增 / 跳过统计。

### 7.3 桌面端启动

1. Windows 用户运行 `MyNotes-Setup-*.exe`；
2. 安装完成后启动应用，加载打包内的 Web 静态资源（`process.resourcesPath/web/index.html`）；
3. 启动后获取单实例锁，注册全局快捷键、托盘与窗口快捷键。

---

## 8. 非功能需求

- **性能**：1000 条笔记 + 1000 条条目场景下列表与搜索可用（沿用既有 IndexedDB 索引）。
- **可用性**：核心操作 1 步可达（新建、编辑、删除、导出 / 导入）。
- **隐私**：数据完全留存本地，不会向任何远端服务发送内容。
- **跨端一致性**：Web 与桌面端 UI 一致；通过文件迁移保证数据可移植。

---

## 9. 风险与应对

- **本地数据丢失风险**：浏览器清缓存 / 卸载桌面端会丢数据 → UI 显著引导用户「定期导出 JSON 备份」。
- **大量图片占用 IndexedDB**：超大图建议外链 / 压缩（后续版本可加入压缩策略）。
- **桌面端打包平台依赖**：Windows `.exe` 必须在 Windows 主机或具备 wine 的 CI 上执行 `dist:win`。

---

## 10. 相关文档

- [开发文档](./开发文档.md)
- [产品功能结构图](./产品功能结构图.md)
- [用户流程图](./用户流程图.md)
