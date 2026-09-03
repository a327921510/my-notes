---
name: add-e2e-test
description: >-
  为已定稿的前端主路径补 E2E：按 REQ stage 表增量 data-testid 与用例骨架。
  触发词：补 E2E、加端到端测试、主路径已定补测试、Playwright、页面自动化测试。
  含小程序自动化占位（不生成驱动代码）。
---

# 为 REQ 补前端 E2E（主路径定稿后）

在用户确认**主路径已定**（或口令含「主路径已定，补 E2E」）后执行。与 `implement-req` 同属阶段 A，**不**改 changelog / 功能真相 / ops。

人工详测用例（步骤 + 预期写回 REQ）仍走 `req-workflow` 步骤 ⑤，**不等于**本 skill。

## 前置

1. 读取 `.cursor/rules/req-workflow.local.mdc`；缺失则停止并提示 `configure-req`。
2. 确认 REQ-ID、验收句、编排入口与 **stage 表**（来自实现简报或入口流程地图）。无 stage 表则先补流程地图，再写 E2E。
3. 探测目标代码仓是否已有 E2E 栈（如 `playwright.config.*`、`e2e/`、`cypress/`、`package.json` scripts）。**已有则沿用**，不另起炉灶。

## 执行步骤（H5 / Web 页面）

1. 列出本 REQ 用例会点到的控件 → 按约定增量打标：`data-testid="{feature}.{stage}"`（项目 `local.mdc` 另有约定则从其约定）。优先 role / 可见名称；不稳再用 testid。
2. 在代码仓写入或补齐最小用例：按 stage 顺序覆盖验收句；断言用户可见结果，不测实现细节。
3. 若仓库无 E2E：生成最小 Playwright（或团队指定工具）骨架 + 简短 README（如何安装、如何跑）。**不要**默认安装与本任务无关的重型依赖，除非用户明确要求执行安装。
4. 建议目录（无现成约定时）：

```text
e2e/
  smoke/
    <feature>.spec.ts
  README.md
```

5. Commit（仅当用户要求）：type 可用 `test`；footer 带同一 `REQ-ID`。

## 小程序 E2E（占位）

中央 standards **不**生成小程序驱动代码（不绑死某一自动化框架）。

当端含小程序 / `miniprogram` label，或用户点名时：

1. 若尚无占位说明，在目标仓增加（已存在则更新状态段）：

```text
e2e/miniprogram/README.md
```

2. README 须含：
   - **状态：占位**
   - 与 H5 **共用同一套 stage 名**（便于对照）
   - 待办：账号与启动页、工具选型（由项目决定）、与 web-view/H5 的 stage 对照表
   - **禁止**在本 skill 下假装已可跑通小程序用例

3. 简报写明：`小程序自动化：占位`。

## 结束后简报

- REQ-ID、打了哪些 testid、用例文件路径
- 如何本地运行（命令）
- 小程序：占位路径或「不适用」
- 未覆盖的验收句（及原因）

## 禁止

- 主路径未定时铺全站 testid 或大而全套件
- 未确认就 `git commit` / 擅自 `npm install` 大依赖（除非用户要求）
- 把人工详测文档当成 E2E，或把 E2E 写进阶段 B 文档同步
- 为空的小程序「假用例」充数
