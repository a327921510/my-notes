# React 页面四层架构 — 完整开发指南

> 本文档自包含，可独立于任何特定项目使用。配合 `page-layering.rule.mdc`（Cursor AI 规则）和 `generate-page.skill.md`（生成技能）使用效果最佳。

---

## 目录

- [1. 为什么需要分层](#1-为什么需要分层)
- [2. 四层定义](#2-四层定义)
- [3. 完整代码示例：项目管理页](#3-完整代码示例项目管理页)
- [4. 层间通信模式详解](#4-层间通信模式详解)
- [5. 反模式与修正](#5-反模式与修正)
- [6. 从简单到复杂的演进路径](#6-从简单到复杂的演进路径)
- [7. FAQ](#7-faq)

---

## 1. 为什么需要分层

| 问题 | 不分层时的表现 | 分层后的改善 |
|------|-------------|-------------|
| 文件过长 | 单文件 800+ 行，搜索困难 | 每个文件 50–200 行，职责单一 |
| 改 UI 牵动数据 | 调整列表布局导致 API 调用逻辑报错 | UI 和数据分离，改一边不影响另一边 |
| 无法独立测试 | 测试一个展示组件需要 mock 整个 API | 纯展示组件传 props 即可测试 |
| 区域间纠缠 | 左侧面板直接读写右侧面板的状态 | 区域通过入口中转，接口最小化 |
| 逻辑重复 | 3 个组件各写一套相同的 CRUD 逻辑 | 业务 Hook 统一实现，多处调用 |

---

## 2. 四层定义

### 2.1 页面入口 (Page Entry)

**一句话**：页面的"总指挥"，只做编排，不做具体渲染和数据操作。

- **文件位置**：`src/pages/<PageName>/index.tsx`
- **持有**：跨区域共享状态、路由参数、权限判断
- **调用**：业务 Hooks（获取 state + actions）
- **传递**：通过 props 把数据和回调分发给各区域组件和纯展示组件
- **不做**：大段 JSX、直接的 API 调用、DOM 操作

### 2.2 区域组件 (Regional Block)

**一句话**：页面上一整块相对独立的 UI 区域，对内自治，对外接口最小。

- **文件位置**：`src/pages/<PageName>/components/<Region>Panel.tsx`
- **内部**：管理区域内的 UI 状态（选中、排序、搜索、展开折叠）
- **可调用**：本页 `hooks/` 下的业务 Hook（保持数据操作契约集中）
- **对外**：只通过 `onXxxChange` 等 props 回调与入口通信
- **不做**：编排其他区域的逻辑、直接修改其他区域的状态

### 2.3 业务 Hooks (Business Hooks)

**一句话**：与 UI 无关的数据操作和业务规则，暴露 state + actions。

- **文件位置**：`src/pages/<PageName>/hooks/use<Domain>.ts`
- **内部**：API 调用、数据状态管理、loading/error、缓存、业务计算、乐观更新
- **暴露**：`{ state 属性, action 函数, loading?, error? }`
- **不做**：import 组件、操作 DOM、关心布局

### 2.4 纯展示组件 (Presentation)

**一句话**：给什么 props 就渲染什么，通过回调报告事件。**必须用 `memo` 包裹。**

- **文件位置**：`src/pages/<PageName>/components/<Widget>View.tsx`
- **必须**：用 `memo()` 包裹组件（避免父组件状态变化导致无意义重渲染）
- **只用**：props（允许内部 `useState` 管理纯 UI 状态如 tooltip、hover）
- **不做**：调用 API、读写数据库、调用业务 Hook、读全局 store

---

## 3. 完整代码示例：项目管理页

一个包含「项目列表」「项目详情」「成员面板」的三栏管理页。

### 3.0 目录结构

```
src/pages/ProjectManagement/
├── index.tsx                        # 页面入口
├── types.ts                         # 页面级共享类型
├── components/
│   ├── ProjectListPanel.tsx         # 区域组件：左侧项目列表
│   ├── ProjectDetailPanel.tsx       # 区域组件：中间项目详情
│   ├── MemberSidebar.tsx            # 区域组件：右侧成员栏
│   ├── ProjectCard.tsx              # 纯展示：项目卡片
│   ├── MemberAvatar.tsx             # 纯展示：成员头像
│   └── EmptyPlaceholder.tsx         # 纯展示：空状态
└── hooks/
    ├── useProjects.ts               # 业务 Hook：项目 CRUD
    ├── useMembers.ts                # 业务 Hook：成员管理
    └── useSelection.ts              # 业务 Hook：选中状态
```

### 3.1 types.ts

```tsx
export type Project = {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "draft";
  createdAt: string;
  memberIds: string[];
};

export type Member = {
  id: string;
  name: string;
  avatar: string;
  role: "owner" | "admin" | "member";
};

export type ProjectFilters = {
  search: string;
  status: Project["status"] | "all";
};
```

### 3.2 hooks/useProjects.ts

```tsx
import { useCallback, useEffect, useState } from "react";
import type { Project, ProjectFilters } from "../types";

const API_BASE = "/api/projects";

export function useProjects(filters: ProjectFilters) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (f: ProjectFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f.search) params.set("search", f.search);
      if (f.status !== "all") params.set("status", f.status);
      const res = await fetch(`${API_BASE}?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Project[] = await res.json();
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(filters);
  }, [fetchProjects, filters]);

  const createProject = useCallback(async (name: string, description: string) => {
    const res = await fetch(API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const created: Project = await res.json();
    setProjects((prev) => [created, ...prev]);
    return created;
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    } catch {
      await fetchProjects(filters);
    }
  }, [fetchProjects, filters]);

  const updateProject = useCallback(async (id: string, patch: Partial<Project>) => {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const updated: Project = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  return { projects, loading, error, createProject, deleteProject, updateProject };
}
```

### 3.3 hooks/useMembers.ts

```tsx
import { useCallback, useEffect, useState } from "react";
import type { Member } from "../types";

export function useMembers(projectId: string | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    fetch(`/api/projects/${projectId}/members`)
      .then((r) => r.json())
      .then((data: Member[]) => setMembers(data))
      .finally(() => setLoading(false));
  }, [projectId]);

  const addMember = useCallback(
    async (memberId: string) => {
      if (!projectId) return;
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const added: Member = await res.json();
      setMembers((prev) => [...prev, added]);
    },
    [projectId],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (!projectId) return;
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      });
    },
    [projectId],
  );

  return { members, loading, addMember, removeMember };
}
```

### 3.4 hooks/useSelection.ts

```tsx
import { useCallback, useState } from "react";

export function useSelection<T extends string = string>(initial: T | null = null) {
  const [selectedId, setSelectedId] = useState<T | null>(initial);

  const select = useCallback((id: T | null) => {
    setSelectedId(id);
  }, []);

  const clear = useCallback(() => {
    setSelectedId(null);
  }, []);

  return { selectedId, select, clear };
}
```

### 3.5 components/ProjectCard.tsx（纯展示，memo 包裹）

```tsx
import { memo } from "react";
import type { Project } from "../types";

export type ProjectCardProps = {
  project: Project;
  isSelected: boolean;
  onClick: () => void;
};

const STATUS_COLORS: Record<Project["status"], string> = {
  active: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
  draft: "bg-yellow-100 text-yellow-800",
};

export const ProjectCard = memo(function ProjectCard({
  project,
  isSelected,
  onClick,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer rounded-lg border p-3 transition-all
        ${isSelected ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-200 hover:border-gray-300"}
      `}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{project.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[project.status]}`}>
          {project.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{project.description}</p>
      <div className="mt-2 text-xs text-gray-400">{project.memberIds.length} members</div>
    </div>
  );
});
```

### 3.6 components/MemberAvatar.tsx（纯展示，memo 包裹）

```tsx
import { memo } from "react";
import type { Member } from "../types";

export type MemberAvatarProps = {
  member: Member;
  onRemove?: () => void;
};

export const MemberAvatar = memo(function MemberAvatar({ member, onRemove }: MemberAvatarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-50">
      <img src={member.avatar} alt={member.name} className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">{member.name}</div>
        <div className="text-xs text-gray-500">{member.role}</div>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 text-xs">
          ✕
        </button>
      )}
    </div>
  );
});
```

### 3.7 components/EmptyPlaceholder.tsx（纯展示，memo 包裹）

```tsx
import { memo } from "react";

