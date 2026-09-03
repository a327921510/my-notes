---
name: req-register
description: >-
  Registers a new REQ in the project backlog (REQ-index and optional detail file).
  Use when the user says「按工作流登记需求」「建 REQ」「登记需求」「生成 REQ 台账」,
  or asks to create a backlog entry without changing business code.
---

# 登记 REQ（步骤 ①）

按 REQ 文档驱动工作流登记需求。本阶段**只改文档仓台账/详情**，不改业务代码。

## 前置：路径配置

1. 读取 `.cursor/rules/req-workflow.local.mdc`。
2. 若缺失：停止并提示用户运行 `cursor-std configure-req`（带 `--doc-root` 与至少一个 `--repo`）。**禁止猜测路径。**
3. 从配置取得：文档根、`backlog/`、feature-doc、changelog、repo label 列表。

细则可对照 `.cursor/skills/standards/req-workflow/WORKFLOW.md` 的 Step 1 / 2a / 2b。

## 执行步骤

1. 确认今天日期，分配下一序号：`REQ-YYYYMMDD-XX`（同日已有则递增）。
2. 归类：优化 / 小需求 / BUG / 完整功能；「端」用配置中的 label。
3. 在 `backlog/REQ-index.md` **加一行**（状态默认 `待评估`，或用户指定）。
4. 写清「确认理解」：改哪些仓、做成什么样算完、1～3 条验收句（可写在台账标题/详情中）。
5. 完整功能或跨仓复杂改动：从 `backlog/_template.md` 复制出 `REQ-YYYYMMDD-XX-短标题.md`，并起草版本功能文档骨架（若用户要求）。
6. 轻量需求可不建详情文件。

## 结束简报（中文）

- REQ-ID、类型、端、台账/详情路径
- 验收句摘要
- 提醒：下一步说「按 REQ-xxx 实现」进入 `implement-req`；主路径定稿后可说「补 E2E」进入 `add-e2e-test`

## 禁止

- 改业务代码仓
- 更新 changelog / 功能真相 / ops（留给阶段 B）
- 在缺少 `req-workflow.local.mdc` 时继续执行
