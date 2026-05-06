import { nextSyncAfterEdit } from "@my-notes/shared";

import type { NotesDB } from "./database";

/**
 * 站点上的 projectId 变更时，批量更新该站下条目的冗余 projectId，并标记需同步。
 */
export async function propagateSiteProjectToItems(
  dbx: NotesDB,
  siteId: string,
  projectId: string | null | undefined,
): Promise<void> {
  const items = await dbx.site_items.where("siteId").equals(siteId).toArray();
  const now = Date.now();
  const nextPid = projectId ?? undefined;
  await dbx.transaction("rw", dbx.site_items, async () => {
    for (const item of items) {
      await dbx.site_items.update(item.id, {
        projectId: nextPid,
        updatedAt: now,
        syncStatus: nextSyncAfterEdit(item.syncStatus),
      });
    }
  });
}
