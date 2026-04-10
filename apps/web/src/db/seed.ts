import type { SyncStatus } from "@my-notes/shared";
import { createId } from "@/lib/id";
import { db } from "./database";

export async function ensureDefaultFolder(): Promise<string> {
  const existing = await db.folders.filter((f) => !f.deletedAt && f.parentId === null).first();
  if (existing) return existing.id;
  const id = createId("fld");
  const now = Date.now();
  await db.folders.add({
    id,
    name: "未分类",
    parentId: null,
    updatedAt: now,
  });
  return id;
}

export async function ensureSiteSpace(domain: string): Promise<void> {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return;
  const hit = await db.site_spaces.where("sourceDomain").equals(normalized).first();
  const now = Date.now();
  if (hit) {
    await db.site_spaces.update(hit.id, { updatedAt: now });
    return;
  }
  await db.site_spaces.add({
    id: createId("site"),
    sourceDomain: normalized,
    displayName: normalized,
    createdAt: now,
    updatedAt: now,
  });
}

export function nextSyncAfterEdit(current: SyncStatus): SyncStatus {
  if (current === "synced") return "dirty";
  if (current === "failed") return "dirty";
  return current;
}
