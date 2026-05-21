# Cursor Rules — 加载策略与维护指引

本目录定义项目所有的 Cursor AI 规则。每条规则都使用 `.mdc` 格式 + YAML frontmatter，控制何时被加载到上下文。

## 加载策略

| 规则 | 加载策略 | 触发文件 / 时机 | 职责 |
|---|---|---|---|
| `workflow.rule.mdc` | **always** | 每个回合 | 标准流程、提交前自检 |
| `auto-routing.rule.mdc` | **always** | 每个回合 | 关键词 → skill / workflow 路由 |
| `typescript-conventions.rule.mdc` | **always** | 每个回合 | TS 编码规范、命名、导入顺序 |
| `styling.rule.mdc` | **always** | 每个回合 | Tailwind / Less Modules / antd 主题三层分工 |
| `error-handling.rule.mdc` | **always** | 每个回合 | 错误责任边界、Result 模式、`App.useApp()` 用法 |
| `page-layering.rule.mdc` | glob | `src/pages/**`、`src/router/routes.tsx` | 页面四层架构职责与反模式 |
| `react-performance.rule.mdc` | glob | `src/**/*.{ts,tsx}` | memo / useCallback / useMemo 决策 |
| `data-fetching.rule.mdc` | glob | `src/pages/**/hooks/use*`、`src/services/**` | 业务 Hook 三态契约、取消、乐观更新 |
| `forms.rule.mdc` | glob | `src/pages/**`、`src/components/**` | antd Form 统一范式、提交态、校验 |
| `accessibility.rule.mdc` | glob | `src/**/*.tsx` | 语义化 / 键盘 / ARIA / 焦点 / 对比度 / antd 组件特例 |
| `utilities.rule.mdc` | glob | `src/**/*.{ts,tsx}` | 工具函数选型：优先 es-toolkit，第三方覆盖不到才自实现 |
| `routing.rule.mdc` | glob | `src/router/**`、页面入口、`App.tsx` | React Router v6 数据路由约定 |
| `zustand-stores.rule.mdc` | glob | `src/stores/**` | 全局状态边界、selector 订阅 |
| `api-services.rule.mdc` | glob | `src/services/**` | Axios 实例与 API 模块组织 |
| `svg-icons.rule.mdc` | glob | `src/assets/icons/**`、`*.svg` | SVG 作为 React 组件导入 |

> **设计原则**：only what's truly project-wide should be always-on。当前 5 条 always-on 总体积 ~10KB，其余 10 条按 glob 触发，把固定上下文开销控制在最小。

## 文件命名

- 规则文件统一使用 `<name>.rule.mdc`（命名风格与 `<name>/SKILL.md` 形成对称）
- `<name>` 用 kebab-case，描述领域而非动作

## 内容规模约束

| 类型 | 体量目标 | 说明 |
|---|---|---|
| always-on 规则 | ≤ 2KB | 每个回合都加载，必须精简到"可执行约束" |
| glob 规则 | ≤ 4KB | 按文件触发，可以稍长但仍以约束为主 |
| 深度示例、决策树 | 不写在规则里 | 放到对应 skill 的 `references/<name>-guide.md` |

> 如果一条规则正在膨胀到 5KB+，**通常是知识塞进了约束位**——把代码模板和决策示例下沉到 `.cursor/skills/*/references/`，规则只保留"必须 / 禁止 / 决策表"。

## 何时新增规则

✅ 适合新增的场景：
- 项目内已经出现"同一类问题被指出 ≥3 次"
- 出现新技术栈领域（如引入 i18n、TanStack Query、表单库）
- 新的硬约束（如"禁止某种写法"）

❌ 不适合新增的场景：
- 单次 review 的偶发问题（在 PR 评论里说就够了）
- 只有一个文件涉及的细节（写在该文件的代码注释或 README 里）
- 仅"建议"性内容，没有强制要求（写在 `docs/` 或 skill references 里）

## 何时调整加载策略

- 规则只在某个目录下相关 → 改 `alwaysApply: false` + `globs`
- 规则跨目录相关但只在写代码时需要 → glob 限制为 `*.{ts,tsx}` 等
- 规则定义"提交前流程"或"对话风格"这类全局约束 → 保持 `alwaysApply: true`

## 维护检查

- 每季度 review：是否有规则长期未触发？是否有重复内容？
- 单源原则：同一条约束**只在一个 rule 里写**，其他文件用 reference link 指过来
- 规则瘦身后，原内容应迁移到对应 skill 的 `references/` 目录，避免知识散失