export type EmptyPlaceholderProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export const EmptyPlaceholder = memo(function EmptyPlaceholder({
  icon = "📋",
  title,
  description,
  action,
}: EmptyPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          {action.label}
        </button>
      )}
    </div>
  );
});
```

### 3.8 components/ProjectListPanel.tsx（区域组件）

```tsx
import { useCallback, useMemo, useState } from "react";
import type { Project, ProjectFilters } from "../types";
import { ProjectCard } from "./ProjectCard";

export type ProjectListPanelProps = {
  projects: Project[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, description: string) => Promise<Project>;
  filters: ProjectFilters;
  onFiltersChange: (filters: ProjectFilters) => void;
};

export function ProjectListPanel({
  projects,
  loading,
  selectedId,
  onSelect,
  onCreate,
  filters,
  onFiltersChange,
}: ProjectListPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const created = await onCreate(newName.trim(), "");
    setNewName("");
    setIsCreating(false);
    onSelect(created.id);
  }, [newName, onCreate, onSelect]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.status !== "all" && p.status !== filters.status) return false;
      if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
  }, [projects, filters]);

  return (
    <div className="flex h-full flex-col">
      {/* 搜索栏 */}
      <div className="border-b p-3">
        <input
          type="text"
          placeholder="Search projects..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-full rounded-md border px-3 py-1.5 text-sm"
        />
        <div className="mt-2 flex gap-1">
          {(["all", "active", "draft", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => onFiltersChange({ ...filters, status: s })}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                filters.status === s ? "bg-blue-100 text-blue-800" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* 项目列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">Loading...</div>
        ) : (
          filteredProjects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isSelected={p.id === selectedId}
              onClick={() => onSelect(p.id)}
            />
          ))
        )}
      </div>

      {/* 新建 */}
      <div className="border-t p-3">
        {isCreating ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Project name"
              className="flex-1 rounded-md border px-2 py-1 text-sm"
            />
            <button onClick={handleCreate} className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white">
              OK
            </button>
            <button onClick={() => setIsCreating(false)} className="text-sm text-gray-500">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full rounded-md border border-dashed py-1.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
          >
            + New Project
          </button>
        )}
      </div>
    </div>
  );
}
```

### 3.9 components/ProjectDetailPanel.tsx（区域组件）

```tsx
import { useCallback, useState } from "react";
import type { Project } from "../types";
import { EmptyPlaceholder } from "./EmptyPlaceholder";

