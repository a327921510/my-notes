# 文档版本快照

本目录按工程版本存放发版前冻结的 `docs/` 快照，用于与现行 `docs/` 做逐文件对比。

## 升版步骤

1. 将当时的现行文档复制到 `docs/versions/<即将成为上一版的版本号>/`。
2. 更新现行 `docs/` 与根 `package.json` 的 `version`。
3. 更新 `docs/version-manifest.json`：`previousVersion` ← 旧 `currentVersion`，`currentVersion` ← 新版本。

详见 `docs/开发文档.md` §0。
