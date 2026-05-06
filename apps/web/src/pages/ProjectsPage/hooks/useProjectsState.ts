import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useState } from "react";

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

export function useProjectsState() {
  const projectRows = useLiveQuery(() => db.projects.toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    if (projectRows.length === 0) {
      if (selectedProjectId !== null) setSelectedProjectId(null);
      return;
    }
    if (!selectedProjectId || !projectRows.some((p) => p.id === selectedProjectId)) {
      setSelectedProjectId(projectRows[0].id);
    }
  }, [selectedProjectId, projectRows]);

  const projects = useMemo<ProjectVM[]>(() => {
    return projectRows.map((row) => ({
      id: row.id,
      name: row.name,
      syncStatus: row.syncStatus,
      cloudId: row.cloudId,
      items: itemRows
        .filter((item) => (item.projectId ?? null) === row.id)
        .map<ProjectItem>((item) => ({
          id: item.id,
          name: item.name,
          content: item.content,
          syncStatus: item.syncStatus,
          cloudId: item.cloudId,
          siteId: item.siteId ?? null,
        })),
    }));
  }, [itemRows, projectRows]);

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
    setSelectedProjectId(id);
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
    projects,
    filteredProjects,
    selectedProject,
    selectedProjectId,
    searchKeyword,
    setSearchKeyword,
    setSelectedProjectId,
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
