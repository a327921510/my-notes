import type { SyncStatus } from "@my-notes/shared";
import { createId } from "@/lib/id";
import { db } from "@/db/database";

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

export function needsUpload(syncStatus: SyncStatus): boolean {
  return syncStatus === "local_only" || syncStatus === "dirty" || syncStatus === "failed";
}

async function convertMissingRemoteCloudDataToLocalDrafts(cloudSites: SitePayload[], cloudItems: SiteItemPayload[]) {
  const remoteSiteIds = new Set(cloudSites.map((s) => s.clientSiteId));
  const remoteItemIds = new Set(cloudItems.map((i) => i.clientItemId));
  const localSites = await db.sites.toArray();
  const localItems = await db.site_items.toArray();

  const siteIdRemap = new Map<string, string>();
  for (const localSite of localSites) {
    const wasFromCloud = !!localSite.cloudId || localSite.syncStatus === "synced";
    if (!wasFromCloud) continue;
    if (remoteSiteIds.has(localSite.id)) continue;
    const newSiteId = createId("site");
    siteIdRemap.set(localSite.id, newSiteId);
    await db.sites.add({
      id: newSiteId,
      name: localSite.name,
      address: localSite.address,
      version: 1,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await db.sites.delete(localSite.id);
  }

  for (const localItem of localItems) {
    const siteWasRemapped = siteIdRemap.get(localItem.siteId);
    if (siteWasRemapped) {
      await db.site_items.add({
        id: createId("item"),
        siteId: siteWasRemapped,
        name: localItem.name,
        content: localItem.content,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await db.site_items.delete(localItem.id);
      continue;
    }

    const wasFromCloud = !!localItem.cloudId || localItem.syncStatus === "synced";
    if (!wasFromCloud) continue;
    if (remoteItemIds.has(localItem.id)) continue;
    await db.site_items.add({
      id: createId("item"),
      siteId: localItem.siteId,
      name: localItem.name,
      content: localItem.content,
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    await db.site_items.delete(localItem.id);
  }
}

export async function uploadSite(token: string, siteId: string): Promise<void> {
  const site = await db.sites.get(siteId);
  if (!site) return;
  const siteItems = await db.site_items.where("siteId").equals(site.id).toArray();
  const res = await fetch("/api/sites/push-full", {
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
  await db.sites.update(site.id, { syncStatus: "synced", cloudId: data.cloudId, version: data.version });
  for (const item of siteItems) {
    await db.site_items.update(item.id, { syncStatus: "synced" });
  }
}

export async function uploadSiteItem(token: string, itemId: string): Promise<void> {
  const item = await db.site_items.get(itemId);
  if (!item) return;
  const res = await fetch("/api/site-items/upsert", {
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
  await db.site_items.update(item.id, { syncStatus: "synced", cloudId: data.cloudId });
}

export async function pullSitesFromCloud(token: string): Promise<{ sitesApplied: number; itemsApplied: number }> {
  const [sRes, iRes] = await Promise.all([
    fetch("/api/sites", { headers: { Authorization: `Bearer ${token}` } }),
    fetch("/api/site-items", { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!sRes.ok || !iRes.ok) {
    throw new Error("拉取站点数据失败");
  }
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(cloudSites, cloudItems);

  let sitesApplied = 0;
  for (const s of cloudSites) {
    const local = await db.sites.get(s.clientSiteId);
    if (!local || s.updatedAt >= local.updatedAt) {
      await db.sites.put({
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
    const local = await db.site_items.get(i.clientItemId);
    if (!local || i.updatedAt >= local.updatedAt) {
      await db.site_items.put({
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
  token: string,
): Promise<{ pulledSites: number; pulledItems: number; uploadedSites: number; uploadedItems: number }> {
  const [sRes, iRes] = await Promise.all([
    fetch("/api/sites", { headers: { Authorization: `Bearer ${token}` } }),
    fetch("/api/site-items", { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!sRes.ok || !iRes.ok) throw new Error("拉取站点数据失败");
  const { items: cloudSites } = (await sRes.json()) as { items: SitePayload[] };
  const { items: cloudItems } = (await iRes.json()) as { items: SiteItemPayload[] };
  await convertMissingRemoteCloudDataToLocalDrafts(cloudSites, cloudItems);

  let pulledSites = 0;
  for (const remote of cloudSites) {
    const local = await db.sites.get(remote.clientSiteId);
    if (!local) {
      await db.sites.put({
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
      await db.sites.add({
        id: createId("site"),
        name: local.name,
        address: local.address,
        version: local.version ?? 1,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await db.sites.put({
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
    await db.sites.update(local.id, {
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      version: remote.version ?? local.version ?? 1,
      syncStatus: "synced",
      cloudId: remote.cloudId,
    });
  }

  let pulledItems = 0;
  for (const remote of cloudItems) {
    const local = await db.site_items.get(remote.clientItemId);
    if (!local) {
      await db.site_items.put({
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
      await db.site_items.add({
        id: createId("item"),
        siteId: local.siteId,
        name: local.name,
        content: local.content,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
      await db.site_items.put({
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
    await db.site_items.update(local.id, {
      updatedAt: Math.max(local.updatedAt, remote.updatedAt),
      syncStatus: "synced",
      cloudId: remote.cloudId,
    });
  }

  return { pulledSites, pulledItems, uploadedSites: 0, uploadedItems: 0 };
}