export type ProjectDetailPanelProps = {
  project: Project | null;
  onUpdate: (id: string, patch: Partial<Project>) => Promise<Project>;
  onDelete: (id: string) => Promise<void>;
};

export function ProjectDetailPanel({ project, onUpdate, onDelete }: ProjectDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const startEdit = useCallback(() => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description);
    setIsEditing(true);
  }, [project]);

  const handleSave = useCallback(async () => {
    if (!project) return;
    await onUpdate(project.id, { name: editName, description: editDesc });
    setIsEditing(false);
  }, [project, editName, editDesc, onUpdate]);

  if (!project) {
    return (
      <EmptyPlaceholder
        icon="👈"
        title="Select a project"
        description="Choose a project from the list to view its details"
      />
    );
  }

  return (
    <div className="p-6">
      {isEditing ? (
        <div className="space-y-3">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-lg font-semibold"
          />
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm text-white">
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex gap-2">
              <button onClick={startEdit} className="rounded-md bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200">
                Edit
              </button>
              <button
                onClick={() => onDelete(project.id)}
                className="rounded-md bg-red-50 px-3 py-1 text-sm text-red-600 hover:bg-red-100"
              >
                Delete
              </button>
            </div>
          </div>
          <p className="mt-4 text-gray-600">{project.description || "No description"}</p>
          <div className="mt-6 flex gap-4 text-sm text-gray-500">
            <span>Status: {project.status}</span>
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            <span>{project.memberIds.length} members</span>
          </div>
        </>
      )}
    </div>
  );
}
```

### 3.10 components/MemberSidebar.tsx（区域组件）

```tsx
import { useState } from "react";
import type { Member } from "../types";
import { MemberAvatar } from "./MemberAvatar";

