# PRD：企业级 API 管理平台 — API 总览仪表盘页面

> **用途**：配合 `page-layering.rule.mdc`（规则）+ `generate-page.skill.md`（技能）+ `page-layering-guide.md`（文档），在一个从零开始的 React + TypeScript 项目中生成完整页面。

---

## 1. 产品背景

本页面是一个 **API 管理平台**的核心页面。平台用户（开发者、技术经理）通过此页面统一管理团队所有 API 端点的生命周期：查看、搜索、筛选、分组、编辑、监控健康状态、查看调用统计，以及管理版本与权限。

---

## 2. 页面布局

### 2.1 整体结构

```
┌──────────────────────────────────────────────────────────────────┐
│                        顶部工具栏 (TopToolbar)                    │
│  [搜索框] [状态筛选] [分组方式下拉] [排序下拉]    [+ 新建API] [导出] │
├────────────┬─────────────────────────────────┬───────────────────┤
│            │                                 │                   │
│   左侧栏    │         中间主区域               │     右侧栏        │
│  (240px)   │       (flex-1, 自适应)           │    (320px)        │
│            │                                 │                   │
│  分组导航    │   上方：统计卡片行               │  API 详情面板      │
│  树/列表    │   ┌───┐ ┌───┐ ┌───┐ ┌───┐      │                   │
│            │   │总数│ │活跃│ │异常│ │延迟│      │  · 基本信息       │
│  · 按服务   │   └───┘ └───┘ └───┘ └───┘      │  · 端点 & 方法    │
│  · 按标签   │                                 │  · 版本历史       │
│  · 按状态   │   中间：API 列表表格             │  · 权限配置       │
│  · 收藏夹   │   ┌─────────────────────────┐   │  · 健康状态图表   │
│            │   │ 可排序 / 可分页 / 可选中  │   │  · 操作按钮组     │
│  快速统计   │   │ 行内快捷操作             │   │                   │
│  饼图      │   │ 批量操作工具栏           │   │                   │
│            │   └─────────────────────────┘   │                   │
│            │                                 │                   │
│            │   下方：调用趋势图(可折叠)        │                   │
│            │   ┌─────────────────────────┐   │                   │
│            │   │  折线图：7天/30天/自定义  │   │                   │
│            │   └─────────────────────────┘   │                   │
├────────────┴─────────────────────────────────┴───────────────────┤
│                        状态栏 (StatusBar)                         │
│  最后同步: 12:34:56  ·  共 248 个 API  ·  12 异常  ·  自动刷新:ON  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 响应式行为

- **≥ 1440px**：三栏全部展示
- **1024–1439px**：左侧栏可折叠为图标模式（48px）；右侧详情面板变为抽屉（Drawer）
- **< 1024px**：不在本 PRD 范围（本页面为 PC 端专用）

---

## 3. 功能模块详细设计

### 3.1 左侧栏：分组导航 (GroupNavigator)

**类型**：区域组件

#### 3.1.1 分组模式

用户可切换以下分组方式（Tab 或下拉切换）：

| 分组方式 | 树结构 | 说明 |
|---------|--------|------|
| 按服务 (By Service) | `服务名 > API列表` | 每个微服务下的 API 端点 |
| 按标签 (By Tag) | `标签名 > API列表` | 多标签，一个 API 可属于多个标签 |
| 按状态 (By Status) | `状态名 > API列表` | active / deprecated / draft / error |
| 收藏夹 (Favorites) | 扁平列表 | 用户收藏的 API |

#### 3.1.2 树节点行为

- 展开/折叠（点击箭头或双击节点名）
- 单击选中分组 → 中间表格过滤为该分组下的 API
- 右键菜单：重命名分组、删除分组（仅自定义标签）、全选该组 API
- 每个分组节点右侧显示 API 数量 badge
- 支持拖拽排序（仅收藏夹模式）

#### 3.1.3 快速统计饼图

左侧栏底部显示一个小型饼图：
- 按当前分组模式展示各分组的 API 数量占比
- 点击饼图扇区 = 点击对应分组节点

#### 3.1.4 折叠模式

- 折叠按钮（chevron）在左侧栏顶部
- 折叠后只显示分组模式图标，hover 显示 tooltip
- 折叠状态持久化到 localStorage

---

### 3.2 顶部工具栏 (TopToolbar)

**类型**：区域组件

#### 3.2.1 搜索

- 实时搜索（debounce 300ms）
- 搜索范围：API 名称、路径、描述、标签
- 搜索时高亮匹配文本（在表格中）
- 支持高级搜索语法：
  - `method:GET` — 按 HTTP 方法
  - `status:active` — 按状态
  - `service:user-service` — 按服务
  - `tag:payment` — 按标签
  - `latency:>500` — 按平均延迟（ms）

#### 3.2.2 状态筛选

- 多选按钮组（Checkbox Group）：Active / Deprecated / Draft / Error
- 默认全选
- 选择变化时实时过滤表格

#### 3.2.3 分组方式

- 下拉选择，与左侧栏的分组模式联动
- 选项同 3.1.1

#### 3.2.4 排序

- 下拉选择：
  - 名称 A-Z / Z-A
  - 最后更新时间（近→远 / 远→近）
  - 调用量（高→低 / 低→高）
  - 平均延迟（低→高 / 高→低）
  - 错误率（高→低 / 低→高）

#### 3.2.5 操作按钮

- **新建 API**：打开新建对话框（Modal）
  - 字段：名称、路径（如 `/api/v1/users`）、HTTP 方法（多选）、所属服务（下拉）、标签（多选/可新建）、描述（富文本）
  - 校验：路径格式校验（以 `/` 开头）、名称必填、方法至少选一个
  - 提交后自动选中新建的 API
- **导出**：导出当前筛选结果
  - 格式选项：JSON / CSV / OpenAPI Spec (YAML)
  - 下拉菜单选择格式后触发下载

---

### 3.3 中间主区域：统计卡片行 (StatsRow)

**类型**：纯展示组件

四张统计卡片，水平排列：

| 卡片 | 数值 | 辅助信息 | 颜色 |
|------|------|---------|------|
| API 总数 | `248` | 较上周 +12 ↑ | 蓝色 |
| 活跃 API | `201` | 占比 81.0% | 绿色 |
| 异常 API | `12` | 较昨日 +3 ↑ | 红色（数值增加时闪烁动画） |
| 平均延迟 | `156ms` | P95: 420ms | 黄色（> 300ms 时变红） |

- 点击卡片 = 快速筛选（如点击"异常 API"自动筛选 status=error）
- 卡片支持骨架屏加载态

---

### 3.4 中间主区域：API 列表表格 (ApiTable)

**类型**：区域组件

#### 3.4.1 列定义

| 列名 | 宽度 | 内容 | 排序 | 备注 |
|------|------|------|------|------|
| 复选框 | 40px | Checkbox | — | 用于批量操作 |
| 收藏 | 36px | ☆/★ 图标 | — | 点击切换收藏 |
| 名称 | flex | API 名称 + 路径（副标题） | ✓ | 搜索高亮 |
| 方法 | 80px | GET/POST/PUT/DELETE Badge | — | 多方法用多个 badge |
| 服务 | 120px | 服务名 | ✓ | 可点击跳转 |
| 状态 | 90px | 彩色 Tag | ✓ | active=绿, deprecated=灰, draft=蓝, error=红 |
| 调用量(24h) | 100px | 数字 + 迷你柱状图 | ✓ | 悬浮显示具体时间段数据 |
| 平均延迟 | 90px | 数字 + 颜色指示 | ✓ | <100=绿, 100-300=黄, >300=红 |
| 错误率 | 80px | 百分比 + 进度条 | ✓ | >5% 红色警告 |
| 最后更新 | 120px | 相对时间 | ✓ | tooltip 显示完整时间 |
| 操作 | 100px | 更多（…）菜单 | — | 见 3.4.3 |

#### 3.4.2 交互行为

- **行选中**：单击行高亮 → 右侧详情面板显示详情
- **多选**：Checkbox 或 Shift+Click 范围选择
- **排序**：点击列头排序（支持多列排序，Ctrl+Click 追加排序条件）
- **分页**：底部分页器，可选每页 20/50/100 条
- **虚拟滚动**：当选择"不分页"时使用虚拟滚动（数据量 > 200 时自动启用）
- **行展开**：点击行前的展开箭头，显示该 API 的最近 5 条调用记录摘要（子表格）
- **空状态**：当筛选结果为空时显示插图 + "未找到匹配的 API" + 清除筛选按钮

#### 3.4.3 行操作菜单

点击行末的 `⋯` 按钮，弹出下拉菜单：

- 编辑 — 打开编辑 Modal（字段同新建，预填当前值）
- 复制 — 复制该 API 配置为一个新的草稿 API
- 查看文档 — 新标签页打开该 API 的 Swagger 文档
- 查看日志 — 跳转到日志页面（带 API ID 参数）
- 标记废弃 / 恢复 — 切换 deprecated 状态
- 删除 — 二次确认对话框，显示影响范围（调用方数量）

#### 3.4.4 批量操作工具栏

当选中 ≥ 1 行时，表格上方出现浮动工具栏：

- 显示 "已选中 N 项"
- 操作按钮：批量标记废弃、批量删除、批量打标签、批量导出
- "取消选择" 按钮

---

### 3.5 中间主区域：调用趋势图 (TrendChart)

**类型**：区域组件（内含图表交互逻辑）

#### 3.5.1 图表内容

- **折线图**：展示 API 调用量趋势
- **双 Y 轴**：
  - 左 Y 轴：调用次数
  - 右 Y 轴：平均延迟（ms）
- **X 轴**：时间

#### 3.5.2 时间范围

- 快捷选项：最近 24 小时 / 7 天 / 30 天 / 90 天
- 自定义范围：DateRangePicker
- 切换粒度：按小时 / 按天 / 按周

#### 3.5.3 图表交互

- Hover 显示 tooltip（该时间点的调用量、延迟、错误数）
- 可切换显示/隐藏线条（图例点击）
- 支持区域缩放（鼠标框选放大）
- 当在表格中选中特定 API 时，图表高亮该 API 的趋势线（其他变灰）

#### 3.5.4 折叠

- 可通过标题栏的折叠按钮折叠整个图表区域
- 折叠状态持久化到 localStorage

---

### 3.6 右侧栏：API 详情面板 (ApiDetailPanel)

**类型**：区域组件

当表格中选中一行 API 时，右侧面板显示其详细信息。

#### 3.6.1 基本信息区

- API 名称（可行内编辑）
- 路径 + 方法 badges
- 所属服务（链接）
- 标签列表（可增删标签，带自动补全）
- 描述（可展开/折叠，Markdown 渲染）
- 创建时间、创建者、最后更新时间

#### 3.6.2 版本历史

- 时间线组件（Timeline）
- 最近 10 个版本
- 每个版本：版本号、时间、变更摘要、操作者
- 点击版本 → 弹窗显示该版本与前一版本的 diff
- "查看全部版本" 按钮

#### 3.6.3 权限配置

- 表格：谁（角色/用户）有什么权限（读/写/管理）
- 可增删权限行
- 权限变更需二次确认

#### 3.6.4 健康状态图表

- 小型面积图：最近 24 小时的成功率（绿色填充）
- 当前状态指示灯（绿/黄/红 + 文字）
- 最近 3 条告警记录

#### 3.6.5 操作按钮组

- 编辑（打开编辑 Modal）
- 测试调用（打开请求构造器 Drawer）
- 复制路径
- 查看文档
- 删除

#### 3.6.6 无选中状态

未选中任何 API 时显示：
- 引导插图
- "从左侧列表选择一个 API 查看详情"
- 快捷入口：最近查看的 3 个 API

---

### 3.7 底部状态栏 (StatusBar)

**类型**：纯展示组件

- 最后数据同步时间
- API 总数（当前筛选结果数 / 总数）
- 异常数（红色）
- 自动刷新开关（Toggle）+ 刷新间隔选择（15s / 30s / 60s / 关闭）
- 手动刷新按钮

---

### 3.8 弹窗与抽屉

#### 3.8.1 新建/编辑 API 弹窗 (ApiFormModal)

**类型**：区域组件（表单区域）

- 多步骤表单（Steps）：
  1. **基本信息**：名称、路径、方法（多选）、所属服务、描述
  2. **参数配置**：请求头（KV 列表）、Query 参数（KV + 类型 + 必填）、Body Schema（JSON Schema 编辑器或可视化构建器）
  3. **响应定义**：各状态码的响应 Schema + 示例
  4. **高级设置**：限流配置、缓存策略、超时时间、重试次数、标签
- 每步校验通过后才能进入下一步
- 支持"保存草稿"（不校验直接保存 status=draft）
- 编辑模式预填所有字段

#### 3.8.2 请求测试抽屉 (ApiTesterDrawer)

**类型**：区域组件

- 左半边：请求构造
  - 方法 + URL 预填
  - Headers 编辑（KV）
  - Query Params 编辑（KV）
  - Body 编辑（JSON 编辑器，带语法高亮）
  - 环境选择（下拉：dev / staging / prod）
- 右半边：响应展示
  - Status Code + 耗时
  - Response Headers（可折叠）
  - Response Body（JSON 格式化 + 语法高亮）
  - "保存为用例" 按钮

---

## 4. 数据模型

### 4.1 核心实体

```typescript
type ApiEndpoint = {
  id: string;
  name: string;
  path: string;
  methods: HttpMethod[];
  serviceId: string;
  serviceName: string;
  status: "active" | "deprecated" | "draft" | "error";
  tags: Tag[];
  description: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  isFavorite: boolean;
  
  // 统计信息（可从 stats 接口单独获取）
  stats: ApiStats;
  
  // 版本
  currentVersion: string;
  
  // 权限
  permissions: Permission[];
  
  // 配置
  config: ApiConfig;
};

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

