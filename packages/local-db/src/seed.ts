import { createId } from "@my-notes/shared";
import { db, type NotesDB } from "./database";

export async function ensureDefaultFolder(dbx: NotesDB = db): Promise<string> {
  const existing = await dbx.folders.filter((f) => !f.deletedAt && f.parentId === null).first();
  if (existing) return existing.id;
  const id = createId("fld");
  const now = Date.now();
  await dbx.folders.add({
    id,
    name: "未分类",
    parentId: null,
    updatedAt: now,
  });
  return id;
}

export async function ensureSiteSpace(domain: string, dbx: NotesDB = db): Promise<void> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return;
  const hit = await dbx.site_spaces.where("sourceDomain").equals(normalized).first();
  const now = Date.now();
  if (hit) {
    await dbx.site_spaces.update(hit.id, { updatedAt: now });
    return;
  }
  await dbx.site_spaces.add({
    id: createId("site"),
    sourceDomain: normalized,
    displayName: normalized,
    createdAt: now,
    updatedAt: now,
  });
}
