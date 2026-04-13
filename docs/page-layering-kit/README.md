# React 页面四层架构 — 可移植工具包

本目录包含一套完整的**规则 + 技能 + 文档 + PRD**，可直接复制到任意 React + TypeScript 项目中使用 Cursor AI 生成符合四层架构的页面代码。

---

## 文件清单与放置位置

> **核心原则**：只有规则文件放 `.cursor/rules/`（自动注入），其他文件放 `docs/`（按需 @引用）。
> 如果把所有文件都塞进 `.cursor/rules/`，每次对话都会自动注入全部内容，浪费 context 窗口、降低 AI 效果。

| 文件 | 类型 | 放哪里 | 注入方式 | 说明 |
|------|------|--------|---------|------|
| `page-layering.rule.mdc` | Cursor 规则 | `.cursor/rules/` | **自动**（每次对话） | 架构约束，始终生效 |
| `generate-page.skill.md` | 技能 Prompt | `docs/` | **手动** @引用 | 只在"生成页面"时引用 |
| `page-layering-guide.md` | 开发文档 | `docs/` | **手动** @引用 | 只在需要完整示例时引用 |
| `complex-page-prd.md` | PRD 范例 | `docs/` | **手动** @引用 | 只在生成该特定页面时引用 |
| `README.md` | 使用说明 | `docs/` | 不需要引用 | 给人看的说明 |

安装后的项目结构：

```
你的项目/
├── .cursor/rules/
│   └── page-layering.rule.mdc      ← 唯一放这里的文件（自动注入）
├── docs/
│   ├── generate-page.skill.md       ← 按需 @引用
│   ├── page-layering-guide.md       ← 按需 @引用
│   └── complex-page-prd.md          ← 按需 @引用
├── src/
│   └── pages/
└── ...
```

---

## 快速开始

### 第 1 步：复制文件到新项目

```bash
# 在你的 React 项目根目录
mkdir -p .cursor/rules docs

# 规则文件 → .cursor/rules/（自动注入）
cp page-layering.rule.mdc .cursor/rules/

# 其他文件 → docs/（按需引用）
cp generate-page.skill.md page-layering-guide.md complex-page-prd.md docs/
```

### 第 2 步：生成页面

在 Cursor 中新建对话，@引用需要的文件：

```
@docs/generate-page.skill.md @docs/page-layering-guide.md

请按照四层架构生成一个用户管理页面，包含：
- 左侧：用户列表（搜索、筛选角色）
- 右侧：用户详情（基本信息、权限配置）
- 功能：增删改查、批量操作、导出
```

> 不需要 @引用规则文件，它已经通过 `.cursor/rules/` 自动生效了。

AI 将按照技能文件定义的流程：分析需求 → 确认结构 → 逐文件生成。

### 第 3 步：使用 PRD 生成复杂页面

```
@docs/generate-page.skill.md @docs/page-layering-guide.md @docs/complex-page-prd.md

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
