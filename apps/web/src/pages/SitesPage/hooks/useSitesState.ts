import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db } from "@my-notes/local-db";
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
  const siteRows = useLiveQuery(() => db.sites.toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    if (siteRows.length === 0) {
      if (selectedSiteId !== null) setSelectedSiteId(null);
      return;
    }
    if (!selectedSiteId || !siteRows.some((site) => site.id === selectedSiteId)) {
      setSelectedSiteId(siteRows[0].id);
    }
  }, [selectedSiteId, siteRows]);

  const sites = useMemo<Site[]>(
    () =>
      siteRows.map((site) => ({
        id: site.id,
        name: site.name,
        address: site.address,
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
      })),
    [itemRows, siteRows],
  );

  const filteredSites = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return sites;
    return sites.filter((site) => site.name.toLowerCase().includes(keyword));
  }, [searchKeyword, sites]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [selectedSiteId, sites],
  );

  const addSite = async (payload: { name: string; address: string }) => {
    const siteId = createId("site");
    await db.sites.add({
      id: siteId,
      name: payload.name.trim(),
      address: payload.address.trim(),
      updatedAt: Date.now(),
      version: 1,
      syncStatus: "local_only",
    });
    setSelectedSiteId(siteId);
  };

  const cloneSite = async (sourceSiteId: string, payload: { name: string; address: string }) => {
    const siteId = createId("site");
    const sourceItems = await db.site_items.where("siteId").equals(sourceSiteId).toArray();
    await db.transaction("rw", db.sites, db.site_items, async () => {
      await db.sites.add({
        id: siteId,
        name: payload.name.trim(),
        address: payload.address.trim(),
        updatedAt: Date.now(),
        version: 1,
        syncStatus: "local_only",
      });
      for (const item of sourceItems) {
        await db.site_items.add({
          id: createId("item"),
          siteId,
          name: item.name,
          content: item.content,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
      }
    });
    setSelectedSiteId(siteId);
  };

  type SiteRemoteOpts = { authToken?: string | null; apiBase?: string };

  const removeSite = async (siteId: string, opts?: SiteRemoteOpts) => {
    const token = opts?.authToken ?? null;
    if (token) {
      await deleteSiteOnCloud(token, siteId, { apiBase: opts?.apiBase });
    }
    await db.transaction("rw", db.sites, db.site_items, async () => {
      await db.site_items.where("siteId").equals(siteId).delete();
      await db.sites.delete(siteId);
    });
  };

  const updateSiteAddress = async (siteId: string, address: string) => {
    const current = await db.sites.get(siteId);
    if (!current) return;
    await db.sites.update(siteId, {
      address: address.trim(),
      updatedAt: Date.now(),
      version: current.version ?? 1,
      syncStatus: nextSyncAfterEdit(current.syncStatus),
    });
  };

  const addItem = async (siteId: string) => {
    const id = createId("item");
    await db.site_items.add({
      id,
      siteId,
      name: "",
      content: "",
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    return id;
  };

  const updateItem = async (siteId: string, itemId: string, patch: Partial<Pick<SiteItem, "name" | "content">>) => {
    const current = await db.site_items.get(itemId);
    if (!current || current.siteId !== siteId) return;
    await db.site_items.update(itemId, {
      ...patch,
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(current.syncStatus),
    });
  };

  const removeItem = async (siteId: string, itemId: string, opts?: SiteRemoteOpts) => {
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
  };

  const syncSiteData = async (token: string | null, selectedSiteIdForSync?: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    await syncDirtySitesToCloud(db, token, {}, selectedSiteIdForSync);
  };

  const pullSiteData = async (token: string | null) => {
    if (!token) throw new Error("请先登录后再拉取");
    return pullSitesFromCloud(db, token, {});
  };

  const syncAllWithConflict = async (token: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    return syncAllSitesWithConflict(db, token, {});
  };

  return {
    sites,
    filteredSites,
    selectedSite,
    selectedSiteId,
    searchKeyword,
    setSearchKeyword,
    setSelectedSiteId,
    addSite,
    cloneSite,
    removeSite,
    updateSiteAddress,
    addItem,
    updateItem,
    removeItem,
    syncSiteData,
    pullSiteData,
    syncAllWithConflict,
  };
}
