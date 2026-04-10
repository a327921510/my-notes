import type { NoteRecord, SnippetRecord, SnippetType } from "@my-notes/shared";
import { db } from "@/db/database";
import { ensureDefaultFolder } from "@/db/seed";
import { createId } from "@/lib/id";

export interface CloudNotePayload {
  cloudId: string;
  clientNoteId: string;
  title: string;
  contentText: string;
  updatedAt: number;
  images: { clientImageId: string; storageId: string; checksum?: string }[];
}

export interface CloudSnippetPayload {
  cloudId: string;
  clientSnippetId: string;
  type: string;
  content: string;
  sourceDomain: string;
  sourceUrl?: string;
  updatedAt: number;
}

async function fetchRemoteFile(token: string, storageId: string): Promise<Blob> {
  const res = await fetch(`/api/files/${encodeURIComponent(storageId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`下载资源失败: ${storageId} (${res.status})`);
  return res.blob();
}

async function replaceNoteImagesFromCloud(
  noteId: string,
  token: string,
  cloudImages: CloudNotePayload["images"],
): Promise<void> {
  const old = await db.images.where("noteId").equals(noteId).toArray();
  for (const o of old) {
    await db.blobs.delete(o.localBlobRef);
    await db.images.delete(o.id);
  }
  let order = 0;
  for (const img of cloudImages) {
    const blob = await fetchRemoteFile(token, img.storageId);
    const key = createId("blob");
    await db.blobs.add({ key, blob });
    await db.images.add({
      id: img.clientImageId,
      noteId,
      localBlobRef: key,
      checksum: img.checksum,
      cloudStorageId: img.storageId,
      sortOrder: order++,
    });
  }
}

function hasNoteConflict(local: NoteRecord, cloud: CloudNotePayload): boolean {
  return local.contentText !== cloud.contentText || (local.title || "") !== (cloud.title || "");
}

export async function pullFromCloud(token: string): Promise<{
  notesApplied: number;
  snippetsApplied: number;
}> {
  const [nRes, sRes] = await Promise.all([
    fetch("/api/notes", { headers: { Authorization: `Bearer ${token}` } }),
    fetch("/api/snippets", { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  if (!nRes.ok) {
    const err = await nRes.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "拉取笔记列表失败");
  }
  if (!sRes.ok) {
    const err = await sRes.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "拉取短文本列表失败");
  }
  const { items: cloudNotes } = (await nRes.json()) as { items: CloudNotePayload[] };
  const { items: cloudSnips } = (await sRes.json()) as { items: CloudSnippetPayload[] };

  let notesApplied = 0;
  const defaultFolder = await ensureDefaultFolder();

  for (const cn of cloudNotes) {
    const local = await db.notes.get(cn.clientNoteId);
    if (local?.deletedAt) continue;
    if (!local) {
      const row: NoteRecord = {
        id: cn.clientNoteId,
        folderId: defaultFolder,
        title: cn.title,
        contentText: cn.contentText,
        updatedAt: cn.updatedAt,
        syncStatus: "synced",
        cloudId: cn.cloudId,
      };
      await db.notes.add(row);
      await replaceNoteImagesFromCloud(cn.clientNoteId, token, cn.images ?? []);
      notesApplied++;
      continue;
    }
    if (cn.updatedAt > local.updatedAt) {
      await db.notes.update(local.id, {
        title: cn.title,
        contentText: cn.contentText,
        updatedAt: cn.updatedAt,
        syncStatus: "synced",
        cloudId: cn.cloudId,
      });
      await replaceNoteImagesFromCloud(local.id, token, cn.images ?? []);
      notesApplied++;
    } else if (hasNoteConflict(local, cn)) {
      const conflictId = createId("note");
      await db.notes.add({
        id: conflictId,
        folderId: local.folderId ?? defaultFolder,
        title: cn.title ? `${cn.title}（云端副本）` : "云端副本",
        contentText: cn.contentText,
        updatedAt: cn.updatedAt,
        syncStatus: "synced",
        cloudId: cn.cloudId,
      });
      await replaceNoteImagesFromCloud(conflictId, token, cn.images ?? []);
      notesApplied++;
    }
  }

  let snippetsApplied = 0;
  for (const cs of cloudSnips) {
    const local = await db.snippets.get(cs.clientSnippetId);
    const row: SnippetRecord = {
      id: cs.clientSnippetId,
      type: cs.type as SnippetType,
      content: cs.content,
      sourceDomain: cs.sourceDomain,
      sourceUrl: cs.sourceUrl,
      createdAt: local?.createdAt ?? cs.updatedAt,
      updatedAt: cs.updatedAt,
      syncStatus: "synced",
      cloudId: cs.cloudId,
    };
    if (!local) {
      await db.snippets.add(row);
      snippetsApplied++;
      continue;
    }
    if (cs.updatedAt > local.updatedAt) {
      await db.snippets.put(row);
      snippetsApplied++;
    }
  }

  return { notesApplied, snippetsApplied };
}
