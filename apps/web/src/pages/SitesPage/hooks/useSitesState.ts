import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";

import { db, propagateSiteProjectToItems } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit } from "@my-notes/shared";
import {
  deleteSiteItemOnCloud,
  deleteSiteOnCloud,
  pullSitesFromCloud,
  syncAllSitesWithConflict,
  syncDirtySitesToCloud,
} from "@my-notes/sync-client";

import type { Site, SiteItem } from "../types";

export function useSitesState() {
  const projectRows = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const siteRows = useLiveQuery(() => db.sites.toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [projectFilterId, setProjectFilterId] = useState<string | "all">("all");

  useEffect(() => {
    if (siteRows.length === 0) {
      if (selectedSiteId !== null) setSelectedSiteId(null);
      return;
    }
    if (!selectedSiteId || !siteRows.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(siteRows[0].id);
    }
  }, [selectedSiteId, siteRows]);

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
        .filter((item) => item.siteId === site.id)
        .map<SiteItem>((item) => ({
          id: item.id,
          name: item.name,
          content: item.content,
          syncStatus: item.syncStatus,
          cloudId: item.cloudId,
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
    setSelectedSiteId(siteId);
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
    setSelectedSiteId(siteId);
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
    sites,
    filteredSites,
    selectedSite,
    selectedSiteId,
    searchKeyword,
    setSearchKeyword,
    projectFilterId,
    setProjectFilterId,
    projectOptions,
    setSelectedSiteId,
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
