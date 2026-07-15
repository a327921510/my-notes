# 文档版本快照

本目录按**工程版本号**冻结 `docs/` 下的文档快照，用于「当前版 vs 上一版」的逐文件差分对比（配合 `docs/version-manifest.json` 与 `.cursor/rules/docs-version-diff.mdc`）。

## 目录约定

- `docs/versions/<版本号>/`：该版本发布前冻结的文档快照（与现行 `docs/` 逐文件 diff）。
- 快照文件名与 `docs/` 下保持一致（如 `PRD.md`、`开发文档.md`）。

## 升版步骤

1. 在升版**之前**，把现行 `docs/` 下的相关文档复制到 `docs/versions/<上一版本号>/`。
2. 更新根目录 `package.json` 的 `version`（工程版本号的唯一来源）。
3. 更新 `docs/version-manifest.json` 的 `currentVersion` / `previousVersion`。
4. 在 `docs/` 现行文档中落地本次需求变更。

## 版本记录

- `0.4.0/`：0.4.0 发布时的文档快照（云盘 CRUD + LWW 同步、单文件 JSON 离线导出）。
  - 0.5.0 相对 0.4.0 的主要变化：云盘新增「同步对比」（复刻 GitHub/GitLab 的 diff 预览，见 PRD §6.1.3D），云盘导出/导入由单一 JSON 改为**实体目录嵌套文件的 ZIP**（PRD §6.1.3E）。
