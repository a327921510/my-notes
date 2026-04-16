---
name: add-api-module
description: 在 apps/web 的 services/modules/ 下新建 API 模块。当用户需要为 Web 端添加新的后端 API 对接、创建 API 模块、或提到"API 服务"时使用。仅适用于 apps/web。
---

# 新建 API 模块（Web 端）

在 `apps/web/src/services/modules/` 下创建按业务域拆分的 API 模块。

> **适用范围**：仅用于 `apps/web`。扩展端（`apps/extension`）通过 `@my-notes/sync-client` 包进行网络请求，不使用此模式。

---

## 生成流程

### Step 1：确认信息

从用户描述中提取：

```
业务域名称: <如 user, order, product>
基础路径: <如 /api/users>
核心实体类型: <列出主要字段>
需要的操作: <列表查询 / 详情 / 创建 / 更新 / 删除 / 其他>
```

### Step 2：生成文件

创建 `apps/web/src/services/modules/<domain>.ts`，遵循以下模板：

```typescript
import { request } from "../request";

// --- 类型定义 ---

export type XxxItem = {
  id: string;
  // ... 实体字段
};

export type XxxListParams = {
  page: number;
  pageSize: number;
  // ... 筛选参数
};

// --- API 函数 ---

export const xxxApi = {
  getList: (params: XxxListParams) =>
    request.get<PaginatedResult<XxxItem>>("/xxx", { params }),

  getById: (id: string) =>
    request.get<XxxItem>(`/xxx/${id}`),

  create: (data: Omit<XxxItem, "id">) =>
    request.post<XxxItem>("/xxx", data),

  update: (id: string, data: Partial<XxxItem>) =>
    request.patch<XxxItem>(`/xxx/${id}`, data),

  delete: (id: string) =>
    request.delete(`/xxx/${id}`),
};
```

### Step 3：输出使用示例

告知用户如何在业务 Hook 中调用：

```typescript
// pages/XxxManagement/hooks/useXxxList.ts
import { xxxApi } from "@/services/modules/xxx";
```

---

## 规则（必须遵守）

- 统一使用 `apps/web/src/services/request.ts` 的 `request` 实例
- 导出一个 `xxxApi` 对象，包含所有 API 方法
- 入参和返回值必须有类型标注
- 通用响应类型使用全局 `ApiResponse<T>` 和 `PaginatedResult<T>`
- 文件中只放请求函数和类型，不放业务逻辑
- 不使用 React Hook