export type MemberSidebarProps = {
  members: Member[];
  loading: boolean;
  onAdd: (memberId: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
};

export function MemberSidebar({ members, loading, onAdd, onRemove }: MemberSidebarProps) {
  const [showInvite, setShowInvite] = useState(false);
  const [inviteId, setInviteId] = useState("");

  const handleInvite = async () => {
    if (!inviteId.trim()) return;
    await onAdd(inviteId.trim());
    setInviteId("");
    setShowInvite(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-700">Members ({members.length})</h3>
        <button onClick={() => setShowInvite(!showInvite)} className="text-xs text-blue-600 hover:underline">
          + Invite
        </button>
      </div>

      {showInvite && (
        <div className="flex gap-1 border-b p-2">
          <input
            autoFocus
            value={inviteId}
            onChange={(e) => setInviteId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            placeholder="Member ID"
            className="flex-1 rounded border px-2 py-1 text-xs"
          />
          <button onClick={handleInvite} className="rounded bg-blue-600 px-2 py-1 text-xs text-white">
            Add
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center text-xs text-gray-400 py-4">Loading...</div>
        ) : (
          members.map((m) => (
            <MemberAvatar key={m.id} member={m} onRemove={() => onRemove(m.id)} />
          ))
        )}
      </div>
    </div>
  );
}
```

### 3.11 index.tsx（页面入口）

```tsx
import { useCallback, useMemo, useState } from "react";
import type { ProjectFilters } from "./types";
import { useProjects } from "./hooks/useProjects";
import { useMembers } from "./hooks/useMembers";
import { useSelection } from "./hooks/useSelection";
import { ProjectListPanel } from "./components/ProjectListPanel";
import { ProjectDetailPanel } from "./components/ProjectDetailPanel";
import { MemberSidebar } from "./components/MemberSidebar";

export function ProjectManagementPage() {
  // --- 业务 Hooks ---
  const [filters, setFilters] = useState<ProjectFilters>({ search: "", status: "all" });
  const { projects, loading, createProject, deleteProject, updateProject } = useProjects(filters);
  const { selectedId, select, clear } = useSelection<string>();
  const { members, loading: membersLoading, addMember, removeMember } = useMembers(selectedId);

  // --- 跨区域派生数据（useMemo 保持引用稳定，避免 memo 子组件重渲染）---
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  // --- 跨区域联动回调（useCallback 保持引用稳定）---
  const handleDelete = useCallback(async (id: string) => {
    await deleteProject(id);
    if (selectedId === id) clear();
  }, [deleteProject, selectedId, clear]);

  // --- 布局编排 ---
  return (
    <div className="flex h-screen">
      {/* 左栏：项目列表 */}
      <div className="w-72 flex-shrink-0 border-r bg-gray-50">
        <ProjectListPanel
          projects={projects}
          loading={loading}
          selectedId={selectedId}
          onSelect={select}
          onCreate={createProject}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </div>

      {/* 中栏：项目详情 */}
      <div className="flex-1 overflow-y-auto">
        <ProjectDetailPanel
          project={selectedProject}
          onUpdate={updateProject}
          onDelete={handleDelete}
        />
      </div>

      {/* 右栏：成员 */}
      {selectedProject && (
        <div className="w-60 flex-shrink-0 border-l">
          <MemberSidebar
            members={members}
            loading={membersLoading}
            onAdd={addMember}
            onRemove={removeMember}
          />
        </div>
      )}
    </div>
  );
}
```

---

## 4. 层间通信模式详解

### 4.1 Props 向下传递（最基本）

入口 → 区域组件 → 纯展示：数据和回调通过 props 逐层向下传递。

```
Entry ──(projects, onSelect)──> ListPanel ──(project, isSelected)──> ProjectCard
```

### 4.2 回调向上报告

纯展示 → 区域组件 → 入口：用户交互通过 `onXxx` 回调逐层向上报告。

```
ProjectCard ──onClick──> ListPanel ──onSelect──> Entry
```

### 4.3 操作注册模式（跨区域调用内部方法）

场景：区域 B（详情区）需要触发区域 A（列表区）的内部操作。

```tsx
// 入口
const listActionsRef = useRef<{ removeSelected: () => void }>({
  removeSelected: () => {},
});

// 区域 A 注册自己的操作
<ListPanel onRegisterActions={(actions) => { listActionsRef.current = actions; }} />

// 区域 B 通过入口中转调用
<DetailPanel onDelete={() => listActionsRef.current.removeSelected()} />
```

### 4.4 共享 Hook 模式

多个区域组件调用同一个业务 Hook 时，各自持有独立的 state 实例。如果需要共享同一份数据：

**方案 A**（推荐）：在入口调用 Hook，将结果通过 props 下发。

```tsx
// 入口
const ordersHook = useOrders(filters);
<ListPanel orders={ordersHook.orders} />
<StatsBar count={ordersHook.orders.length} />
```

**方案 B**：当 props 链太长时，使用页面级 Context（仍在入口创建 Provider）。

```tsx
// 入口
const ordersCtx = useOrders(filters);
return (
  <OrdersContext.Provider value={ordersCtx}>
    <ListPanel />
    <StatsBar />
  </OrdersContext.Provider>
);
```

### 4.5 表单区域模式

表单作为区域组件，内部管理表单状态（字段值、校验、dirty），对外只暴露 `onSubmit` 和 `onCancel`：

```tsx
<OrderFormPanel
  initialValues={selectedOrder}
  onSubmit={async (values) => { await updateOrder(values); setEditing(false); }}
  onCancel={() => setEditing(false)}
/>
```

### 4.6 乐观更新模式

在业务 Hook 中处理，组件层无感知：

```tsx
// hooks/useOrders.ts
const deleteOrder = useCallback(async (id: string) => {
  const snapshot = orders;
  setOrders(prev => prev.filter(o => o.id !== id));  // 立即更新 UI
  try {
    await api.deleteOrder(id);
  } catch {
    setOrders(snapshot);                               // 回滚
    toast.error("删除失败");
  }
}, [orders]);
```

---

## 5. 反模式与修正

### 5.1 纯展示组件直接调用 API

```tsx
// ❌ 错误
function UserCard({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  useEffect(() => { fetch(`/api/users/${userId}`).then(/*...*/); }, [userId]);
  return <div>{user?.name}</div>;
}

// ✅ 修正：数据由上层提供，用 memo 包裹
export const UserCard = memo(function UserCard({ user }: { user: User }) {
  return <div>{user.name}</div>;
});
```

### 5.2 区域组件之间直接通信

```tsx
// ❌ 错误：ListPanel 直接 import 并修改 DetailPanel 的状态
import { detailStore } from "../DetailPanel/store";
function ListPanel() {
  const handleClick = (id) => { detailStore.setSelected(id); };
}

// ✅ 修正：通过入口中转
function ListPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const handleClick = (id: string) => { onSelect(id); };
}
```

### 5.3 入口变成"上帝组件"

```tsx
// ❌ 错误：入口 500+ 行，塞满了表格列定义、表单校验、样式逻辑
export function OrderPage() {
  // ... 300 行状态和逻辑 ...
  return (
    <div>
      {/* ... 200 行 JSX ... */}
    </div>
  );
}

// ✅ 修正：入口只做编排，具体 UI 下沉到区域组件
export function OrderPage() {
  const { orders, deleteOrder } = useOrders();
  const { selectedId, select } = useSelection();
  return (
    <Layout>
      <OrderListPanel orders={orders} selectedId={selectedId} onSelect={select} />
      <OrderDetailPanel order={selected} onDelete={deleteOrder} />
    </Layout>
  );
}
```

### 5.4 多处重复实现同一套 CRUD

```tsx
// ❌ 错误：ListPanel 和 DetailPanel 各自写了一套 deleteOrder
// ListPanel.tsx
const handleDelete = async (id) => { await fetch(`/api/orders/${id}`, { method: "DELETE" }); ... };
// DetailPanel.tsx
const handleDelete = async (id) => { await fetch(`/api/orders/${id}`, { method: "DELETE" }); ... };

// ✅ 修正：集中到业务 Hook
// hooks/useOrders.ts
export function useOrders() {
  const deleteOrder = useCallback(async (id) => { /* 唯一实现 */ }, []);
  return { deleteOrder };
}
```

### 5.5 为避免 props 透传引入隐式全局 store

```tsx
// ❌ 错误：为了少传两层 props，把页面状态塞进全局 zustand
// 导致其他页面也能读写这个状态，产生隐式耦合

// ✅ 修正：
// - 如果层级不深（2-3 层），直接传 props
// - 如果确实很深，用页面级 Context（在入口创建 Provider，不放全局）
```

### 5.6 纯展示组件未用 memo 包裹

```tsx
// ❌ 错误：父组件任意状态变化都导致 ItemCard 重渲染
export function ItemCard({ item, onClick }: ItemCardProps) {
  return <div onClick={onClick}>{item.name}</div>;
}

// ✅ 修正：用 memo 包裹，props 不变时跳过重渲染
export const ItemCard = memo(function ItemCard({ item, onClick }: ItemCardProps) {
  return <div onClick={onClick}>{item.name}</div>;
});
```

### 5.7 传给 memo 子组件的回调未用 useCallback

```tsx
// ❌ 错误：内联箭头函数每次渲染都是新引用，memo 永远无法命中
{items.map((item) => (
  <ItemCard key={item.id} item={item} onClick={() => onSelect(item.id)} />
))}

// ✅ 修正：回调接收 id 参数 + useCallback
const handleSelect = useCallback((id: string) => onSelect(id), [onSelect]);
{items.map((item) => (
  <ItemCard key={item.id} item={item} onSelect={handleSelect} />
))}
// ItemCard 内部：onClick={() => onSelect(item.id)}
```

---

## 6. 从简单到复杂的演进路径

### 阶段 1：单文件页面（< 100 行）

```
pages/SimplePage.tsx     # 所有逻辑在一个文件
```

适合：设置页、关于页、简单展示页。

### 阶段 2：入口 + Hook（100–250 行）

```
pages/MediumPage/
├── index.tsx            # 入口 + 简单 JSX
└── hooks/useData.ts     # 数据操作抽出
```

适合：有一定数据操作但 UI 简单的页面。

### 阶段 3：入口 + Hook + 纯展示（250–500 行总量）

```
pages/RicherPage/
├── index.tsx
├── hooks/useData.ts
└── components/
    ├── DataTable.tsx     # 纯展示
    └── StatCard.tsx      # 纯展示
```

适合：数据展示类页面，有多个展示模块但无强区域划分。

### 阶段 4：完整四层（500+ 行总量）

```
pages/ComplexPage/
├── index.tsx
├── types.ts
├── hooks/
│   ├── useDataA.ts
│   └── useDataB.ts
└── components/
    ├── RegionAPanel.tsx   # 区域组件
    ├── RegionBPanel.tsx   # 区域组件
    ├── WidgetView.tsx     # 纯展示
    └── CardItem.tsx       # 纯展示
```

适合：多区域联动的复杂管理页面。

### 演进原则

- **最小侵入**：每次只拆出"当前最痛"的部分
- **先底后顶**：先抽 Hook（最独立），再抽区域组件（较独立），最后抽纯展示（最简单）
- **触发条件**：单文件超过 200 行、出现重复逻辑、团队协作需要并行开发不同区域

---

## 7. FAQ

**Q: 区域组件可以调用业务 Hook 吗？**
A: 可以。区域组件可以直接调用本页 `hooks/` 下的业务 Hook，这样"数据操作契约"仍然集中在 hooks 中，而不是散落在多个组件重复实现。

**Q: 纯展示组件内部可以用 `useState` 吗？**
A: 可以，但仅限于纯 UI 状态（tooltip 开关、hover 效果、折叠展开等）。不能用 `useState` + `useEffect` 去发 API 请求。

**Q: 什么时候需要 `types.ts`？**
A: 当一个类型被 ≥2 个文件引用时抽到 `types.ts`。只在单文件内部使用的类型就近定义。

**Q: 页面入口可以调用业务 Hook 吗？**
A: 当然可以，入口是 Hook 的主要调用者之一。入口调用 Hook 获取 state + actions，然后通过 props 分发给区域组件和纯展示组件。

**Q: 页面级 Context 什么时候用？**
A: 当 props 链确实过深（>3 层）且涉及多个区域组件需要同一份数据时。在入口创建 Provider，不要放到全局。优先考虑直接 props 传递。

**Q: 这套分层和 Redux / Zustand 冲突吗？**
A: 不冲突。如果项目用了全局状态管理，业务 Hook 内部可以调用 Zustand store 或 Redux selector。区别在于：四层分层是**页面级**的组织方式，全局状态管理是**跨页面**的数据共享方案，两者正交。

**Q: 纯展示组件为什么必须用 `memo` 包裹？**
A: 纯展示组件只依赖 props 渲染，不产生任何副作用。当父组件因为其他状态变化而重渲染时，如果纯展示组件没有用 `memo`，即使它的 props 完全没变，React 也会重新执行它的渲染函数并 diff 其 Virtual DOM。在列表渲染、多区域联动等场景中，这些无意义的重渲染会累积成明显的卡顿。`memo` 通过浅比较 props 来跳过这些不必要的渲染。

**Q: 用了 `memo` 为什么子组件还是在重渲染？**
A: 最常见的原因是父组件传了**内联创建的对象或函数**作为 props。例如 `onClick={() => doSomething()}` 或 `style={{ marginTop: 8 }}`，每次父组件渲染都会创建新的引用，导致 `memo` 的浅比较认为 props 变了。解决方法：回调用 `useCallback` 包裹，对象用 `useMemo` 包裹或提取为模块级常量。

**Q: 是不是所有组件都应该加 `memo`？**
A: 不是。`memo` 适合纯展示组件和列表项组件。页面入口组件不需要（它本身就是重渲染的起源）。非常轻量的组件（只有 1-2 个 DOM 节点、没有复杂计算）也不一定需要，因为 `memo` 本身的浅比较也有开销。关键是：**先识别性能瓶颈（列表、高频更新场景），再有针对性地优化**。
