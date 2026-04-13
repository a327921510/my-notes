import type { NotesDB } from "@my-notes/local-db";
import { ensureDefaultFolder } from "@my-notes/local-db";
import {
  buildSnippetRowFromCloudPull,
  createId,
  decideNotePull,
  snippetPullShouldApply,
  type CloudNotePayload,
  type CloudSnippetPayload,
} from "@my-notes/shared";
import { joinApiPath, type SyncClientOptions } from "./api-path";

async function fetchRemoteFile(
  apiBase: string | undefined,
  token: string,
  storageId: string,
): Promise<Blob> {
  const res = await fetch(joinApiPath(apiBase, `/api/files/${encodeURIComponent(storageId)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`下载资源失败: ${storageId} (${res.status})`);
  return res.blob();
}

async function replaceNoteImagesFromCloud(
  dbx: NotesDB,
  apiBase: string | undefined,
  noteId: string,
  token: string,
  cloudImages: CloudNotePayload["images"],
): Promise<void> {
  const old = await dbx.images.where("noteId").equals(noteId).toArray();
  for (const o of old) {
    await dbx.blobs.delete(o.localBlobRef);
    await dbx.images.delete(o.id);
  }
  let order = 0;
  for (const img of cloudImages) {
    const blob = await fetchRemoteFile(apiBase, token, img.storageId);
    const key = createId("blob");
    await dbx.blobs.add({ key, blob });
    await dbx.images.add({
      id: img.clientImageId,
      noteId,
      localBlobRef: key,
      checksum: img.checksum,
      cloudStorageId: img.storageId,
      sortOrder: order++,
    });
  }
}

export async function pullFromCloud(
  dbx: NotesDB,
  token: string,
  options: SyncClientOptions = {},
): Promise<{ notesApplied: number; snippetsApplied: number }> {
  const { apiBase } = options;
  const [nRes, sRes] = await Promise.all([
    fetch(joinApiPath(apiBase, "/api/notes"), { headers: { Authorization: `Bearer ${token}` } }),
    fetch(joinApiPath(apiBase, "/api/snippets"), { headers: { Authorization: `Bearer ${token}` } }),
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
  const defaultFolder = await ensureDefaultFolder(dbx);

  for (const cn of cloudNotes) {
    const local = await dbx.notes.get(cn.clientNoteId);
    const decision = decideNotePull(local, cn, defaultFolder);
    if (decision.type === "skip_deleted" || decision.type === "noop") continue;
    if (decision.type === "insert") {
      await dbx.notes.add(decision.row);
      await replaceNoteImagesFromCloud(dbx, apiBase, cn.clientNoteId, token, cn.images ?? []);
      notesApplied++;
      continue;
    }
    if (decision.type === "update") {
      await dbx.notes.update(decision.id, decision.patch);
      await replaceNoteImagesFromCloud(dbx, apiBase, decision.id, token, cn.images ?? []);
      notesApplied++;
      continue;
    }
    if (decision.type === "conflict") {
      const conflictId = createId("note");
      await dbx.notes.add({ ...decision.row, id: conflictId });
      await replaceNoteImagesFromCloud(dbx, apiBase, conflictId, token, cn.images ?? []);
      notesApplied++;
    }
  }

  let snippetsApplied = 0;
  for (const cs of cloudSnips) {
    const local = await dbx.snippets.get(cs.clientSnippetId);
    if (!snippetPullShouldApply(local, cs)) continue;
    const row = buildSnippetRowFromCloudPull(local, cs);
    await dbx.snippets.put(row);
    snippetsApplied++;
  }

  return { notesApplied, snippetsApplied };
}
