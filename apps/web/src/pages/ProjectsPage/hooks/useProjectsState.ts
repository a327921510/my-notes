import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo, useState } from "react";

import { db, propagateSiteProjectToItems } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit } from "@my-notes/shared";
import {
  deleteProjectOnCloud,
  deleteSiteItemOnCloud,
  pullSitesFromCloud,
  syncAllSitesWithConflict,
  syncDirtySitesToCloud,
} from "@my-notes/sync-client";

import type { ProjectItem, ProjectVM } from "../types";

/**
 * 项目详情列表展示顺序：
 * 1. 无站点条目在前，有站点条目在后
 * 2. 有站点条目按站点分组连续展示；站点块顺序取各站点在原始列表中首次出现的顺序
 */
function sortProjectItemsForDisplay(items: ProjectItem[]): ProjectItem[] {
  const withoutSite: ProjectItem[] = [];
  const withSite: ProjectItem[] = [];
  for (const item of items) {
    if (!item.siteId) withoutSite.push(item);
    else withSite.push(item);
  }
  withoutSite.sort((a, b) => b.updatedAt - a.updatedAt);

  const siteIdFirstOrder: string[] = [];
  const seenSiteId = new Set<string>();
  for (const item of withSite) {
    const sid = item.siteId;
    if (!sid || seenSiteId.has(sid)) continue;
    seenSiteId.add(sid);
    siteIdFirstOrder.push(sid);
  }

  const bySiteId = new Map<string, ProjectItem[]>();
  for (const sid of siteIdFirstOrder) {
    bySiteId.set(sid, []);
  }
  for (const item of withSite) {
    const sid = item.siteId;
    if (!sid) continue;
    bySiteId.get(sid)?.push(item);
  }
  for (const sid of siteIdFirstOrder) {
    const bucket = bySiteId.get(sid);
    if (bucket?.length) bucket.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const groupedWithSite = siteIdFirstOrder.flatMap((sid) => bySiteId.get(sid) ?? []);
  return [...withoutSite, ...groupedWithSite];
}

export function useProjectsState() {
  /** 单次订阅三张表，避免三个 useLiveQuery 在冷启动各触发一轮渲染 */
  const projectsDbBundle = useLiveQuery(
    () =>
      Promise.all([db.projects.toArray(), db.sites.toArray(), db.site_items.toArray()]).then(
        ([projectRows, siteRows, itemRows]) => ({ projectRows, siteRows, itemRows }),
      ),
    [],
  );
  /** 首次 useLiveQuery 未返回前为 false，用于页面级 Loading，避免空数据闪一下主界面 */
  const isLocalDbReady = projectsDbBundle !== undefined;
  const projectRows = projectsDbBundle?.projectRows ?? [];
  const siteRows = projectsDbBundle?.siteRows ?? [];
  const itemRows = projectsDbBundle?.itemRows ?? [];
  /** 用户显式选中的项目；null 表示尚未指定，由下方派生为列表首项 */
  const [pickedProjectId, setPickedProjectId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  const selectedProjectId = useMemo(() => {
    if (projectRows.length === 0) return null;
    if (pickedProjectId && projectRows.some((p) => p.id === pickedProjectId)) {
      return pickedProjectId;
    }
    return projectRows[0].id;
  }, [pickedProjectId, projectRows]);

  const projects = useMemo<ProjectVM[]>(() => {
    return projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      syncStatus: row.syncStatus,
      cloudId: row.cloudId,
      items: sortProjectItemsForDisplay(
        itemRows
          .filter((item) => (item.projectId ?? null) === row.id)
          .map<ProjectItem>((item) => {
            const site = item.siteId ? siteRows.find((s) => s.id === item.siteId) : undefined;
            return {
              id: item.id,
              name: item.name,
              content: item.content,
              updatedAt: item.updatedAt,
              syncStatus: item.syncStatus,
              cloudId: item.cloudId,
              siteId: item.siteId ?? null,
              siteAddress: site?.address,
              siteName: site?.name,
            };
          }),
      ),
    }));
  }, [itemRows, projectRows, siteRows]);

  const filteredProjects = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(keyword));
  }, [projects, searchKeyword]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const addProject = useCallback(async (payload: { name: string }) => {
    const id = createId("proj");
    await db.projects.add({
      id,
      name: payload.name.trim(),
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    setPickedProjectId(id);
  }, []);

  const updateProjectName = useCallback(async (projectId: string, name: string) => {
    const current = await db.projects.get(projectId);
    if (!current) return;
    await db.projects.update(projectId, {
      name: name.trim(),
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(current.syncStatus),
    });
  }, []);

  const removeProject = useCallback(async (projectId: string, opts?: { authToken?: string | null; apiBase?: string }) => {
    const token = opts?.authToken ?? null;
    if (token) {
      await deleteProjectOnCloud(token, projectId, { apiBase: opts?.apiBase });
    }
    await db.transaction("rw", db.projects, db.sites, db.site_items, async () => {
      const projectOnly = await db.site_items
        .filter((it) => (it.projectId ?? null) === projectId && !it.siteId)
        .toArray();
      for (const it of projectOnly) {
        await db.site_items.delete(it.id);
      }
      const boundSites = await db.sites.where("projectId").equals(projectId).toArray();
      for (const s of boundSites) {
        await propagateSiteProjectToItems(db, s.id, null);
        await db.sites.update(s.id, {
          projectId: undefined,
          updatedAt: Date.now(),
          syncStatus: nextSyncAfterEdit(s.syncStatus),
        });
      }
      await db.projects.delete(projectId);
    });
  }, []);

  const addItem = useCallback(async (projectId: string) => {
    const id = createId("item");
    await db.site_items.add({
      id,
      projectId,
      name: "",
      content: "",
      updatedAt: Date.now(),
      syncStatus: "local_only",
    });
    return id;
  }, []);

  const updateItem = useCallback(
    async (projectId: string, itemId: string, patch: Partial<Pick<ProjectItem, "name" | "content">>) => {
      const current = await db.site_items.get(itemId);
      if (!current || (current.projectId ?? null) !== projectId) return;
      await db.site_items.update(itemId, {
        ...patch,
        updatedAt: Date.now(),
        syncStatus: nextSyncAfterEdit(current.syncStatus),
      });
    },
    [],
  );

  type RemoteOpts = { authToken?: string | null; apiBase?: string };

  const removeItem = useCallback(async (projectId: string, itemId: string, opts?: RemoteOpts) => {
    const current = await db.site_items.get(itemId);
    if (!current || (current.projectId ?? null) !== projectId) return;
    const token = opts?.authToken ?? null;
    if (token) {
      await deleteSiteItemOnCloud(token, itemId, { apiBase: opts?.apiBase });
    }
    await db.site_items.delete(itemId);
  }, []);

  const syncProjectData = useCallback(async (token: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    await syncDirtySitesToCloud(db, token, {});
  }, []);

  const pullProjectData = useCallback(async (token: string | null) => {
    if (!token) throw new Error("请先登录后再拉取");
    return pullSitesFromCloud(db, token, {});
  }, []);

  const syncAllWithConflict = useCallback(async (token: string | null) => {
    if (!token) throw new Error("请先登录后再同步");
    return syncAllSitesWithConflict(db, token, {});
  }, []);

  return {
    isLocalDbReady,
    projects,
    filteredProjects,
    selectedProject,
    selectedProjectId,
    searchKeyword,
    setSearchKeyword,
    setSelectedProjectId: setPickedProjectId,
    addProject,
    updateProjectName,
    removeProject,
    addItem,
    updateItem,
    removeItem,
    syncProjectData,
    pullProjectData,
    syncAllWithConflict,
  };
}
