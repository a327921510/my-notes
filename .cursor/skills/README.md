# Cursor Skills — 触发与维护指引

本目录的每个子文件夹是一个 **Skill**：按需触发的工作流，包含完整的"分析 → 生成 → 输出"步骤。

> Skill 与 Rule 的区别：
> - **Rule** = 始终生效的"什么不能做 / 必须怎么做"（约束）
> - **Skill** = 用户表达特定意图时被触发的"按这套步骤做"（工作流）
> - **Reference**（在 skill 的 `references/` 子目录）= 知识与示例库，被 skill 和 rule 共同引用

## 当前 Skills

| Skill | 触发关键词（详见 `auto-routing.rule.mdc`） | 产出 |
|---|---|---|
| `generate-page` | "新建页面"、"做一个 XX 页"、"四层架构" | `src/pages/<Name>/` 完整四层骨架 + 路由注册提示 |
| `add-api-module` | "对接接口"、"新增 API 模块"、"封装 XX 接口" | `src/services/modules/<domain>.ts` |
| `add-zustand-store` | "全局状态"、"跨页面共享"、"持久化用户信息" | `src/stores/use<Domain>Store.ts` |
| `add-route` | "新增菜单"、"加路由"、"注册路由" | 路由表更新 + 页面入口骨架 |

## Skill 文件结构

```
.cursor/skills/<skill-name>/
├── SKILL.md                       # 必需：触发说明 + 步骤 + 输出格式
└── references/                    # 可选：深度知识、完整示例、FAQ
    ├── <name>-guide.md
    └── ...
```

## SKILL.md 格式

```markdown
---
name: <skill-name>
description: <一句话说清做什么 + 何时使用>
---

# <标题>

前置条件：依赖哪些 rule、哪些参考文档。

## 生成流程

### Step 1: <分析 / 确认需求>
### Step 2: <列出文件 / 设计>
### Step 3: <逐文件生成>
### Step 4: <收尾提示>

## 生成规则
（生成时的硬约束；通用约束指向 rule 文件，避免重复）

## 输出格式
（如何呈现给用户）
```

## 何时新增 Skill

✅ 适合新增：
- 同一类工作流被反复触发（≥5 次）
- 工作流跨多个文件、需要标准模板
- 需要按特定顺序生成依赖关系（types → hook → components → entry）

❌ 不适合新增：
- 一次性脚手架（写个示例文档就够）
- 实质上是"约束 / 检查"而不是"生成 / 改造"（应该写成 rule）

## 与 Rule 的协作模式

```
用户请求
   ↓
auto-routing.rule.mdc 识别意图
   ↓
触发对应 Skill（按 SKILL.md 流程执行）
   ↓
执行过程中遵守相关 Rule（page-layering / react-performance / typescript / styling ...）
   ↓
需要深度知识时查阅 Skill 的 references/<name>-guide.md
```

## 维护检查

- **职责单源**：同一段代码模板只在 references 里写一次，rule 和 skill 都通过 link 引用
- **触发清晰**：在 `auto-routing.rule.mdc` 的关键词表里维护好对应映射
- **示例新鲜**：reference 文档里的代码示例至少每半年走查一次，避免与现有依赖版本脱节
