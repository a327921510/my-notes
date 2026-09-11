# 仓库代理说明（Agent / AI）

## 需求基线（先读这一节）

当前需求基线为 **`1.0.0`**，是一次**重大重构**后的全新基线：`1.0.0` 之前的需求（笔记、站点信息区、项目信息、项目文件、旧云盘、浏览器扩展、本地优先 + 手动推送 / 拉取）**整体作废**，不要参照旧文档或 Git 历史来实现新需求。

产品定义为：**账号隔离的个人云盘 + `.mmd` 系统专属文档格式**；端为 **后端（`apps/api`）+ Electron 桌面端（`apps/desktop`）+ 本地 Web（`apps/web`，仅本地启动验证，不部署）**。

| 文档 | 作用 |
| --- | --- |
| `docs/PRD.md` | 需求基线（§16 为需求决策记录，全部条目已定稿） |
| `docs/开发文档.md` | **目标架构**、接口契约、数据表、页面分层与流程地图，以及 §7「清理清单」 |
| `docs/产品功能结构图.md` | 功能拓扑 |
| `docs/用户流程图.md` | 主流程 Mermaid 图 |
| `docs/version-manifest.json` | 版本号与文档清单（机器可读，比对前先读） |

**重要**：仓库中仍存在 `1.0.0` 之前的实现代码（笔记 / 站点 / 项目 / 旧云盘 / 扩展端 / Dexie 本地库 / 同步客户端）。这些代码属于 `docs/开发文档.md` §7 的清理清单，**尚未删除**。凡代码与文档冲突处，以文档为准；不要在这些待删除模块上继续添加功能。

## 需求落地与版本

- **文档是需求的最终归口**：无论需求来自对话、工单还是口头，成型后都要汇总进 `docs/`（见 `docs/开发文档.md` §0.2）；对话中达成结论后应推动或补全对应文档。
- 梳理需求时识别是否需要升版：若涉及**对外行为、数据格式、接口契约、导出格式、兼容性或验收标准**的实质变化，应提示是否升级根目录 `package.json` 的 `version` 并同步 `docs/version-manifest.json`。
- **按版本快照**：`docs/versions/<版本>/` 存放升版前冻结的快照，步骤见 `docs/versions/README.md`。`1.0.0` 因旧需求全部作废而无快照、`previousVersion` 为 `null`；自 `1.1.0` 起恢复正常快照流程。
- Web 页面遵循四层分层（页面入口 / 区域组件 / 业务 Hook / 纯展示），细则见 `.cursor/rules/page-layering.rule.mdc` 与 `docs/开发文档.md` §5.2。
- **客户端不再有本地业务数据库**：`1.0.0` 采用服务端权威模型，IndexedDB（Dexie）本地业务库、同步状态、冲突合并与删除墓碑全部取消，详见 `docs/开发文档.md` §2.2。

## Cursor Rules / Skills 适用范围

本仓库包含三个应用（`apps/api`、`apps/web`、`apps/desktop`），大部分 rules 和 skills 仅针对 Web 端页面开发。

| Rule / Skill | Web | API | Desktop | 说明 |
| --- | --- | --- | --- | --- |
| `typescript-conventions.rule.mdc` | ✅ | ✅ | ✅ | 通用 TS 规范，`alwaysApply: true` |
| `page-layering.rule.mdc` | ✅ | — | — | React 四层架构，仅 Web |
| `react-performance.rule.mdc` | ✅ | — | — | memo/useCallback，仅 Web（桌面端无独立渲染层） |
| `routing.rule.mdc` | ✅ | — | — | React Router，仅 Web |
| `styling.rule.mdc` | ✅ | — | — | Tailwind + Less + Ant Design，仅 Web |
| `api-services.rule.mdc` | ✅ | — | — | Axios 请求层，仅 Web |
| `zustand-stores.rule.mdc` | ✅ | — | — | Zustand 全局状态，仅 Web |
| `svg-icons.rule.mdc` | ✅ | — | — | SVG 图标，仅 Web |
| **generate-page** skill | ✅ | — | — | 四层页面脚手架，仅 Web |
| **add-route** skill | ✅ | — | — | 路由注册，仅 Web |
| **add-api-module** skill | ✅ | — | — | API 模块脚手架，仅 Web |
| **add-zustand-store** skill | ✅ | — | — | Zustand Store 脚手架，仅 Web |

> `apps/desktop` 为 Electron 壳，直接加载 `apps/web` 的应用，本身不含业务页面，因此上述 Web 规则通过 `apps/web` 间接生效。
