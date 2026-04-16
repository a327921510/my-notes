---
name: generate-page
description: 在 apps/web 中按四层架构（页面入口 / 区域组件 / 业务 Hooks / 纯展示组件）生成 React + TypeScript 页面脚手架。当用户需要为 Web 端新建页面、生成页面代码、或提到"四层架构"时使用。仅适用于 apps/web。
---

# 按四层架构生成 React 页面（Web 端）

前置条件：项目中已有 `.cursor/rules/page-layering.rule.mdc`（架构约束规则）。
完整代码示例与层间通信模式详见 `references/page-layering-guide.md`。

> **适用范围**：仅用于 `apps/web`。扩展端（`apps/extension`）为单文件 popup，不适用四层页面架构。

---

## 生成流程

当用户描述一个页面需求时，按以下步骤执行：

### Step 1：需求分析

从用户描述中提取以下信息，输出为结构化摘要：

```
页面名称: <PascalCase>
路由路径: <建议值>
页面布局: <描述大致布局，如"左侧列表 + 右侧详情"、"顶部筛选栏 + 中间表格 + 底部分页">
区域划分:
  - 区域A: <名称> — <职责简述>
  - 区域B: <名称> — <职责简述>
  - ...
数据域:
  - <Domain1>: <涉及的数据实体和操作>
  - <Domain2>: <涉及的数据实体和操作>
跨区域状态:
  - <state1>: <哪些区域需要共享>
  - <state2>: <哪些区域需要共享>
```

**等用户确认后**再进入 Step 2（除非用户明确要求直接生成）。

### Step 2：生成目录结构

输出将要创建的文件列表：

```
apps/web/src/pages/<PageName>/
├── index.tsx
├── types.ts                    # 如有页面级共享类型
├── components/
│   ├── <RegionA>Panel.tsx
│   ├── <RegionB>Panel.tsx
│   ├── <PureWidget>View.tsx
│   └── ...
└── hooks/
    ├── use<DomainA>.ts
    ├── use<DomainB>.ts
    └── ...
```

### Step 3：逐文件生成代码

**生成顺序**（依赖关系从底到顶）：

1. `types.ts` — 页面级类型定义
2. `hooks/use<Domain>.ts` — 业务 Hooks（最底层，无 UI 依赖）
3. `components/<Pure>View.tsx` — 纯展示组件（只依赖 types）
4. `components/<Region>Panel.tsx` — 区域组件（依赖 hooks + 纯展示）
5. `index.tsx` — 页面入口（组装一切）

### Step 4：输出路由注册提示

告知用户如何在路由配置中注册新页面（示例）。

---

## 生成规则（必须遵守）

### 页面入口 (index.tsx)
- 导出命名组件 `export function <PageName>Page()` 并追加 `export default <PageName>Page`（路由 `lazy()` 需要默认导出）
- 调用业务 Hooks 获取 `state + actions`
- 持有跨区域共享状态（`useState` / `useRef`）
- 将数据和回调通过 props 传给区域组件和纯展示组件
- **传给子组件的回调必须用 `useCallback` 包裹**（否则 memo 子组件每次都重渲染）
- **传给子组件的派生对象/数组用 `useMemo` 包裹**（保持引用稳定）
- JSX 中只做布局编排，不写复杂渲染逻辑
- 如需跨区域联动，在此中转（区域 A 的回调 → 更新共享状态 → 区域 B 通过 props 接收）

### 区域组件 (<Region>Panel.tsx)
- 导出命名组件，Props 类型紧跟在 import 后面导出
- 内部可调用本页 `hooks/` 下的业务 Hook
- 内部可拥有局部 UI 状态（折叠、排序、搜索词等）
- 对外只通过 `onXxxChange` / `onRegisterActions` 等回调通信
- 不 import 其他区域组件的内部模块
- 传给内部 memo 纯展示组件的回调用 `useCallback` 包裹

