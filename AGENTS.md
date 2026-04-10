# 仓库代理说明（Agent / AI）

## 需求与文档的版本差分

本仓库用 **结构化清单 + 按版本快照 + Cursor 规则** 支持「当前版 vs 上一版」对比，便于实现前快速对齐需求变更。

| 存放位置 | 作用 |
| -------- | ---- |
| `docs/version-manifest.json` | 当前/上一版本号及 `docs/` 下文件列表（机器可读，比对前先读） |
| `docs/versions/<版本>/` | 发版前冻结的文档快照，与现行 `docs/` 做逐文件 diff |
| `.cursor/rules/docs-version-diff.mdc` | Cursor 内对 AI 的**默认比对流程**（始终注入） |
| `.cursor/rules/page-layering.mdc` | Web 页面分层（入口 / 区域组件 / Hook / 纯展示；范例 `PageLayeringDemo`） |
| `docs/开发文档.md` §0、`docs/versions/README.md` | 人读约定与升版步骤 |

实现或评审需求时：优先对照 **上一版快照** 与 **当前 `docs/`**；无快照时再用 Git 历史补位。

## 需求落地与版本

- **凡形成或变更的需求**，最终应**汇总进 `docs/`**（见 `docs/开发文档.md` §0.4）；代理在对话中达成结论后，应推动或补全对应文档。
- 梳理需求时：识别是否**明确要求**工程版本升级；若无明确要求但存在**契约/格式/兼容性**等实质变化，应**提示是否建议**升级 `package.json` 中的版本并更新 `docs/version-manifest.json`。
- Web 页面分层（入口 / 区域组件 / Hook / 纯展示），范例目录 `apps/web/src/pages/PageLayeringDemo/`；执行细则见 `.cursor/rules/page-layering.mdc` 与 `docs/开发文档.md` 第 3.1.2 节。
