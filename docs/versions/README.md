# 按版本归档的文档快照

本目录用于存放**已发布版本**的文档快照，便于在版本迭代时对照「上一版本」与「当前版本」。

## 何时写入

在将根目录 `package.json` 的 `version` **从 A 提升到 B** 之前：

1. 将当前 `docs/` 下需要留档的文件（至少包含 `version-manifest.json` 中列出的条目）复制到 `versions/<A>/`。
2. 更新根目录 `package.json` 与 `docs/version-manifest.json`：将 `previousVersion` 设为 `A`，将 `currentVersion` 设为 `B`，并视情况更新各条目的 `sinceVersion`。

首个有「上一版本」可对照的发布，是在从 `0.1.0` 升到 `0.2.0`（或更高）时产生 `versions/0.1.0/` 快照之后。

## 与清单的关系

权威列表与路径约定见上一级目录的 [version-manifest.json](../version-manifest.json)。

## AI / 代理开发

在 Cursor 中比对「上一版 vs 当前版」需求/文档时，代理会按仓库根目录 [.cursor/rules/docs-version-diff.mdc](../../.cursor/rules/docs-version-diff.mdc) 的约定执行；总览见根目录 [AGENTS.md](../../AGENTS.md)。
