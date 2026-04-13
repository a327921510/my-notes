# React 页面四层架构 — 可移植工具包

本目录包含一套完整的**规则 + 技能 + 文档 + PRD**，可直接复制到任意 React + TypeScript 项目中使用 Cursor AI 生成符合四层架构的页面代码。

---

## 文件清单

| 文件 | 类型 | 作用 | 放哪里 |
|------|------|------|--------|
| `page-layering.rule.mdc` | Cursor 规则 | AI 始终遵守的架构约束 | 项目 `.cursor/rules/` 目录下 |
| `generate-page.skill.md` | 技能/Prompt | 引导 AI 按流程生成页面脚手架 | Cursor 对话中 @引用 或粘贴为 System Prompt |
| `page-layering-guide.md` | 开发文档 | 完整示例、通信模式、反模式、FAQ | 项目 `docs/` 或 @引用给 AI 作为参考 |
| `complex-page-prd.md` | PRD 范例 | 企业级 API 管理仪表盘 | 作为生成输入传给 AI |

---

## 快速开始

### 第 1 步：在新项目中安装规则

```bash
# 在你的 React 项目根目录
mkdir -p .cursor/rules
cp page-layering.rule.mdc .cursor/rules/
```

规则文件设置了 `alwaysApply: true`，Cursor 会在每次对话中自动注入。

### 第 2 步：生成页面

在 Cursor 中新建对话，发送如下内容：

```
@page-layering-guide.md @generate-page.skill.md

请按照四层架构生成一个用户管理页面，包含：
- 左侧：用户列表（搜索、筛选角色）
- 右侧：用户详情（基本信息、权限配置）
- 功能：增删改查、批量操作、导出
```

AI 将按照技能文件定义的流程：分析需求 → 确认结构 → 逐文件生成。

### 第 3 步：使用 PRD 生成复杂页面

```
@page-layering-guide.md @generate-page.skill.md @complex-page-prd.md

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
