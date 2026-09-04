---
name: implement-req
description: >-
  Implements a backlog REQ by reading the REQ ledger and changing configured code
  repos. Use when the user says「按 REQ 实现」「实现 REQ-xxx」「按 REQ-YYYYMMDD-xx 开发」,
  or asks to implement a backlog REQ without syncing docs yet.
---

# 实现 REQ（阶段 A）

按台账驱动改代码。本阶段**不**大改功能真相 / changelog / ops。

## 前置：路径配置

1. 读取 `.cursor/rules/req-workflow.local.mdc`。
2. 若缺失：停止并提示 `cursor-std configure-req`。**禁止猜测路径。**
3. 文档根：`backlog/REQ-index.md` + 可选 `REQ-*.md`；代码仓：配置表中的 label → 绝对路径。

## 必读顺序（先短后深）

1. 文档根下 `backlog/REQ-index.md` — 定位目标 `REQ-ID`
2. 若有详情：`backlog/REQ-*.md` 对应文件
3. 按需读功能真相文档**相关章节**（勿整本塞进上下文）
4. 在台账标明的端对应代码仓中定位页面/路由/接口后改代码

## 执行步骤

1. 确认 REQ-ID、类型、端（label）、验收句。
2. 范围外问题**另开 REQ**，勿塞进本单。
3. 可将台账状态改为 `开发中`；**不要**更新 changelog、功能真相、版本功能/测试、ops。
4. 实现保持最小改动；遵守各仓已有 coding rules（含可读性：单一编排入口、调用深度 ≤3、未复用不抽离；前端见 `std-typescript`）。
5. **用户可见主路径**（新能力或改了主流程）：在编排入口补 **流程地图**（stage 1→N）与 `// --- stageName ---` 分段；stage 名短英文 camelCase，与日志 `stage` 字段一致。旁路不上主地图。不要为对齐测试去拆一堆只调用一次的函数。
6. **自动化（两档）**：
   - **主路径未定**：禁止铺全量 E2E / 全站 `data-testid`。
   - **主路径已定**（用户明确说「主路径已定 / 可补 E2E」或实现已临近定稿且用户同意）：按验收句与 stage 表增量打标，并走 `add-e2e-test`（或在本阶段最小补齐）；稳定纯逻辑可附带单测。小程序自动化本仓库只占位，见该 skill。
7. Commit（仅当用户明确要求提交时）：Conventional Commits，footer 写同一 `REQ-ID`；多仓各自 commit 都带该 ID。

```text
feat(scope): 一句话

REQ-YYYYMMDD-XX
```

8. 结束后用中文简报，须含：

- 改了哪些端 / 文件、如何自测验收句、未做事项（文档同步留给阶段 B）
- **编排入口路径**（无用户可见主路径则写「无，纯内部/样式」）
- **stage 表**（无主路径则省略）：

| stage | 做什么 | 代码位置 |
|-------|--------|----------|
| `validateInput` | … | `path` `fn()` |

- **新增文件数**；单条主链路 **调用深度**（入口 → … → IO，是否 ≤3）；若超 3 层或新增未复用的单引用文件，须说明理由
- **E2E**：已写路径 / 占位 / 跳过（原因）
- **小程序自动化**：占位（默认）/ 不适用 / 项目已有说明
- **单测**：已写 / 跳过（原因）

小优化 / 纯文案且无新主路径：stage 表与 E2E 可写「无」。

## 禁止

- 未经用户确认就 `git commit` / `push`
- 「实现」阶段顺手批量改文档真相 / changelog / ops
- 把多个无关需求塞进一次实现
- 缺少本地路径配置时继续改码
- 为对齐测试而拆出大量单次使用的函数 / 文件
- 主路径未定时默认铺全量自动化测试或全站 `data-testid`
