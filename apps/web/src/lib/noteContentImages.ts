import { db } from "@/db/database";

/** Persisted in note HTML as src="mnimg:<imageRecordId>"; editor hydrates to blob: URLs. */
export function extractReferencedImageIds(contentHtml: string): Set<string> {
  const out = new Set<string>();
  const re = /src="mnimg:([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contentHtml)) !== null) {
    out.add(m[1]);
  }
  return out;
}

export async function hydrateNoteContentHtml(
  html: string,
  noteId: string,
): Promise<{ html: string; blobUrlByImageId: Map<string, string> }> {
  const blobUrlByImageId = new Map<string, string>();
  let result = html;
  const re = /src="mnimg:([^"]+)"/g;
  const ids = [...new Set([...html.matchAll(re)].map((m) => m[1]))];
  for (const id of ids) {
    const img = await db.images.get(id);
    if (!img || img.noteId !== noteId) continue;
    const row = await db.blobs.get(img.localBlobRef);
    if (!row) continue;
    const url = URL.createObjectURL(row.blob);
    blobUrlByImageId.set(id, url);
    result = result.replaceAll(`src="mnimg:${id}"`, `src="${url}"`);
  }
  return { html: result, blobUrlByImageId };
}

/** 正文中出现内联引用时才整理图库，避免误删旧版「仅下方图库、HTML 未引用」的附件。 */
export function contentReferencesInlineImages(contentHtml: string): boolean {
  return /src="mnimg:[^"]+"/.test(contentHtml);
}

export async function pruneNoteImagesNotReferenced(noteId: string, contentHtml: string): Promise<void> {
  if (!contentReferencesInlineImages(contentHtml)) return;
  const kept = extractReferencedImageIds(contentHtml);
  const rows = await db.images.where("noteId").equals(noteId).toArray();
  for (const row of rows) {
    if (!kept.has(row.id)) {
      await db.blobs.delete(row.localBlobRef);
      await db.images.delete(row.id);
    }
  }
}
