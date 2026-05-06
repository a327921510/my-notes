import { db } from "@my-notes/local-db";

import {
  SITE_PROJECT_BACKUP_VERSION,
  type SiteProjectBackupPayload,
  type SiteProjectBackupProject,
  type SiteProjectBackupSite,
} from "./types";

export async function buildSiteProjectExportPayload(): Promise<SiteProjectBackupPayload> {
  const [projectRows, siteRows, itemRows] = await Promise.all([
    db.projects.toArray(),
    db.sites.toArray(),
    db.site_items.toArray(),
  ]);

  const projectNameById = new Map(projectRows.map((p) => [p.id, p.name]));

  const projects: SiteProjectBackupProject[] = projectRows.map((p) => ({
    name: p.name,
    items: itemRows
      .filter((it) => (it.projectId ?? null) === p.id && !it.siteId)
      .map((it) => ({ name: it.name, content: it.content })),
  }));

  const sites: SiteProjectBackupSite[] = siteRows.map((s) => ({
    name: s.name,
    address: s.address,
    projectName: s.projectId ? (projectNameById.get(s.projectId) ?? null) : null,
    items: itemRows
      .filter((it) => it.siteId === s.id)
      .map((it) => ({ name: it.name, content: it.content })),
  }));

  return {
    formatVersion: SITE_PROJECT_BACKUP_VERSION,
    exportedAt: Date.now(),
    projects,
    sites,
  };
}
