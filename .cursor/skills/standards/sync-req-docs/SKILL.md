---
name: sync-req-docs
description: >-
  Syncs project documentation after code is confirmed for a REQ. Updates
  REQ-index, changelog, and related feature docs by type. Use when the user
  says「REQ-xxx 已确认，同步文档」「同步 REQ 文档」「确认后更新文档」.
---

# 同步 REQ 文档（阶段 B）

仅在用户确认代码可用后执行。对照 REQ + 相关 git diff / commit，按类型裁剪更新范围。

## 前置：路径配置

1. 读取 `.cursor/rules/req-workflow.local.mdc`。
2. 若缺失：停止并提示 `cursor-std configure-req`。**禁止猜测路径。**
3. 使用配置中的文档根、feature-doc、changelog、以及各代码仓路径（用于 `git log --grep`）。

## 开始前核对

1. 读台账与（若有）REQ 详情，确认类型与端。
2. 用 `git log --grep=REQ-YYYYMMDD-XX`（在相关代码仓）或用户给出的 hash，收集关联 commit。
3. 对照 diff，判断用户可见行为是否变化。

## 按类型更新（默认裁剪）

| 类型 | 台账 | changelog | 全量功能文档 | 版本功能/测试 | ops |
|------|------|-----------|--------------|---------------|-----|
| 小优化 | ✅ | ✅ | 行为变了才改 | ❌ | ❌ |
| 小需求 | ✅ | ✅ | 通常改一句 | ❌ | 一般否 |
| BUG | ✅ | ✅ | 仅纠正错误描述 | ❌ | ❌ |
| 完整功能 | ✅ + 详情 | ✅ | ✅ 吸收进真相 | ✅ | 用户点名或需培训时 |

**不默认全开**：版本功能/测试、ops 除非类型要求或用户点名。

## 台账字段

更新：状态（如 `已上线` / `待验收`）、实际工时（用户未给则询问，勿瞎填）、关联 commit（按 label 拼接）、上线日（若已知）、文档已更新。

## changelog 格式

新记录写在最上面：

```markdown
## YYYY-MM-DD

### REQ-YYYYMMDD-XX — 标题
- 端：（repo label）
- 类型：优化 | 小需求 | BUG | 完整功能
- 说明：一句话
- Git：label `hash` / …
- 功能文档：已更新 §x.x / 无需更新
```

## 结束后简报

列出：改了哪些文档路径、跳过了哪些（及原因）、台账中的 commit/状态是否已齐、是否还缺工时或 ops。

完整功能：若本 REQ 有 E2E / 版本测试文档，可在简报中提醒「版本测试文档是否需同步自动化覆盖范围」（默认不改代码仓测试文件）。

## 禁止

- 在用户未确认代码前做阶段 B
- 每个小优化都改版本功能/测试文档
- 仅凭 diff 编造带截图的 ops 操作手册（缺材料时说明并跳过）
- 默认把验收标准全部勾选（除非用户明确授权或已手测）
- 在阶段 B 补写或大改 E2E（应走 `add-e2e-test` / 实现阶段）
