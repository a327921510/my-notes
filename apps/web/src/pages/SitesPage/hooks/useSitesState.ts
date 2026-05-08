import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo, useState } from "react";

import { db, propagateSiteProjectToItems } from "@my-notes/local-db";
import {
  createId,
  isProjectCredentialMirrorItemName,
  nextSyncAfterEdit,
  SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
} from "@my-notes/shared";
import {
  deleteSiteItemOnCloud,
  deleteSiteOnCloud,
  pullSitesFromCloud,
  syncAllSitesWithConflict,
  syncDirtySitesToCloud,
} from "@my-notes/sync-client";

import type { Site, SiteItem } from "../types";

export function useSitesState() {
  /** 单次订阅三张表，避免三个 useLiveQuery 在冷启动各触发一轮渲染 */
  const sitesDbBundle = useLiveQuery(
    () =>
      Promise.all([db.projects.toArray(), db.sites.toArray(), db.site_items.toArray()]).then(
        ([projectRows, siteRows, itemRows]) => ({ projectRows, siteRows, itemRows }),
      ),
    [],
  );
  /** 首次 useLiveQuery 未返回前为 false，用于页面级 Loading，避免空数据闪一下主界面 */
  const isLocalDbReady = sitesDbBundle !== undefined;
  const projectRows = sitesDbBundle?.projectRows ?? [];
  const siteRows = sitesDbBundle?.siteRows ?? [];
  const itemRows = sitesDbBundle?.itemRows ?? [];
  /** 用户显式选中的站点；null 表示尚未指定，由下方派生为列表首项 */
  const [pickedSiteId, setPickedSiteId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [projectFilterId, setProjectFilterId] = useState<string | "all">("all");

  const selectedSiteId = useMemo(() => {
    if (siteRows.length === 0) return null;
    if (pickedSiteId && siteRows.some((site) => site.id === pickedSiteId)) {
      return pickedSiteId;
    }
    return siteRows[0].id;
  }, [pickedSiteId, siteRows]);

  const sites = useMemo<Site[]>(() => {
    return siteRows.map((site) => ({
      id: site.id,
      name: site.name,
      address: site.address,
      projectId: site.projectId ?? null,
      version: site.version ?? 1,
      syncStatus: site.syncStatus,
      cloudId: site.cloudId,
      items: itemRows
        .filter(
          (item) =>
            item.siteId === site.id && item.name !== SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map<SiteItem>((item) => ({
          id: item.id,
          name: item.name,
          content: item.content,
          syncStatus: item.syncStatus,
          cloudId: item.cloudId,
          readOnly: isProjectCredentialMirrorItemName(item.name),
        })),
    }));
  }, [itemRows, siteRows]);

  const filteredSites = useMemo(() => {
    let list = sites;
    if (projectFilterId !== "all") {
      list = list.filter((site) => (site.projectId ?? null) === projectFilterId);
    }
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter((site) => site.name.toLowerCase().includes(keyword));
  }, [projectFilterId, searchKeyword, sites]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [selectedSiteId, sites],
  );

  const projectOptions = useMemo(
    () => projectRows.map((p) => ({ value: p.id, label: p.name })),
    [projectRows],
  );

  const addSite = useCallback(async (payload: { name: string; address: string; projectId?: string | null }) => {
    const siteId = createId("site");
    await db.sites.add({
      id: siteId,
      name: payload.name.trim(),
      address: payload.address.trim(),
      projectId: payload.projectId ?? undefined,
      updatedAt: Date.now(),
      version: 1,
      syncStatus: "local_only",
    });
    setPickedSiteId(siteId);
  }, []);

  const cloneSite = useCallback(async (sourceSiteId: string, payload: { name: string; address: string }) => {
    const siteId = createId("site");
    const sourceSite = await db.sites.get(sourceSiteId);
    const sourceItems = await db.site_items.where("siteId").equals(sourceSiteId).toArray();
    await db.transaction("rw", db.sites, db.site_items, async () => {
      await db.sites.add({
        id: siteId,
        name: payload.name.trim(),
        address: payload.address.trim(),
        projectId: sourceSite?.projectId,
        updatedAt: Date.now(),
        version: 1,
        syncStatus: "local_only",
      });
      for (const item of sourceItems) {
        await db.site_items.add({
          id: createId("item"),
          siteId,
          projectId: sourceSite?.projectId,
          name: item.name,
          content: item.content,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
      }
    });
    setPickedSiteId(siteId);
  }, []);

  type SiteRemoteOpts = { authToken?: string | null; apiBase?: string };

  const removeSite = useCallback(async (siteId: string, opts?: SiteRemoteOpts) => {
    const token = opts?.authToken ?? null;
    if (token) {
      await deleteSiteOnCloud(token, siteId, { apiBase: opts?.apiBase });
    }
    await db.transaction("rw", db.sites, db.site_items, async () => {
      await db.site_items.where("siteId").equals(siteId).delete();
      await db.sites.delete(siteId);
    });
  }, []);

  const setSiteProjectId = useCallback(async (siteId: string, projectId: string | null) => {
    const site = await db.sites.get(siteId);
    if (!site) return;
    const nextPid = projectId ?? undefined;
    await db.sites.update(siteId, {
      projectId: nextPid,
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(site.syncStatus),
      version: site.version ?? 1,
    });
    await propagateSiteProjectToItems(db, siteId, nextPid ?? null);
  }, []);

  const addItem = useCallback(async (siteId: string) => {
    const site = await db.sites.get(siteId);
    const id = createId("item");
    await db.site_items.add({
      id,
      siteId,
      projectId: site?.projectId,
      name: "",
      content: "",
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    return id;
  }, []);

  const updateItem = useCallback(async (siteId: string, itemId: string, patch: Partial<Pick<SiteItem, "name" | "content">>) => {
    const current = await db.site_items.get(itemId);
    if (!current || current.siteId !== siteId) return;
    await db.site_items.update(itemId, {
      ...patch,
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(current.syncStatus),
    });
  }, []);

  const removeItem = useCallback(async (siteId: string, itemId: string, opts?: SiteRemoteOpts) => {
    const current = await db.site_items.get(itemId);
    if (!current || current.siteId !== siteId) return;
    const token = opts?.authToken ?? null;
    if (token) {
      await deleteSiteItemOnCloud(token, itemId, { apiBase: opts?.apiBase });
    } else if (current.syncStatus !== "local_only") {
      const site = await db.sites.get(siteId);
      if (site) {
        await db.sites.update(siteId, {
          updatedAt: Date.now(),
          syncStatus: nextSyncAfterEdit(site.syncStatus),
          version: site.version ?? 1,
        });
      }
    }
    await db.site_items.delete(itemId);
  }, []);

  const syncSiteData = useCallback(async (token: string | null, selectedSiteIdForSync?: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    await syncDirtySitesToCloud(db, token, {}, selectedSiteIdForSync);
  }, []);

  const pullSiteData = useCallback(async (token: string | null) => {
    if (!token) throw new Error("请先登录后再拉取");
    return pullSitesFromCloud(db, token, {});
  }, []);

  const syncAllWithConflict = useCallback(async (token: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    return syncAllSitesWithConflict(db, token, {});
  }, []);

  return {
    isLocalDbReady,
    sites,
    filteredSites,
    selectedSite,
    selectedSiteId,
    searchKeyword,
    setSearchKeyword,
    projectFilterId,
    setProjectFilterId,
    projectOptions,
    setSelectedSiteId: setPickedSiteId,
    addSite,
    cloneSite,
    removeSite,
    setSiteProjectId,
    addItem,
    updateItem,
    removeItem,
    syncSiteData,
    pullSiteData,
    syncAllWithConflict,
  };
}
