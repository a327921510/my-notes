---
name: add-zustand-store
description: 在 apps/web 的 stores/ 下新建 Zustand 全局 Store。当用户需要为 Web 端添加全局状态、跨页面共享数据时使用。仅适用于 apps/web。
---

# 新建 Zustand Store（Web 端）

在 `apps/web/src/stores/` 下创建按业务域拆分的全局 Store。

> **适用范围**：仅用于 `apps/web`。扩展端（`apps/extension`）使用 `useState` + Dexie（`useLiveQuery`）管理状态，不使用 Zustand。

---

## 前置判断

在创建之前，先确认该状态是否真的需要全局 Store：

| 适合全局 Store | 不适合（用页面级 Hook） |
|--------------|----------------------|
| 用户认证、权限 | 页面列表数据 |
| 全局配置（主题、语言） | 表单状态 |
| 全局通知/消息 | 筛选条件 |
| 跨页面共享的状态 | 弹窗开关、hover |

如果状态只在一个页面内使用，应该用页面级业务 Hook，不要创建 Store。

---

## 生成流程

### Step 1：确认信息

```
业务域: <如 auth, settings, notification>
状态字段: <列出需要管理的字段>
是否需要持久化: <是 / 否>
```

### Step 2：生成文件

创建 `apps/web/src/stores/use<Domain>Store.ts`：

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";  // 仅持久化时需要

type XxxState = {
  // 状态字段
  field: string | null;

  // 同步 action
  setField: (val: string) => void;
  clear: () => void;
};

export const useXxxStore = create<XxxState>()(
  persist(
    (set) => ({
      field: null,
      setField: (val) => set({ field: val }),
      clear: () => set({ field: null }),
    }),
    { name: "xxx-v1" },
  ),
);
```

### Step 3：输出使用示例

```typescript
// 使用 selector 精确订阅（必须）
const field = useXxxStore((s) => s.field);
const setField = useXxxStore((s) => s.setField);

// 在非 React 环境获取状态（如 Axios 拦截器）
const field = useXxxStore.getState().field;
```

---

## 规则（必须遵守）

- 命名：`use<Domain>Store`
- 一个文件一个 Store，按业务域拆分
- Store 中只有状态 + 同步 action，异步逻辑放业务 Hook
- 使用 selector 精确订阅，禁止整体解构
- 需要持久化时使用 `persist` 中间件，key 带版本号（如 `auth-v1`）
- 禁止在 Store 中 import React 组件