### 业务 Hooks (use<Domain>.ts)
- 导出自定义 Hook 函数
- 内部管理：API 调用、数据状态、loading/error、缓存、业务计算
- 返回结构：`{ data/state 相关, action 函数, loading?, error? }`
- **返回的 action 函数必须用 `useCallback` 包裹**（保持引用稳定，让调用方的 memo/effect 正常工作）
- 不包含任何 JSX
- 不 import React 组件
- 不操作 DOM

### 纯展示组件 (<Widget>View.tsx)
- **必须用 `memo()` 包裹**，避免父组件状态变化导致无意义重渲染
- `memo()` 内使用具名函数（`memo(function XxxView() {})`），不用匿名箭头函数
- 导出方式：`export const XxxView = memo(function XxxView(...) { ... })`
- Props 类型紧跟在 import 后面导出
- 只使用 props，不调用 hooks（`useState` 控制纯 UI 状态除外，如 tooltip 开关）
- 不调用 API / 数据库 / 全局 store
- 通过 `onXxx` props 向上报告事件

### 类型文件 (types.ts)
- 只放被 ≥2 个文件引用的页面级类型
- 单文件内部用的类型就近定义

---

## 代码风格要求

- TypeScript strict mode
- 函数组件 + 命名导出（`export function`）
- 页面入口额外追加 `export default`（路由 `React.lazy()` 需要），其他组件/Hook 不加
- Props 类型与组件同文件，使用 `type` 定义并 `export`
- 纯展示组件必须用 `memo()` 包裹（详见 `react-performance.rule.mdc`）
- `useCallback`：传给 `memo` 子组件的回调、业务 Hook 返回的 action 函数
- `useMemo`：传给 `memo` 子组件的派生对象/数组、昂贵计算（大列表排序/过滤）
- `memo` + `useCallback` 必须成对使用——只用其中一个，另一个就白费
- 注释只在不明显的地方写，不写废话注释
- UI 库按项目实际情况选择（本项目为 **Ant Design 6.x** + `@ant-design/icons` v6；生成时询问或根据 package.json 的 `antd` 主版本推断）

---

## 复杂场景的处理模式

### 模式 1：区域注册操作（跨区调用内部方法）

当区域 B 需要触发区域 A 的内部操作（如"删除选中项"由详情区触发，但列表在区域 A 内部）：

```tsx
// 入口
const actionsRef = useRef<{ removeSelected: () => void }>({ removeSelected: () => {} });

<RegionA onRegisterActions={(a) => { actionsRef.current = a; }} />
<RegionB onDeleteSelected={() => actionsRef.current.removeSelected()} />
```

### 模式 2：多 Hook 组合

当页面涉及多个数据域时，在入口中组合多个 Hooks：

```tsx
// 入口
const { projects, createProject } = useProjects();
const { tasks, moveTask } = useTasks(selectedProjectId);
const { members } = useMembers(selectedProjectId);
```

### 模式 3：表单区域

表单作为区域组件，内部管理表单状态，通过 `onSubmit` 回调对外：

```tsx
<OrderFormPanel
  initialValues={selectedOrder}
  onSubmit={async (values) => { await updateOrder(values); }}
  onCancel={() => setEditing(false)}
/>
```

### 模式 4：Optimistic Update

在业务 Hook 中处理乐观更新，组件层无需关心：

```tsx
// hooks/useOrders.ts
const deleteOrder = useCallback(async (id: string) => {
  setOrders(prev => prev.filter(o => o.id !== id)); // optimistic
  try {
    await api.deleteOrder(id);
  } catch {
    await refetch(); // rollback
  }
}, [refetch]);
```

---

## 输出格式

每个文件使用以下格式输出：

```
📄 <文件路径>
```

```tsx
// 完整文件代码
```

在所有文件输出完成后，给出：
1. **路由注册示例**
2. **文件依赖关系图**（文字版）
3. **可选增强建议**（如哪些部分可以进一步拆分、哪些可以加单元测试）
