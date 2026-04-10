import type { ImageRecord, NoteRecord, SnippetRecord } from "@my-notes/shared";
import { db } from "@/db/database";

/**
 * 笔记推送：multipart，meta(JSON) + 各 img_<clientImageId> 二进制流；服务端落盘，返回 storageId（非公开 URL）。
 */
export async function uploadNote(
  token: string,
  note: NoteRecord,
  images: ImageRecord[],
): Promise<{ cloudId: string }> {
  const withBlob: ImageRecord[] = [];
  for (const img of images) {
    const row = await db.blobs.get(img.localBlobRef);
    if (row) withBlob.push(img);
  }

  const imageMeta = withBlob.map((img) => ({
    clientImageId: img.id,
    checksum: img.checksum,
  }));

  const fd = new FormData();
  fd.append(
    "meta",
    JSON.stringify({
      clientNoteId: note.id,
      title: note.title,
      contentText: note.contentText,
      updatedAt: note.updatedAt,
      images: imageMeta,
    }),
  );

  for (const img of withBlob) {
    const row = await db.blobs.get(img.localBlobRef);
    if (!row) continue;
    const file = new File([row.blob], "image.bin", { type: row.blob.type || "application/octet-stream" });
    fd.append(`img_${img.id}`, file);
  }

  const res = await fetch("/api/notes/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "笔记上传失败");
  }
  const data = (await res.json()) as {
    cloudId: string;
    images?: { clientImageId: string; storageId: string }[];
  };
  for (const row of data.images ?? []) {
    await db.images.update(row.clientImageId, { cloudStorageId: row.storageId });
  }
  return { cloudId: data.cloudId };
}

export async function uploadSnippet(
  token: string,
  snippet: SnippetRecord,
): Promise<{ cloudId: string }> {
  const res = await fetch("/api/snippets/upsert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      clientSnippetId: snippet.id,
      type: snippet.type,
      content: snippet.content,
      sourceDomain: snippet.sourceDomain,
      sourceUrl: snippet.sourceUrl,
      updatedAt: snippet.updatedAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "短文本上传失败");
  }
  return (await res.json()) as { cloudId: string };
}

export function needsUpload(syncStatus: NoteRecord["syncStatus"]): boolean {
  return syncStatus === "local_only" || syncStatus === "dirty" || syncStatus === "failed";
}
