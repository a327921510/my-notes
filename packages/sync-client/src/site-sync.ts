import type { NotesDB } from "@my-notes/local-db";
import { createId, needsUpload, type SyncStatus } from "@my-notes/shared";
import { joinApiPath, type SyncClientOptions } from "./api-path";

type SitePayload = {
  cloudId: string;
  clientSiteId: string;
  name: string;
  address: string;
  version: number;
  updatedAt: number;
};

type SiteItemPayload = {
  cloudId: string;
  clientItemId: string;
  clientSiteId: string;
  name: string;
  content: string;
  updatedAt: number;
};

async function convertMissingRemoteCloudDataToLocalDrafts(
  dbx: NotesDB,
  cloudSites: SitePayload[],
  cloudItems: SiteItemPayload[],
) {
  const remoteSiteIds = new Set(cloudSites.map((s) => s.clientSiteId));
  const remoteItemIds = new Set(cloudItems.map((i) => i.clientItemId));
  const localSites = await dbx.sites.toArray();
  const localItems = await dbx.site_items.toArray();

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
      version: 1,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await dbx.sites.delete(localSite.id);
  }

  for (const localItem of localItems) {
    const siteWasRemapped = siteIdRemap.get(localItem.siteId);
    if (siteWasRemapped) {
      await dbx.site_items.add({
        id: createId("item"),
        siteId: siteWasRemapped,
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
    await dbx.site_items.add({
      id: createId("item"),
      siteId: localItem.siteId,
      name: localItem.name,
      content: localItem.content,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await dbx.site_items.delete(localItem.id);
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
      expectedVersion: site.version ?? 1,
      updatedAt: site.updatedAt,
      items: siteItems.map((item) => ({
        clientItemId: item.id,
        name: item.name,
        content: item.content,
        updatedAt: item.updatedAt,
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
      clientSiteId: item.siteId,
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
): Promise<{ sitesApplied: number; itemsApplied: number }> {
  const { apiBase } = options;
  const [sRes, iRes] = await Promise.all([
    fetch(joinApiPath(apiBase, "/api/sites"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/site-items"), { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!sRes.ok || !iRes.ok) {
    throw new Error("拉取站点数据失败");
  }
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(dbx, cloudSites, cloudItems);

  let sitesApplied = 0;
  for (const s of cloudSites) {
    const local = await dbx.sites.get(s.clientSiteId);
    if (!local || s.updatedAt >= local.updatedAt) {
      await dbx.sites.put({
        id: s.clientSiteId,
        name: s.name,
        address: s.address,
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
        siteId: i.clientSiteId,
        name: i.name,
        content: i.content,
        updatedAt: i.updatedAt,
        syncStatus: "synced",
        cloudId: i.cloudId,
      });
      itemsApplied++;
    }
  }

  return { sitesApplied, itemsApplied };
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
  const [sRes, iRes] = await Promise.all([
    fetch(joinApiPath(apiBase, "/api/sites"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/site-items"), { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!sRes.ok || !iRes.ok) throw new Error("拉取站点数据失败");
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(dbx, cloudSites, cloudItems);

  let pulledSites = 0;
  for (const remote of cloudSites) {
    const local = await dbx.sites.get(remote.clientSiteId);
    if (!local) {
      await dbx.sites.put({
        id: remote.clientSiteId,
        name: remote.name,
        address: remote.address,
        version: remote.version ?? 1,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledSites++;
      continue;
    }
    const same = local.name === remote.name && local.address === remote.address;
    if (!same) {
      await dbx.sites.add({
        id: createId("site"),
        name: local.name,
        address: local.address,
        version: local.version ?? 1,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.sites.put({
        id: remote.clientSiteId,
        name: remote.name,
        address: remote.address,
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
        siteId: remote.clientSiteId,
        name: remote.name,
        content: remote.content,
        updatedAt: remote.updatedAt,
        syncStatus: "synced",
        cloudId: remote.cloudId,
      });
      pulledItems++;
      continue;
    }
    const same = local.name === remote.name && local.content === remote.content && local.siteId === remote.clientSiteId;
    if (!same) {
      await dbx.site_items.add({
        id: createId("item"),
        siteId: local.siteId,
        name: local.name,
        content: local.content,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await dbx.site_items.put({
        id: remote.clientItemId,
        siteId: remote.clientSiteId,
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

/** 将未同步的站点与条目推送到云端（与 Web 端 SitesPage「同步到云端」/「推送到云端」一致）。 */
export async function syncDirtySitesToCloud(
  dbx: NotesDB,
  token: string,
  options: SyncClientOptions = {},
  selectedSiteId?: string | null,
): Promise<void> {
  if (!token) throw new Error("请先登录后再同步");
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
