import { db } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";

import {
  itemDedupKey,
  normProjectName,
  siteDedupKey,
  type SiteProjectBackupPayload,
  type SiteProjectImportStats,
} from "./types";

export async function applySiteProjectImport(payload: SiteProjectBackupPayload): Promise<SiteProjectImportStats> {
  const stats: SiteProjectImportStats = {
    projectsCreated: 0,
    sitesCreated: 0,
    projectItemsAdded: 0,
    siteItemsAdded: 0,
    projectItemsSkipped: 0,
    siteItemsSkipped: 0,
  };

  await db.transaction("rw", db.projects, db.sites, db.site_items, async () => {
    const projectRows = await db.projects.toArray();
    const siteRows = await db.sites.toArray();
    const itemRows = await db.site_items.toArray();

    const projectIdByName = new Map<string, string>();
    for (const p of projectRows) {
      const key = normProjectName(p.name);
      if (!projectIdByName.has(key)) projectIdByName.set(key, p.id);
    }

    const siteIdByKey = new Map<string, string>();
    for (const s of siteRows) {
      siteIdByKey.set(siteDedupKey(s.name, s.address), s.id);
    }

    const projectOnlyKeys = new Map<string, Set<string>>();
    for (const p of projectRows) {
      const set = new Set<string>();
      for (const it of itemRows) {
        if ((it.projectId ?? null) === p.id && !it.siteId) {
          set.add(itemDedupKey(it.name, it.content));
        }
      }
      projectOnlyKeys.set(p.id, set);
    }

    const siteItemKeys = new Map<string, Set<string>>();
    for (const s of siteRows) {
      const set = new Set<string>();
      for (const it of itemRows) {
        if (it.siteId === s.id) {
          set.add(itemDedupKey(it.name, it.content));
        }
      }
      siteItemKeys.set(s.id, set);
    }

    const ensureProject = async (nameRaw: string): Promise<string> => {
      const name = normProjectName(nameRaw);
      if (!name) throw new Error("导入数据中包含空名称的项目，已中止");
      let id = projectIdByName.get(name);
      if (!id) {
        id = createId("proj");
        await db.projects.add({
          id,
          name,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
        projectIdByName.set(name, id);
        projectOnlyKeys.set(id, new Set());
        stats.projectsCreated += 1;
      }
      return id;
    };

    for (const p of payload.projects) {
      const projectId = await ensureProject(p.name);
      const keys = projectOnlyKeys.get(projectId)!;
      for (const it of p.items) {
        const k = itemDedupKey(it.name, it.content);
        if (keys.has(k)) {
          stats.projectItemsSkipped += 1;
          continue;
        }
        await db.site_items.add({
          id: createId("item"),
          projectId,
          name: it.name,
          content: it.content,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
        keys.add(k);
        stats.projectItemsAdded += 1;
      }
    }

    for (const s of payload.sites) {
      if (!normProjectName(s.name)) {
        throw new Error("导入数据中包含空名称的站点，已中止");
      }
      const sk = siteDedupKey(s.name, s.address);
      let siteId = siteIdByKey.get(sk);

      let projectIdForSite: string | undefined;
      if (s.projectName) {
        projectIdForSite = await ensureProject(s.projectName);
      }

      if (!siteId) {
        siteId = createId("site");
        await db.sites.add({
          id: siteId,
          name: normProjectName(s.name),
          address: s.address.trim(),
          projectId: projectIdForSite,
          updatedAt: Date.now(),
          version: 1,
          syncStatus: "local_only",
        });
        siteIdByKey.set(sk, siteId);
        siteItemKeys.set(siteId, new Set());
        stats.sitesCreated += 1;
      }

      const keys = siteItemKeys.get(siteId)!;
      for (const it of s.items) {
        const k = itemDedupKey(it.name, it.content);
        if (keys.has(k)) {
          stats.siteItemsSkipped += 1;
          continue;
        }
        const siteRow = await db.sites.get(siteId);
        const pid = siteRow?.projectId ?? projectIdForSite;
        await db.site_items.add({
          id: createId("item"),
          siteId,
          projectId: pid,
          name: it.name,
          content: it.content,
          updatedAt: Date.now(),
          syncStatus: "local_only",
        });
        keys.add(k);
        stats.siteItemsAdded += 1;
      }
    }
  });

  return stats;
}
