---
name: req-workflow
description: >-
  REQ 文档驱动工作流总览：台账、分类、主流程、Cursor 口令与对话模板。
  触发词：工作流、REQ 工作流、口令速查、需求到上线、登记流程说明。
  具体执行请用 req-register / implement-req / add-e2e-test / sync-req-docs。
---

# REQ 工作流（总览）

当用户询问「怎么走工作流」「口令是什么」「登记/实现/归档怎么配合」时，先读本目录 [`WORKFLOW.md`](./WORKFLOW.md)，再按阶段指向对应 skill。

## 前置：路径配置

1. 读取项目 `.cursor/rules/req-workflow.local.mdc`（由 `cursor-std configure-req` 生成）。
2. **若文件不存在**：停止猜测路径，提示用户运行：

```bash
cursor-std configure-req /path/to/project \
  --doc-root /path/to/docs \
  --repo app=/path/to/app \
  --repo boss=/path/to/boss
```

（label 与路径按项目替换；可选 `--seed-docs` 初始化 backlog stub。）

## 阶段对照

| 用户意图 | Skill |
|----------|--------|
| 登记 / 建 REQ / 只改台账不写码 | `req-register` |
| 按 REQ 实现代码 | `implement-req` |
| 主路径已定，补页面 E2E | `add-e2e-test` |
| 代码已确认，同步文档 | `sync-req-docs` |

## 文档资产

`assets/` 可供 `configure-req --seed-docs` 复制到文档根：

- `REQ-index.stub.md` → `backlog/REQ-index.md`
- `_template.md` → `backlog/_template.md`
- `backlog-README.md` → `backlog/README.md`
- `changelog.stub.md` → changelog 路径（见本地配置）

## 注意

- 完整流程细则只维护在 `WORKFLOW.md`，避免与各阶段 skill 重复长文。
- 未确认代码前不要做阶段 B；实现阶段不要顺手改 changelog / 功能真相 / ops。
