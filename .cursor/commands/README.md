# Cursor Commands — 触发与维护指引

本目录是 **Commands 层**：当用户输入 `/<command-name>` 时，Cursor 加载对应文件并按其描述的工作流执行。Commands 把高频任务从"每次手敲长 prompt"变成"1 行触发 + 标准化输出格式"。

## 与 Rules / Skills 的边界

| 层 | 何时生效 | 内容性质 | 可触发方式 |
|---|---|---|---|
| **Rule** | 自动加载（always 或 glob） | 必须遵守的约束 | 不需触发，自动注入 |
| **Skill** | 用户表达"做某事"的意图（关键词路由） | 生成 / 改造的工作流 | 通过 auto-routing.rule 关键词识别 |
| **Command** | 用户显式输入 `/xxx` | 复用既有 rules 的"任务模板"（评审 / 体检 / 重构） | 显式 `/<command>` |

> Skill 和 Command 都是"工作流"，区别在**触发方式**：Skill 靠 NLP 路由，Command 靠精确指令。
> Command 适合"频繁、可重复、希望严格按某格式输出"的任务。

## 当前 Commands

| 命令 | 一句话 | 主要参考 rule |
|---|---|---|
| `/code-review` | 按 14 条 rule 做分级 review | 全部 rules |
| `/refactor-page` | 把超限页面拆到四层架构 | page-layering, react-performance, accessibility |
| `/a11y-audit` | 按九个维度做 a11y 体检 | accessibility |
| `/perf-audit` | React 重渲染性能体检 | react-performance |

## 命令文件格式

```markdown
# /<name> — <一句话标题>

<命令做什么>

## 何时使用
（适用场景列表）

## 输入
（命令格式 + 可选参数）

## 工作流 / 检查清单
（具体步骤、必须的检查维度）

## 输出格式（严格）
（强制输出模板）

## 行为约束
（必须 / 禁止 列表）
```

**关键要求：**
- 每个 command 都必须有"输出格式（严格）"——这是 command 区别于自由对话的核心价值
- 工作流要可重复：同一段代码第二次跑应该输出同样的诊断
- 如果命令依赖某条 rule，**必须**在文中明确"违反 X.rule 第 N 节"，让用户能查证

## 何时新增 Command

✅ 适合：
- 高频重复任务（每周 ≥1 次）
- 输出格式需要标准化（review 报告、体检报告、ADR）
- 多步骤、容易漏步骤的工作流

❌ 不适合：
- 一次性需求
- 没有明确"输入 → 工作流 → 输出"结构的探索性对话
- 已经有 skill 覆盖的场景（避免触发歧义）

## 何时升级为 Agent

当一个 command 出现以下信号时，考虑升级为 `.cursor/agents/` 下的角色化 agent：

- 命令文件超过 200 行 / 4KB
- 需要"扮演某个角色"才能输出高质量结果（如资深 a11y 顾问的 mindset）
- 工作流需要明确的 thinking process（CoT），而不只是步骤列表
- 多个 commands 都需要类似的"专家视角"

> 当前阶段不引入 agents，所有 command 自包含。

## 命令调用与组合

- 单个：`/code-review src/pages/Home/index.tsx`
- 组合：先 `/code-review` 看整体质量 → 决定要重构 → `/refactor-page` 走拆分
- 体检序列：`/code-review` → `/a11y-audit` → `/perf-audit` 完整覆盖前端三大关注点

## 与 auto-routing.rule 的协作

`auto-routing.rule.mdc` 也加入了"用户描述 → 推荐使用的命令"映射，例如：

- 用户说"帮我看下这页面写得怎样" → 自动建议 `/code-review`
- 用户说"键盘用不了" → 自动建议 `/a11y-audit`
- 用户说"页面卡" → 自动建议 `/perf-audit`

如果用户**明确**输入 `/xxx`，绝对走该命令；NLP 路由只是补救。
