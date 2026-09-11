/**
 * 后端接口冒烟：覆盖 PRD §13 中与服务端有关的验收点。
 * 用法：先 `pnpm --filter @my-notes/api dev`，再 `node apps/api/scripts/smoke.mjs`
 */

const BASE = process.env.API_BASE ?? "http://127.0.0.1:3001";

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail === undefined ? "" : ` → ${JSON.stringify(detail)}`}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function call(token, method, path, body, isForm = false) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  let data = null;
  if (contentType.includes("application/json")) data = await response.json();
  else if (contentType.includes("application/zip") || contentType.includes("octet-stream"))
    data = Buffer.from(await response.arrayBuffer());
  else data = await response.text();

  return { status: response.status, data, headers: response.headers };
}

function uploadForm(parentId, name, content, onConflict) {
  const form = new FormData();
  form.set("parentId", parentId);
  if (onConflict) form.set("onConflict", onConflict);
  form.set("file", new Blob([content]), name);
  return form;
}

async function main() {
  const stamp = Date.now();
  const userA = { email: `a_${stamp}@example.com`, password: "password123" };
  const userB = { email: `b_${stamp}@example.com`, password: "password123" };

  section("账号体系");
  const registerA = await call(null, "POST", "/api/auth/register", userA);
  check("注册成功", registerA.status === 200 && !!registerA.data.token, registerA.data);
  const tokenA = registerA.data.token;

  const dupe = await call(null, "POST", "/api/auth/register", userA);
  check("重复邮箱被拒", dupe.status === 409 && dupe.data.code === "AUTH_EMAIL_TAKEN", dupe.data);

  const badLogin = await call(null, "POST", "/api/auth/login", { ...userA, password: "wrongpass1" });
  check(
    "错误密码被拒且不泄露邮箱",
    badLogin.status === 401 && badLogin.data.code === "AUTH_INVALID_CREDENTIALS",
    badLogin.data,
  );

  const shortPwd = await call(null, "POST", "/api/auth/register", {
    email: `s_${stamp}@example.com`,
    password: "short",
  });
  check("密码不足 8 位被拒", shortPwd.data.code === "AUTH_PASSWORD_TOO_SHORT", shortPwd.data);

  const noAuth = await call(null, "GET", "/api/drive/nodes");
  check("未登录访问云盘被拒", noAuth.status === 401, noAuth.data);

  const registerB = await call(null, "POST", "/api/auth/register", userB);
  const tokenB = registerB.data.token;

  section("云盘：目录与文件 CRUD");
  const rootList = await call(tokenA, "GET", "/api/drive/nodes");
  check("默认进入根目录且为空", rootList.status === 200 && rootList.data.nodes.length === 0, rootList.data);
  const rootId = rootList.data.parent.id;

  const work = await call(tokenA, "POST", "/api/drive/folders", { parentId: rootId, name: "工作" });
  check("新建文件夹", work.status === 200 && work.data.node.kind === "folder", work.data);
  const workId = work.data.node.id;

  const projectA = await call(tokenA, "POST", "/api/drive/folders", { parentId: workId, name: "项目A" });
  const projectAId = projectA.data.node.id;
  const deep = await call(tokenA, "POST", "/api/drive/folders", { parentId: projectAId, name: "三层" });
  check("三级目录创建成功", deep.status === 200, deep.data);

  const sameName = await call(tokenA, "POST", "/api/drive/folders", { parentId: rootId, name: " 工作 " });
  check(
    "同级同名（含空格）被拒",
    sameName.status === 409 && sameName.data.code === "NODE_NAME_CONFLICT",
    sameName.data,
  );

  const caseName = await call(tokenA, "POST", "/api/drive/folders", { parentId: workId, name: "项目a" });
  check("同级同名（仅大小写不同）被拒", caseName.data.code === "NODE_NAME_CONFLICT", caseName.data);

  const badName = await call(tokenA, "POST", "/api/drive/folders", { parentId: rootId, name: "a/b" });
  check("非法字符被拒", badName.data.code === "NODE_NAME_INVALID", badName.data);

  const pathResult = await call(tokenA, "GET", `/api/drive/nodes/${deep.data.node.id}/path`);
  check(
    "面包屑路径为 根/工作/项目A/三层",
    pathResult.data.path.map((p) => p.name).join("/") === "我的云盘/工作/项目A/三层",
    pathResult.data.path,
  );

  section("云盘：上传与同名策略");
  const upload = await call(tokenA, "POST", "/api/drive/files", uploadForm(projectAId, "报告.txt", "v1"), true);
  check("上传文件", upload.status === 200 && upload.data.node.sizeBytes === 2, upload.data);
  const reportId = upload.data.node.id;

  const conflict = await call(tokenA, "POST", "/api/drive/files", uploadForm(projectAId, "报告.txt", "v2"), true);
  check("同名上传未指定策略时返回冲突", conflict.data.code === "NODE_NAME_CONFLICT", conflict.data);

  const renamed = await call(
    tokenA,
    "POST",
    "/api/drive/files",
    uploadForm(projectAId, "报告.txt", "v2", "rename"),
    true,
  );
  check("保留副本生成 报告(1).txt", renamed.data.node?.name === "报告(1).txt", renamed.data);

  const overwritten = await call(
    tokenA,
    "POST",
    "/api/drive/files",
    uploadForm(projectAId, "报告.txt", "v3-long", "overwrite"),
    true,
  );
  check(
    "覆盖保留节点 id 并更新大小",
    overwritten.data.node?.id === reportId && overwritten.data.node?.sizeBytes === 7,
    overwritten.data,
  );

  const skipped = await call(
    tokenA,
    "POST",
    "/api/drive/files",
    uploadForm(projectAId, "报告.txt", "v4", "skip"),
    true,
  );
  check("跳过策略不写入", skipped.data.skipped === true, skipped.data);

  const download = await call(tokenA, "GET", `/api/drive/nodes/${reportId}/download`);
  check("下载内容为覆盖后的版本", Buffer.from(download.data).toString() === "v3-long", download.data);

  section("云盘：重命名 / 移动 / 批量");
  const rename = await call(tokenA, "PATCH", `/api/drive/nodes/${reportId}`, { name: "报告-最终.txt" });
  check("重命名成功", rename.data.node?.name === "报告-最终.txt", rename.data);

  const renameRoot = await call(tokenA, "PATCH", `/api/drive/nodes/${rootId}`, { name: "改名" });
  check("根目录不可重命名", renameRoot.data.code === "NODE_ROOT_IMMUTABLE", renameRoot.data);

  const moveIntoSelf = await call(tokenA, "POST", "/api/drive/nodes/move", {
    ids: [workId],
    targetParentId: projectAId,
  });
  check(
    "目录不能移入自身子孙",
    moveIntoSelf.data.failed?.[0]?.code === "NODE_MOVE_INTO_SELF",
    moveIntoSelf.data,
  );

  const archiveFolder = await call(tokenA, "POST", "/api/drive/folders", { parentId: rootId, name: "归档" });
  const archiveId = archiveFolder.data.node.id;
  const move = await call(tokenA, "POST", "/api/drive/nodes/move", {
    ids: [reportId, renamed.data.node.id],
    targetParentId: archiveId,
  });
  check("批量移动两个文件", move.data.done?.length === 2, move.data);

  const archiveList = await call(tokenA, "GET", `/api/drive/nodes?parentId=${archiveId}`);
  check("移动后出现在目标目录", archiveList.data.nodes.length === 2, archiveList.data.nodes);

  section("云盘：搜索与用量");
  const search = await call(tokenA, "GET", "/api/drive/search?keyword=报告");
  check("按名称搜索命中 2 个", search.data.total === 2, search.data);
  check(
    "搜索结果带所在路径",
    search.data.items?.[0]?.path?.map((p) => p.name).join("/").startsWith("我的云盘"),
    search.data.items?.[0]?.path,
  );

  const usage = await call(tokenA, "GET", "/api/drive/usage");
  check("用量统计非零且含配额", usage.data.usedBytes > 0 && usage.data.quotaBytes > 0, usage.data);

  section(".mmd 文档");
  const docBody = [
    "# 项目说明",
    "",
    "| 地址 | 账号 | 密码 | 备注 |",
    "| --- | --- | --- | --- |",
    "| https://a.com | admin | p@ss | 测试 |",
  ].join("\n");
  const doc = await call(tokenA, "POST", "/api/docs", { parentId: workId, name: "说明", content: docBody });
  check("新建 .mmd 自动补后缀", doc.data.node?.name === "说明.mmd" && doc.data.node?.docKind === "mmd", doc.data);
  const docId = doc.data.node.id;

  const readDoc = await call(tokenA, "GET", `/api/docs/${docId}`);
  check("读取 .mmd 正文一致", readDoc.data.content === docBody, readDoc.data.content);

  const save = await call(tokenA, "PUT", `/api/docs/${docId}`, {
    content: `${docBody}\n\n新增一行`,
    baseUpdatedAt: readDoc.data.node.updatedAt,
  });
  check("带基版本保存成功", save.status === 200, save.data);

  const stale = await call(tokenA, "PUT", `/api/docs/${docId}`, {
    content: "冲突内容",
    baseUpdatedAt: readDoc.data.node.updatedAt,
  });
  check(
    "基版本过期返回 DOC_STALE 且带服务端时间",
    stale.data.code === "DOC_STALE" && typeof stale.data.details?.serverUpdatedAt === "number",
    stale.data,
  );

  const retry = await call(tokenA, "PUT", `/api/docs/${docId}`, {
    content: "覆盖后的内容",
    baseUpdatedAt: stale.data.details.serverUpdatedAt,
  });
  check("用最新基版本重试成功", retry.status === 200, retry.data);

  const notDoc = await call(tokenA, "GET", `/api/docs/${reportId}`);
  check("对非 .mmd 调文档接口被拒", notDoc.data.code === "DOC_NOT_MMD", notDoc.data);

  const degraded = await call(tokenA, "PATCH", `/api/drive/nodes/${docId}`, { name: "说明.txt" });
  check("改掉 .mmd 后缀即降级", degraded.data.node?.docKind === null, degraded.data);
  await call(tokenA, "PATCH", `/api/drive/nodes/${docId}`, { name: "说明.mmd" });
  const upgraded = await call(tokenA, "GET", `/api/drive/nodes/${docId}`);
  check("改回 .mmd 后缀即升级", upgraded.data.node?.docKind === "mmd", upgraded.data);

  section("导出与导入");
  const exported = await call(tokenA, "POST", "/api/drive/export", { folderId: rootId });
  const zipBuffer = Buffer.from(exported.data);
  check("导出返回 ZIP", exported.status === 200 && zipBuffer.length > 0, exported.status);
  check(
    "ZIP 内含清单文件",
    zipBuffer.includes(Buffer.from(".mydrive-manifest.json")),
    zipBuffer.length,
  );

  const importForm = new FormData();
  importForm.set("targetParentId", "");
  importForm.set("archive", new Blob([zipBuffer]), "export.zip");
  const preflight = await call(tokenB, "POST", "/api/drive/import/preflight", importForm, true);
  check(
    "跨账号导入预检统计正确",
    preflight.data.fileCount >= 3 && preflight.data.folderCount >= 3 && preflight.data.quotaOk === true,
    preflight.data,
  );

  const importForm2 = new FormData();
  importForm2.set("targetParentId", "");
  importForm2.set("archive", new Blob([zipBuffer]), "export.zip");
  const imported = await call(tokenB, "POST", "/api/drive/import", importForm2, true);
  check(
    "导入还原目录与文件",
    imported.data.createdFiles >= 3 && imported.data.createdFolders >= 3 && imported.data.failed.length === 0,
    imported.data,
  );

  const bRoot = await call(tokenB, "GET", "/api/drive/nodes");
  const bNames = bRoot.data.nodes.map((n) => n.name).sort();
  check("B 账号根目录结构与 A 一致", bNames.join(",") === "工作,归档", bNames);

  section("账号隔离");
  const crossRead = await call(tokenB, "GET", `/api/drive/nodes/${workId}`);
  check("跨账号读取返回 404", crossRead.status === 404 && crossRead.data.code === "NODE_NOT_FOUND", crossRead.data);

  const crossDownload = await call(tokenB, "GET", `/api/drive/nodes/${reportId}/download`);
  check("跨账号下载返回 404", crossDownload.status === 404, crossDownload.status);

  const crossDelete = await call(tokenB, "POST", "/api/drive/nodes/delete", { ids: [workId] });
  check("跨账号删除失败", crossDelete.data.failed?.[0]?.code === "NODE_NOT_FOUND", crossDelete.data);

  const aStillThere = await call(tokenA, "GET", `/api/drive/nodes/${workId}`);
  check("A 的数据未被影响", aStillThere.status === 200, aStillThere.status);

  section("删除与会话");
  const deleteRoot = await call(tokenA, "POST", "/api/drive/nodes/delete", { ids: [rootId] });
  check("根目录不可删除", deleteRoot.data.failed?.[0]?.code === "NODE_ROOT_IMMUTABLE", deleteRoot.data);

  const recursive = await call(tokenA, "POST", "/api/drive/nodes/delete", { ids: [workId] });
  check("递归删除目录成功", recursive.data.done?.length === 1, recursive.data);
  const afterDelete = await call(tokenA, "GET", `/api/drive/nodes/${docId}`);
  check("子孙节点一并删除", afterDelete.status === 404, afterDelete.status);

  const changed = await call(tokenA, "POST", "/api/auth/password", {
    currentPassword: userA.password,
    newPassword: "newpassword456",
  });
  check("修改密码成功", changed.status === 204, changed.status);

  const oldSession = await call(tokenA, "GET", "/api/auth/me");
  check("改密码后旧会话失效", oldSession.status === 401, oldSession.data);

  const reLogin = await call(null, "POST", "/api/auth/login", {
    email: userA.email,
    password: "newpassword456",
  });
  check("用新密码可重新登录", reLogin.status === 200 && !!reLogin.data.token, reLogin.status);

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
