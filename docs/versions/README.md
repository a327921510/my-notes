# 文档版本快照

本目录按**工程版本号**冻结 `docs/` 下的文档快照，用于「当前版 vs 上一版」的逐文件差分对比（配合 [version-manifest.json](../version-manifest.json)）。

## 目录约定

- `docs/versions/<版本号>/`：该版本升版前冻结的文档快照，与现行 `docs/` 逐文件 diff。
- 快照文件名与 `docs/` 下保持一致（如 `PRD.md`、`开发文档.md`）。

## 升版步骤

1. 在升版**之前**，把现行 `docs/` 下的文档复制到 `docs/versions/<上一版本号>/`。
2. 更新根目录 `package.json` 的 `version`（工程版本号的唯一来源）。
3. 更新 `docs/version-manifest.json` 的 `currentVersion` / `previousVersion` / `documents`。
4. 在 `docs/` 现行文档中落地本次需求变更。

## 版本记录

- **`1.0.0`（当前，无快照）**：重大重构后的全新需求基线。此前的需求域（笔记、站点信息区、项目信息、项目文件、旧云盘、浏览器扩展、本地优先手动同步）**整体作废**，与之对照没有价值，因此历史快照一并删除、`previousVersion` 置为 `null`。产品重新定义为「账号隔离的个人云盘 + `.mmd` 文档」，端为后端 + Electron 桌面端 + 本地 Web。
- 自 `1.1.0` 起恢复正常快照流程：升版前把 `1.0.0` 的文档复制到 `docs/versions/1.0.0/`。
