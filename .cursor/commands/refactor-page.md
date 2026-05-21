# /refactor-page — 把超限页面拆到四层架构

把一个"已经写歪 / 已经超限"的页面文件，**最小侵入地**拆成 `page-layering.rule.mdc` 定义的四层架构（页面入口 / 区域组件 / 业务 Hooks / 纯展示组件）。

## 何时使用

- 单文件页面 > 300 行
- 一个 `index.tsx` 里同时包含 fetch、filter state、render、form
- 准备添加新功能但发现"加哪都不合适"
- 接手老页面想理清结构

## 输入

```
/refactor-page <page directory or single file>

可选附加：
  --plan-only        只输出拆分方案，不修改代码
  --pure-components  只抽纯展示组件，不动数据层
```

## 工作流

### Step 1：摸清现状

不要直接动手。先输出一份"现状报告"：

```markdown
## 现状报告

文件：`src/pages/<Name>/<file>`
总行数：X
判定：<符合 / 部分符合 / 不符合> 四层架构

### 各职责当前混在哪里
| 职责 | 当前位置 | 应该归到 |
|---|---|---|
| API 调用 | `index.tsx` 第 50–80 行 | 业务 Hook `useXxx` |
| 列表筛选 state | `index.tsx` 第 30–45 行 | 区域组件 `XxxFilterPanel` 内部 |
| 表格渲染 | `index.tsx` 第 200–350 行 | 区域组件 `XxxListPanel` |
| 单行卡片 | `index.tsx` 第 380–450 行 | 纯展示 `XxxCard` (memo) |
| ... | ... | ... |

### 跨区域共享状态
- `selectedId` — 列表选择，详情区使用 → 留在入口 useState

### 风险点
- <比如：当前有 useEffect 依赖 setState 派生数据，拆分时容易引入死循环>
- <比如：某 useState 实际上是 zustand store 重复了，应一并清理>
```

**等用户确认拆分方案后**再进入 Step 2。除非用户明确指定 `--no-confirm`。

### Step 2：制定拆分顺序

按依赖关系**从底向上**拆，每步都能跑：

1. **types** — 抽页面级共享类型到 `types.ts`
2. **业务 Hook** — 把 fetch + state + actions 抽到 `hooks/use<Domain>.ts`，原文件改为调用 hook
3. **纯展示组件** — 一次抽一个，加 `memo()`，原文件改为引用
4. **区域组件** — 把大块 JSX + 局部 state（排序、搜索）抽到 `components/<Region>Panel.tsx`
5. **入口收尾** — `index.tsx` 只剩布局编排和跨区域回调

每一步完成后**单独提交**（一步一 commit），让回滚容易。

### Step 3：逐步抽取

对每一步：

1. 先输出"将要创建的新文件清单 + 入口文件预期变化"
2. 创建新文件
3. 改造原文件以引用新文件
4. **必须保留原行为**：不顺手"改逻辑、改命名、删 dead code"——那是另一个重构
5. 提交 commit，commit message 描述本步动作

### Step 4：完成后做对比

输出最终对比：

```markdown
## 重构结果

| 维度 | 改动前 | 改动后 |
|---|---|---|
| 入口行数 | 480 | 95 |
| 文件数 | 1 | 7 |
| 业务 Hook 数 | 0 | 2 |
| memo 包裹的纯展示组件数 | 0 | 4 |

### 已知未做的事（留作后续 PR）
- <比如：表格列配置仍内联在 ListPanel，未来可抽到 columns.ts>
- <比如：错误处理目前还散在多处，未按 error-handling.rule 收拢>
```

## 行为约束

- **禁止"顺手"改逻辑**：重构 = 行为不变；命名错误、潜在 bug 列在"已知未做的事"里
- **禁止一次性大改**：必须按 Step 2 的顺序一步一步抽；不要一个 commit 改 7 个文件
- **必须遵守 page-layering.rule + react-performance.rule + accessibility.rule**：纯展示组件抽出时同步加 `memo()`、`aria-label` 等；不要"先抽再补"
- **保留原命名风格**：除非命名违反 typescript-conventions；不要趁机改命名
- **如果发现根本不该是个页面**（比如该是模态框、该合并到另一个页面）：在现状报告里指出，不要硬拆

## 与 /code-review 的关系

| 场景 | 用什么 |
|---|---|
| 想知道"这页面写得怎么样" | `/code-review` |
| 想把"写歪的页面"重新摆正 | `/refactor-page` |

**典型流程**：先 `/code-review` 看体检报告 → 决定要重构 → `/refactor-page`
