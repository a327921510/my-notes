---
name: add-route
description: 在 apps/web 中注册新路由并创建页面入口文件。当用户需要为 Web 端添加新页面路由时使用。仅适用于 apps/web。
---

# 注册新路由（Web 端）

将新页面注册到 `apps/web/src/router/routes.tsx` 并创建页面入口骨架。

> **适用范围**：仅用于 `apps/web`。扩展端（`apps/extension`）为单页 popup，无客户端路由。

---

## 生成流程

### Step 1：确认信息

```
页面名称: <PascalCase，如 UserManagement>
路由路径: <kebab-case，如 /user-management>
是否嵌套在 MainLayout 下: <是 / 否>
```

### Step 2：创建页面入口

如果页面文件不存在，创建 `apps/web/src/pages/<PageName>/index.tsx`：

```tsx
export function <PageName>Page() {
  return (
    <div>
      <h1><PageName></h1>
    </div>
  );
}

export default <PageName>Page;
```

### Step 3：注册路由

在 `apps/web/src/router/routes.tsx` 中添加：

```tsx
// 1. 添加 lazy import
const <PageName> = lazy(() => import("@/pages/<PageName>"));

// 2. 在对应的 children 数组中添加路由项
{ path: "<kebab-path>", element: <<PageName> /> }
```

### Step 4：输出确认

告知用户：
1. 页面文件位置
2. 路由路径
3. 如何在四层架构下继续开发这个页面（添加 hooks/、components/ 等）

---

## 规则（必须遵守）

- 路由路径用 kebab-case
- 页面组件用 `React.lazy()` 懒加载
- 页面入口同时有命名导出和默认导出
- 新页面默认嵌套在 `MainLayout` 下（除非明确指定）
- `apps/web/src/router/routes.tsx` 是路由的唯一注册入口，不在其他地方定义路由
