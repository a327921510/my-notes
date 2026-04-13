import type {
  ClipRecord,
  FolderRecord,
  ImageRecord,
  NoteRecord,
  SiteSpaceRecord,
  SnippetRecord,
} from "@my-notes/shared";
import { db } from "@my-notes/local-db";

export const EXPORT_VERSION = 1 as const;

export interface MyNotesExportPayload {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: number;
  folders: FolderRecord[];
  notes: NoteRecord[];
  images: ImageRecord[];
  snippets: SnippetRecord[];
  site_spaces: SiteSpaceRecord[];
  clips: ClipRecord[];
  blobs: { key: string; dataBase64: string }[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      const b64 = s.includes(",") ? s.split(",")[1]! : s;
      resolve(b64);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function buildExportPayload(): Promise<MyNotesExportPayload> {
  const [folders, notes, images, snippets, site_spaces, clips, blobRows] = await Promise.all([
    db.folders.toArray(),
    db.notes.toArray(),
    db.images.toArray(),
    db.snippets.toArray(),
    db.site_spaces.toArray(),
    db.clips.toArray(),
    db.blobs.toArray(),
  ]);
  const blobs = await Promise.all(
    blobRows.map(async (r) => ({
      key: r.key,
      dataBase64: await blobToBase64(r.blob),
    })),
  );
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: Date.now(),
    folders,
    notes,
    images,
    snippets,
    site_spaces,
    clips,
    blobs,
  };
}

export function downloadExportJson(payload: MyNotesExportPayload, filename?: string): void {
  const name = filename ?? `my-notes-export-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(b64: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes]);
}

export async function importArchiveMerge(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<MyNotesExportPayload>;
  if (data.exportVersion !== EXPORT_VERSION) {
    throw new Error(`不支持的导出版本: ${String(data.exportVersion)}`);
  }
  if (!data.blobs || !data.notes) {
    throw new Error("导出文件格式无效");
  }

  await db.transaction(
    "rw",
    db.folders,
    db.notes,
    db.images,
    db.snippets,
    db.site_spaces,
    db.clips,
    db.blobs,
    async () => {
      for (const f of data.folders ?? []) await db.folders.put(f);
      for (const n of data.notes ?? []) await db.notes.put(n);
      for (const i of data.images ?? []) await db.images.put(i);
      for (const s of data.snippets ?? []) await db.snippets.put(s);
      for (const sp of data.site_spaces ?? []) await db.site_spaces.put(sp);
      for (const c of data.clips ?? []) await db.clips.put(c);
      for (const b of data.blobs) {
        await db.blobs.put({ key: b.key, blob: base64ToBlob(b.dataBase64) });
      }
    },
  );
}
