import type { NotesDB } from "@my-notes/local-db";
import { createId, needsUpload, type SyncStatus } from "@my-notes/shared";
import { joinApiPath, type SyncClientOptions } from "./api-path";

type ProjectPayload = {
  cloudId: string;
  clientProjectId: string;
  name: string;
  updatedAt: number;
};

type SitePayload = {
  cloudId: string;
  clientSiteId: string;
  name: string;
  address: string;
  clientProjectId?: string | null;
  version: number;
  updatedAt: number;
};

type SiteItemPayload = {
  cloudId: string;
  clientItemId: string;
  clientSiteId?: string | null;
  clientProjectId?: string | null;
  name: string;
  content: string;
  updatedAt: number;
};

async function convertMissingRemoteCloudDataToLocalDrafts(
  dbx: NotesDB,
  cloudProjects: ProjectPayload[],
  cloudSites: SitePayload[],
  cloudItems: SiteItemPayload[],
) {
  const remoteProjectIds = new Set(cloudProjects.map((p) => p.clientProjectId));
  const remoteSiteIds = new Set(cloudSites.map((s) => s.clientSiteId));
  const remoteItemIds = new Set(cloudItems.map((i) => i.clientItemId));
  const localProjects = await dbx.projects.toArray();
  const localSites = await dbx.sites.toArray();
  const localItems = await dbx.site_items.toArray();

  const projectIdRemap = new Map<string, string>();
  for (const lp of localProjects) {
    const wasFromCloud = !!lp.cloudId || lp.syncStatus === "synced";
    if (!wasFromCloud) continue;
    if (remoteProjectIds.has(lp.id)) continue;
    const newPid = createId("proj");
    projectIdRemap.set(lp.id, newPid);
    await dbx.projects.add({
      id: newPid,
      name: lp.name,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await dbx.projects.delete(lp.id);
  }

  for (const [oldPid, newPid] of projectIdRemap) {
    await dbx.sites.where("projectId").equals(oldPid).modify({ projectId: newPid });
    await dbx.site_items.where("projectId").equals(oldPid).modify({ projectId: newPid });
  }

  const siteIdRemap = new Map<string, string>();
  for (const localSite of localSites) {
    const wasFromCloud = !!localSite.cloudId || localSite.syncStatus === "synced";
    if (!wasFromCloud) continue;
    if (remoteSiteIds.has(localSite.id)) continue;
    const newSiteId = createId("site");
    siteIdRemap.set(localSite.id, newSiteId);
    await dbx.sites.add({
      id: newSiteId,
      name: localSite.name,
      address: localSite.address,
      projectId: localSite.projectId,
      version: 1,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await dbx.sites.delete(localSite.id);
  }

  for (const localItem of localItems) {
    const siteWasRemapped = localItem.siteId ? siteIdRemap.get(localItem.siteId) : undefined;
    if (siteWasRemapped) {
      let pid = localItem.projectId;
      if (pid && projectIdRemap.has(pid)) pid = projectIdRemap.get(pid);
      await dbx.site_items.add({
        id: createId("item"),
        siteId: siteWasRemapped,
        projectId: pid,
        name: localItem.name,
        content: localItem.content,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.site_items.delete(localItem.id);
      continue;
    }

    const wasFromCloud = !!localItem.cloudId || localItem.syncStatus === "synced";
    if (!wasFromCloud) continue;
    if (remoteItemIds.has(localItem.id)) continue;
    let pid = localItem.projectId;
    if (pid && projectIdRemap.has(pid)) pid = projectIdRemap.get(pid);
    await dbx.site_items.add({
      id: createId("item"),
      siteId: localItem.siteId,
      projectId: pid,
      name: localItem.name,
      content: localItem.content,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await dbx.site_items.delete(localItem.id);
  }
}

export async function uploadProject(
  dbx: NotesDB,
  token: string,
  projectId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const row = await dbx.projects.get(projectId);
  if (!row) return;
  const res = await fetch(joinApiPath(apiBase, "/api/projects/upsert"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clientProjectId: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "项目上传失败");
  }
  const data = (await res.json()) as { cloudId: string };
  await dbx.projects.update(row.id, { syncStatus: "synced", cloudId: data.cloudId });
}

export async function deleteProjectOnCloud(
  token: string,
  clientProjectId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const res = await fetch(joinApiPath(apiBase, `/api/projects/${encodeURIComponent(clientProjectId)}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "删除云端项目失败");
  }
}

export async function uploadSite(
  dbx: NotesDB,
  token: string,
  siteId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const site = await dbx.sites.get(siteId);
  if (!site) return;
  const siteItems = await dbx.site_items.where("siteId").equals(site.id).toArray();
  const res = await fetch(joinApiPath(apiBase, "/api/sites/push-full"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clientSiteId: site.id,
      name: site.name,
      address: site.address,
      clientProjectId: site.projectId ?? null,
      expectedVersion: site.version ?? 1,
      updatedAt: site.updatedAt,
      items: siteItems.map((item) => ({
        clientItemId: item.id,
        name: item.name,
        content: item.content,
        updatedAt: item.updatedAt,
        clientProjectId: item.projectId ?? null,
      })),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "站点上传失败");
  }
  const data = (await res.json()) as { cloudId: string; version: number };
  await dbx.sites.update(site.id, { syncStatus: "synced", cloudId: data.cloudId, version: data.version });
  for (const item of siteItems) {
    await dbx.site_items.update(item.id, { syncStatus: "synced" });
  }
}

/** 删除云端站点及其下全部条目（与 `DELETE /api/snippets/:id` 对称）。 */
export async function deleteSiteOnCloud(
  token: string,
  clientSiteId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const res = await fetch(joinApiPath(apiBase, `/api/sites/${encodeURIComponent(clientSiteId)}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "删除云端站点失败");
  }
}

/** 删除云端单条条目（与 `DELETE /api/snippets/:id` 对称）。 */
export async function deleteSiteItemOnCloud(
  token: string,
  clientItemId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const res = await fetch(joinApiPath(apiBase, `/api/site-items/${encodeURIComponent(clientItemId)}`), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "删除云端站点条目失败");
  }
}

export async function uploadSiteItem(
  dbx: NotesDB,
  token: string,
  itemId: string,
  options: SyncClientOptions = {},
): Promise<void> {
  const { apiBase } = options;
  const item = await dbx.site_items.get(itemId);
  if (!item) return;
  const res = await fetch(joinApiPath(apiBase, "/api/site-items/upsert"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clientItemId: item.id,
      clientSiteId: item.siteId ?? undefined,
      clientProjectId: item.projectId ?? undefined,
      name: item.name,
      content: item.content,
      updatedAt: item.updatedAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "站点条目上传失败");
  }
  const data = (await res.json()) as { cloudId: string };
  await dbx.site_items.update(item.id, { syncStatus: "synced", cloudId: data.cloudId });
}

export async function pullSitesFromCloud(
  dbx: NotesDB,
  token: string,
  options: SyncClientOptions = {},
): Promise<{ projectsApplied: number; sitesApplied: number; itemsApplied: number }> {
  const { apiBase } = options;
  const [pRes, sRes, iRes] = await Promise.all([
    fetch(joinApiPath(apiBase, "/api/projects"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/sites"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/site-items"), { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!pRes.ok || !sRes.ok || !iRes.ok) {
    throw new Error("拉取站点数据失败");
  }
  const { items: cloudProjects } = (await pRes.json()) as { items: ProjectPayload[] };
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(dbx, cloudProjects, cloudSites, cloudItems);

  let projectsApplied = 0;
  for (const p of cloudProjects) {
    const local = await dbx.projects.get(p.clientProjectId);
    if (!local || p.updatedAt >= local.updatedAt) {
      await dbx.projects.put({
        id: p.clientProjectId,
        name: p.name,
        updatedAt: p.updatedAt,
        syncStatus: "synced",
        cloudId: p.cloudId,
      });
      projectsApplied++;
    }
  }

  let sitesApplied = 0;
  for (const s of cloudSites) {
    const local = await dbx.sites.get(s.clientSiteId);
    if (!local || s.updatedAt >= local.updatedAt) {
      await dbx.sites.put({
        id: s.clientSiteId,
        name: s.name,
        address: s.address,
        projectId: s.clientProjectId ?? undefined,
        version: s.version ?? 1,
        updatedAt: s.updatedAt,
        syncStatus: "synced",
        cloudId: s.cloudId,
      });
      sitesApplied++;
    }
  }

  let itemsApplied = 0;
  for (const i of cloudItems) {
    const local = await dbx.site_items.get(i.clientItemId);
    if (!local || i.updatedAt >= local.updatedAt) {
      await dbx.site_items.put({
        id: i.clientItemId,
        siteId: i.clientSiteId ?? undefined,
        projectId: i.clientProjectId ?? undefined,
        name: i.name,
        content: i.content,
        updatedAt: i.updatedAt,
        syncStatus: "synced",
        cloudId: i.cloudId,
      });
      itemsApplied++;
    }
  }

  return { projectsApplied, sitesApplied, itemsApplied };
}

/**
 * 冲突策略：
 * - 本地有远端无：保留本地 local_only
 * - 远端有本地无：写入本地 synced
 * - 两端都有且差异：保留远端记录为 synced；本地旧内容复制为新记录 local_only，再用远端覆盖原记录
 */
export async function syncAllSitesWithConflict(
  dbx: NotesDB,
  token: string,
  options: SyncClientOptions = {},
): Promise<{ pulledSites: number; pulledItems: number; uploadedSites: number; uploadedItems: number }> {
  const { apiBase } = options;
  const [pRes, sRes, iRes] = await Promise.all([
    fetch(joinApiPath(apiBase, "/api/projects"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/sites"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/site-items"), { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!pRes.ok || !sRes.ok || !iRes.ok) throw new Error("拉取站点数据失败");
  const { items: cloudProjects } = (await pRes.json()) as { items: ProjectPayload[] };
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(dbx, cloudProjects, cloudSites, cloudItems);

  for (const remote of cloudProjects) {
    const local = await dbx.projects.get(remote.clientProjectId);
    if (!local) {
      await dbx.projects.put({
        id: remote.clientProjectId,
        name: remote.name,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      continue;
    }
    const same = local.name === remote.name;
    if (!same) {
      await dbx.projects.add({
        id: createId("proj"),
        name: local.name,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.projects.put({
        id: remote.clientProjectId,
        name: remote.name,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      continue;
    }
    await dbx.projects.update(local.id, {
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      syncStatus: "synced",
      cloudId: remote.cloudId,
    });
  }

  let pulledSites = 0;
  for (const remote of cloudSites) {
    const local = await dbx.sites.get(remote.clientSiteId);
    if (!local) {
      await dbx.sites.put({
        id: remote.clientSiteId,
        name: remote.name,
        address: remote.address,
        projectId: remote.clientProjectId ?? undefined,
        version: remote.version ?? 1,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledSites++;
      continue;
    }
    const same =
      local.name === remote.name &&
      local.address === remote.address &&
      (local.projectId ?? null) === (remote.clientProjectId ?? null);
    if (!same) {
      await dbx.sites.add({
        id: createId("site"),
        name: local.name,
        address: local.address,
        projectId: local.projectId,
        version: local.version ?? 1,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.sites.put({
        id: remote.clientSiteId,
        name: remote.name,
        address: remote.address,
        projectId: remote.clientProjectId ?? undefined,
        version: remote.version ?? 1,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledSites++;
      continue;
    }
    await dbx.sites.update(local.id, {
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      version: remote.version ?? local.version ?? 1,
      syncStatus: "synced",
      cloudId: remote.cloudId,
    });
  }

  let pulledItems = 0;
  for (const remote of cloudItems) {
    const local = await dbx.site_items.get(remote.clientItemId);
    if (!local) {
      await dbx.site_items.put({
        id: remote.clientItemId,
        siteId: remote.clientSiteId ?? undefined,
        projectId: remote.clientProjectId ?? undefined,
        name: remote.name,
        content: remote.content,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledItems++;
      continue;
    }
    const same =
      local.name === remote.name &&
      local.content === remote.content &&
      (local.siteId ?? null) === (remote.clientSiteId ?? null) &&
      (local.projectId ?? null) === (remote.clientProjectId ?? null);
    if (!same) {
      await dbx.site_items.add({
        id: createId("item"),
        siteId: local.siteId,
        projectId: local.projectId,
        name: local.name,
        content: local.content,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.site_items.put({
        id: remote.clientItemId,
        siteId: remote.clientSiteId ?? undefined,
        projectId: remote.clientProjectId ?? undefined,
        name: remote.name,
        content: remote.content,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledItems++;
      continue;
    }
    await dbx.site_items.update(local.id, {
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      syncStatus: "synced",
      cloudId: remote.cloudId,
    });
  }

  return { pulledSites, pulledItems, uploadedSites: 0, uploadedItems: 0 };
}

/** 将未同步的项目、站点与条目推送到云端（与 Web 端「同步到云端」一致）。 */
export async function syncDirtySitesToCloud(
  dbx: NotesDB,
  token: string,
  options: SyncClientOptions = {},
  selectedSiteId?: string | null,
): Promise<void> {
  if (!token) throw new Error("请先登录后再同步");
  const dirtyProjects = await dbx.projects.filter((p) => needsUpload(p.syncStatus as SyncStatus)).toArray();
  for (const p of dirtyProjects) {
    try {
      await uploadProject(dbx, token, p.id, options);
    } catch {
      await dbx.projects.update(p.id, { syncStatus: "failed" });
    }
  }
  if (selectedSiteId) {
    const selected = await dbx.sites.get(selectedSiteId);
    if (selected) {
      try {
        await uploadSite(dbx, token, selected.id, options);
      } catch (e) {
        await dbx.sites.update(selected.id, { syncStatus: "failed" });
        throw e;
      }
    }
  }
  const dirtySites = await dbx.sites.filter((site) => needsUpload(site.syncStatus as SyncStatus)).toArray();
  const dirtyItems = await dbx.site_items.filter((item) => needsUpload(item.syncStatus as SyncStatus)).toArray();
  for (const site of dirtySites) {
    try {
      await uploadSite(dbx, token, site.id, options);
    } catch (e) {
      await dbx.sites.update(site.id, { syncStatus: "failed" });
      if ((e as Error).message.includes("版本不一致")) {
        throw e;
      }
    }
  }
  for (const item of dirtyItems) {
    try {
      await uploadSiteItem(dbx, token, item.id, options);
    } catch {
      await dbx.site_items.update(item.id, { syncStatus: "failed" });
    }
  }
}
