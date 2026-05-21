# /code-review — 项目级代码评审

按本项目当前 14 条 rule 对一段代码 / 一个文件 / 一个目录 / 一个 PR diff 做分级 review。

## 何时使用

- PR 合并前自查
- 接手陌生模块时摸底
- 代码评审会前先用 AI 走一遍，把"显然问题"过滤掉，会上集中讨论真正的设计问题

## 输入

```
/code-review <file path | directory | PR url | "describe what to review">
```

如果没指定目标，默认 review 当前打开文件。

## 评审顺序（必须严格按此优先级）

| 优先级 | 维度 | 参考 rule |
|---|---|---|
| 🔴 P0 | **正确性 / 安全** | error-handling, typescript-conventions（禁止 any / @ts-ignore） |
| 🔴 P0 | **架构合规** | page-layering（四层职责）、auto-routing 不该在组件里直接 fetch |
| 🟡 P1 | **数据层契约** | data-fetching（标准字段名、三态、AbortSignal、乐观更新回滚） |
| 🟡 P1 | **性能** | react-performance（memo / useCallback / useMemo 决策、列表回调模式） |
| 🟡 P1 | **可访问性** | accessibility（语义化、键盘、ARIA、焦点、对比度、antd 组件特例） |
| 🟢 P2 | **样式分工** | styling（Tailwind / Less Modules / antd 主题三层） |
| 🟢 P2 | **API / 状态归属** | api-services（不直接 import axios）、zustand-stores（不放页面级状态） |
| 🟢 P2 | **表单规范** | forms（非受控、submitting 复位、edit 用 key 重置） |
| 🟢 P2 | **路由约定** | routing（kebab-case、懒加载、searchParams 归属） |
| ⚪ P3 | **风格 / 命名 / 注释** | typescript-conventions（命名、import 顺序）、workflow（无废话注释） |

> 如果发现了 P0 问题，**先列 P0，等用户确认修复方向再继续**——不要在 P0 严重问题旁边堆 20 条命名 nitpick。

## 输出格式（严格）

```markdown
## Code Review: <被评审目标>

### 总览
<1–2 句话概括质量与最重要发现>

### 🔴 必须修复（合并前阻断）
1. **<问题类型>** — <一句话描述>
   - 文件：`path/to/file.tsx:123`
   - 违反：`<rule 文件名>` 第 X 节 / 第 N 条
   - 问题：<为什么是错的、有什么后果>
   - 建议修复：
   ```tsx
   // 改成这样
   ```

### 🟡 建议修复（不阻断合并，但应近期跟进）
1. <同上格式，可省略代码块>

### 🟢 改进建议（非必须）
1. <一句话即可>

### ✅ 做得好的地方
1. <具体的优点，不要写"代码质量好"这种空话>

### 结论
- [ ] ✅ 同意合并
- [ ] ⚠️ 同意但建议跟进 🟡
- [ ] 🔴 请求修改（必须先解决 🔴）
```

## 行为约束

- **必须列出违反了哪条 rule 的哪一节**，让作者能去查证（"page-layering.rule 第 2 条 区域组件不能 import 其他区域内部状态"）
- **必须给出修复代码**，而不是只说"这里有问题"
- **不要鸡蛋里挑骨头**：一次评审最多列 10 个最重要的问题；如果发现的 P3 问题超过 5 个，说明文件本身需要重构（建议改用 `/refactor-page`）
- **不要重写整个文件**——只标出需要改的代码块
- **必须正面反馈**：至少列 1 条做得好的地方（避免评审变成"挑刺会"）
- **大文件分批 review**：超过 500 行的文件，分批输出 review，每批不超过 200 行的关注范围
