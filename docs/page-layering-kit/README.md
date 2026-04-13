# React 页面四层架构 — 可移植工具包

本目录包含一套完整的**规则 + 技能 + 文档 + PRD**，可直接复制到任意 React + TypeScript 项目中使用 Cursor AI 生成符合四层架构的页面代码。

---

## 文件清单与放置位置

Cursor 有三种不同的扩展机制，各有归属：

| 机制 | 目录 | 特点 |
|------|------|------|
| **Rules** | `.cursor/rules/` | 始终生效的约束/规范，每次对话自动注入 |
| **Skills** | `.cursor/skills/` | 按需触发的多步骤工作流，Agent 自动判断或用户 `/skill-name` 调用 |
| **docs** | `docs/` 等任意位置 | 参考文档，需要时 @引用 |

基于以上机制，本工具包的文件分配如下：

| 文件 | 类型 | 放哪里 | 触发方式 | 说明 |
|------|------|--------|---------|------|
| `page-layering.rule.mdc` | Rule | `.cursor/rules/` | **自动**（每次对话注入） | 架构约束，始终生效 |
| `.cursor/skills/generate-page/SKILL.md` | Skill | `.cursor/skills/generate-page/` | **自动**（Agent 根据上下文判断）或 `/generate-page` 手动调用 | 生成页面的工作流 |
| `.cursor/skills/generate-page/references/page-layering-guide.md` | Skill Reference | 同上（skill 内部） | Skill 按需加载 | 完整代码示例、通信模式 |
| `page-layering-guide.md` | 独立文档 | `docs/` | **手动** @引用 | 同上，独立副本，也可单独阅读 |
| `complex-page-prd.md` | PRD 范例 | `docs/` | **手动** @引用 | 只在生成该特定页面时引用 |
| `README.md` | 使用说明 | `docs/` | 不需要引用 | 给人看的说明 |

安装后的项目结构：

```
你的项目/
├── .cursor/
│   ├── rules/
│   │   └── page-layering.rule.mdc           ← Rule：始终生效的架构约束
│   └── skills/
│       └── generate-page/                   ← Skill：按需触发的生成工作流
│           ├── SKILL.md
│           └── references/
│               └── page-layering-guide.md
├── docs/
│   ├── page-layering-guide.md               ← 独立文档副本（可选，便于人阅读）
│   └── complex-page-prd.md                  ← PRD：按需 @引用
├── src/
│   └── pages/
└── ...
```

> **为什么不把所有文件都放 `.cursor/rules/`？**
> Rules 每次对话自动注入全部内容。如果把 PRD、完整文档都塞进去，每次聊天（哪怕只是改个 bug）都会消耗大量 context 窗口。
>
> **为什么 Skill 和 Rule 分开？**
> Rule = "你始终要遵守的约束"（如架构分层规范）。Skill = "你需要执行的动作"（如生成页面脚手架）。Skill 只在相关时加载，且可以有自己的 references 子目录实现渐进式加载。

---

## 快速开始

### 第 1 步：复制文件到新项目

```bash
# 在你的 React 项目根目录

# Rule → .cursor/rules/
mkdir -p .cursor/rules
cp page-layering.rule.mdc .cursor/rules/

# Skill → .cursor/skills/generate-page/
mkdir -p .cursor/skills/generate-page/references
cp .cursor/skills/generate-page/SKILL.md .cursor/skills/generate-page/
cp .cursor/skills/generate-page/references/page-layering-guide.md .cursor/skills/generate-page/references/

# 文档 → docs/
mkdir -p docs
cp page-layering-guide.md complex-page-prd.md docs/
```

### 第 2 步：生成简单页面

在 Cursor Agent 对话中直接描述需求。Skill 会自动触发（也可以手动输入 `/generate-page`）：

```
请生成一个用户管理页面，包含：
- 左侧：用户列表（搜索、筛选角色）
- 右侧：用户详情（基本信息、权限配置）
- 功能：增删改查、批量操作、导出
```

> 不需要手动 @引用。Rule 自动注入架构约束，Skill 被 Agent 自动发现并执行生成流程。

### 第 3 步：使用 PRD 生成复杂页面

当需要 PRD 作为输入时，@引用 PRD 文件即可：

```
@docs/complex-page-prd.md

请按照 PRD 中描述的 API 管理仪表盘页面，生成完整代码。
技术栈：React 18 + TypeScript + Ant Design 5 + Tailwind CSS + Recharts。
```

---

## 四层架构速查

```
┌──────────────────────────────────────┐
│   1. 页面入口 (index.tsx)             │  编排 · 共享状态 · 跨区联动
├──────────┬───────────┬───────────────┤
│ 2. 区域A  │  2. 区域B  │  2. 区域C     │  内部自治 · 对外最小接口
│ ┌──────┐ │ ┌───────┐ │ ┌───────────┐ │
│ │4.展示│ │ │4.展示 │ │ │ 4.展示    │ │  只用 props · 不调 API
│ └──────┘ │ └───────┘ │ └───────────┘ │
├──────────┴───────────┴───────────────┤
│   3. 业务 Hooks (use*.ts)             │  API · 数据 · 规则 · 缓存
└──────────────────────────────────────┘
```

---

## 自定义

- **UI 库**：示例使用 Ant Design，换成 MUI / shadcn/ui 时只需修改组件语法，架构不变
- **状态管理**：默认使用页面级 hooks；如项目有 Zustand / Redux，业务 Hook 内部可调用 store
- **数据层**：示例使用 fetch API；换成 React Query / SWR / Apollo 时同样封装在业务 Hook 中