type Tag = {
  id: string;
  name: string;
  color: string;
};

type ApiStats = {
  calls24h: number;
  callsTrend: number[];       // 最近 24 个点（每小时）
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;           // 0-1
  lastCallAt: string | null;
};

type Permission = {
  id: string;
  subjectType: "user" | "role" | "team";
  subjectId: string;
  subjectName: string;
  level: "read" | "write" | "admin";
};

type ApiConfig = {
  rateLimitPerMinute: number | null;
  cacheTtlSeconds: number | null;
  timeoutMs: number;
  retryCount: number;
  headers: Record<string, string>;
  queryParams: ParamDef[];
  requestBodySchema: object | null;    // JSON Schema
  responses: ResponseDef[];
};

type ParamDef = {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  defaultValue?: string;
};

type ResponseDef = {
  statusCode: number;
  description: string;
  schema: object | null;               // JSON Schema
  example: string;
};

type ApiVersion = {
  id: string;
  apiId: string;
  version: string;
  changelog: string;
  createdAt: string;
  createdBy: string;
  diff: object;                         // 与前一版本的差异
};

type Service = {
  id: string;
  name: string;
  description: string;
  apiCount: number;
};

type TrendDataPoint = {
  timestamp: string;
  calls: number;
  avgLatencyMs: number;
  errorCount: number;
};
```

### 4.2 API 接口

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 获取 API 列表 | GET | `/api/endpoints` | 支持 ?search, ?status, ?serviceId, ?tagId, ?sort, ?page, ?limit |
| 获取单个 API | GET | `/api/endpoints/:id` | 含完整 config, permissions |
| 创建 API | POST | `/api/endpoints` | |
| 更新 API | PATCH | `/api/endpoints/:id` | |
| 删除 API | DELETE | `/api/endpoints/:id` | |
| 批量操作 | POST | `/api/endpoints/batch` | body: { action, ids } |
| 获取 API 统计 | GET | `/api/endpoints/:id/stats` | |
| 获取趋势数据 | GET | `/api/endpoints/trends` | ?range, ?granularity, ?apiId |
| 获取版本历史 | GET | `/api/endpoints/:id/versions` | |
| 获取服务列表 | GET | `/api/services` | |
| 获取标签列表 | GET | `/api/tags` | |
| 创建标签 | POST | `/api/tags` | |
| 收藏/取消 | POST | `/api/endpoints/:id/favorite` | |
| 获取全局统计 | GET | `/api/dashboard/stats` | 统计卡片数据 |
| 测试调用 | POST | `/api/endpoints/:id/test` | 代理发送请求并返回结果 |
| 管理权限 | PUT | `/api/endpoints/:id/permissions` | |
| 导出 | GET | `/api/endpoints/export` | ?format=json\|csv\|openapi&ids=... |

---

## 5. 四层架构文件映射

### 5.1 建议目录结构

```
src/pages/ApiDashboard/
├── index.tsx                              # 页面入口
├── types.ts                               # 所有页面级类型定义
│
├── hooks/
│   ├── useApiEndpoints.ts                 # API 列表 CRUD + 筛选 + 分页
│   ├── useApiDetail.ts                    # 单个 API 详情 + 编辑
│   ├── useApiStats.ts                     # 全局统计卡片数据
│   ├── useApiTrends.ts                    # 趋势图数据
│   ├── useApiVersions.ts                  # 版本历史
│   ├── useApiPermissions.ts               # 权限管理
│   ├── useApiTester.ts                    # 请求测试逻辑
│   ├── useServices.ts                     # 服务列表
│   ├── useTags.ts                         # 标签列表 + CRUD
│   ├── useFavorites.ts                    # 收藏操作
│   ├── useSelection.ts                    # 单选 + 多选状态
│   └── useAutoRefresh.ts                  # 自动刷新定时器
│
├── components/
│   ├── GroupNavigator.tsx                 # 区域组件：左侧分组导航
│   ├── TopToolbar.tsx                     # 区域组件：顶部工具栏
│   ├── ApiTable.tsx                       # 区域组件：API 列表表格
│   ├── TrendChart.tsx                     # 区域组件：调用趋势图
│   ├── ApiDetailPanel.tsx                 # 区域组件：右侧详情面板
│   ├── ApiFormModal.tsx                   # 区域组件：新建/编辑弹窗
│   ├── ApiTesterDrawer.tsx                # 区域组件：请求测试抽屉
│   │
│   ├── StatsRow.tsx                       # 纯展示：统计卡片行
│   ├── StatCard.tsx                       # 纯展示：单个统计卡片
│   ├── StatusBar.tsx                      # 纯展示：底部状态栏
│   ├── MethodBadge.tsx                    # 纯展示：HTTP 方法标签
│   ├── StatusTag.tsx                      # 纯展示：状态标签
│   ├── ApiRowExpanded.tsx                 # 纯展示：表格行展开内容
│   ├── VersionTimeline.tsx                # 纯展示：版本时间线
│   ├── PermissionTable.tsx                # 纯展示：权限表格
│   ├── HealthMiniChart.tsx                # 纯展示：小型健康图表
│   ├── GroupPieChart.tsx                  # 纯展示：分组饼图
│   ├── EmptyState.tsx                     # 纯展示：空状态
│   ├── BatchActionBar.tsx                 # 纯展示：批量操作工具栏
│   └── SearchHighlight.tsx                # 纯展示：搜索高亮文本
│
└── constants.ts                           # 常量（列定义、颜色映射等）
```

### 5.2 页面入口编排要点

`index.tsx` 需要编排的**跨区域状态与联动**：

| 共享状态 | 涉及区域 | 说明 |
|---------|---------|------|
| `selectedApiId` | 表格 ↔ 详情面板 ↔ 趋势图 | 选中哪个 API |
| `selectedApiIds` (多选) | 表格 ↔ 批量操作栏 | 批量选中 |
| `filters` | 工具栏 ↔ 表格 ↔ 左侧导航 ↔ 状态栏 | 搜索 + 筛选条件 |
| `groupMode` | 工具栏 ↔ 左侧导航 | 当前分组方式 |
| `selectedGroupId` | 左侧导航 → 表格 | 当前选中的分组 |
| `formModal` (开/关/模式) | 工具栏/表格行操作 → Modal | 新建或编辑哪个 |
| `testerDrawer` (开/关/目标) | 详情面板 → Drawer | 测试哪个 API |
| `autoRefresh` | 状态栏 → 所有数据 Hook | 定时刷新开关与间隔 |

```tsx
// index.tsx 伪代码
export function ApiDashboardPage() {
  // --- 共享状态 ---
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [groupMode, setGroupMode] = useState<GroupMode>("service");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { selectedId, selectedIds, select, toggleMulti, clearAll } = useSelection();
  const [formModal, setFormModal] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [testerDrawer, setTesterDrawer] = useState<{ open: boolean; apiId?: string }>({ open: false });

  // --- 业务 Hooks ---
  const endpoints = useApiEndpoints({ filters, groupId: selectedGroupId, ... });
  const detail = useApiDetail(selectedId);
  const stats = useApiStats();
  const trends = useApiTrends({ apiId: selectedId, range, granularity });
  const { startAutoRefresh, stopAutoRefresh } = useAutoRefresh(() => {
    endpoints.refetch();
    stats.refetch();
  });

  // --- 跨区域联动回调 ---
  const handleStatsCardClick = (filter: Partial<Filters>) => { setFilters(f => ({...f, ...filter})); };
  const handleGroupSelect = (groupId: string) => { setSelectedGroupId(groupId); clearAll(); };
  const handleDeleteAndClear = async (id: string) => { await endpoints.delete(id); if (selectedId === id) select(null); };

  // --- 布局 ---
  return (
    <div className="flex h-screen flex-col">
      <TopToolbar ... />
      <div className="flex flex-1 overflow-hidden">
        <GroupNavigator ... />
        <main className="flex flex-1 flex-col overflow-hidden">
          <StatsRow ... />
          <ApiTable ... />
          <TrendChart ... />
        </main>
        <ApiDetailPanel ... />
      </div>
      <StatusBar ... />
      <ApiFormModal ... />
      <ApiTesterDrawer ... />
    </div>
  );
}
```

---

## 6. 交互细节

### 6.1 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `/` | 聚焦搜索框 |
| `↑` / `↓` | 表格中上下移动选中行 |
| `Enter` | 打开选中 API 的详情（等价于右侧面板加载） |
| `Delete` / `Backspace` | 删除选中 API（需二次确认） |
| `N` | 新建 API |
| `E` | 编辑选中 API |
| `Esc` | 关闭弹窗/抽屉、取消多选 |
| `Ctrl+A` | 全选当前页 |

### 6.2 加载状态

- 首次加载：全页骨架屏
- 筛选/排序变更：表格区域 loading overlay（半透明遮罩 + spinner），其他区域不变
- 详情面板切换：右侧面板骨架屏
- 趋势图切换时间范围：图表区域 loading

### 6.3 错误处理

- API 调用失败：顶部出现 Alert / Notification，保留上一次有效数据
- 网络断开：底部状态栏显示红色 "Connection Lost"，自动重试
- 删除失败：toast 提示，回滚 UI 状态（乐观更新回退）

### 6.4 动画

- 表格行删除：fadeOut + slideUp
- 统计卡片数值变化：数字滚动动画（countUp）
- 详情面板切换：侧边 slideIn
- 批量操作工具栏：顶部 slideDown 出现
- 趋势图数据更新：线条平滑过渡

---

## 7. 技术要求

### 7.1 技术栈

- React 18+ (TypeScript)
- UI 框架：Ant Design 5.x
- 图表：ECharts 或 Recharts
- 表格虚拟滚动：`@tanstack/react-virtual` 或 Ant Design Table 内置
- 状态管理：页面级 hooks（遵循四层架构），不引入全局状态管理
- 样式：Tailwind CSS + Ant Design 主题

### 7.2 性能要求

- API 列表支持 1000+ 条数据，滚动流畅（虚拟滚动）
- 搜索 debounce 300ms，输入不卡顿
- 趋势图支持 10000+ 数据点，缩放流畅
- 首屏加载 < 2s（数据加载完成）

### 7.3 可访问性

- 所有交互元素可键盘操作
- 表格支持 ARIA role
- 颜色不作为唯一信息传递手段（同时使用图标/文字）
- 所有图片/图标有 alt text

---

## 8. 验收检查清单

### 架构验收

- [ ] 页面入口 (`index.tsx`) 只做编排，不超过 150 行
- [ ] 每个区域组件内聚管理自己的 UI 状态
- [ ] 所有 API 调用集中在 `hooks/` 目录
- [ ] 纯展示组件不直接调用 API 或访问全局状态
- [ ] 跨区域联动全部在入口中转
- [ ] 没有区域组件直接 import 另一个区域组件的内部状态

### 功能验收

- [ ] 搜索、筛选、排序、分页正常工作
- [ ] 左侧分组导航四种模式可切换
- [ ] 表格行选中 → 右侧详情面板更新
- [ ] 多选 → 批量操作工具栏出现
- [ ] 新建/编辑 API 弹窗多步骤表单
- [ ] 趋势图时间范围切换
- [ ] 自动刷新开关
- [ ] 导出功能（JSON/CSV/OpenAPI）
- [ ] 键盘快捷键
- [ ] 请求测试抽屉
- [ ] 版本历史时间线
- [ ] 权限管理

### 交互验收

- [ ] 所有加载状态（骨架屏、overlay、spinner）
- [ ] 错误处理与 toast 提示
- [ ] 乐观更新与回滚
- [ ] 动画流畅（删除、数字滚动、面板滑入）
- [ ] 折叠状态持久化（左侧栏、趋势图）
