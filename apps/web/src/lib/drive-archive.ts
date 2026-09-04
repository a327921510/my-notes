import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { db } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit } from "@my-notes/shared";

/**
 * Directory-nested archive (ZIP) export/import for the CloudDrive.
 *
 * Unlike the legacy single-JSON backup, the drive is exported as a real
 * nested directory tree: every drive folder becomes a real folder and every
 * file is written with its original bytes. A small `.mynotes-manifest.json`
 * carries metadata (mime / checksum / timestamps) so re-imports keep fidelity,
 * but a plain directory ZIP produced elsewhere can also be imported.
 */

const MANIFEST_ENTRY = ".mynotes-manifest.json";
const KEEP_ENTRY = ".keep";
const ARCHIVE_FORMAT = "mynotes-drive-archive/1";

type DriveFolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  path?: string;
  createdAt: number;
  updatedAt: number;
};

type ManifestFile = {
  path: string;
  mimeType?: string;
  checksum?: string;
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
};

type DriveArchiveManifest = {
  format: typeof ARCHIVE_FORMAT;
  exportedAt: number;
  files: ManifestFile[];
};

export type DriveArchiveExportResult = {
  blob: Blob;
  filename: string;
  folderCount: number;
  fileCount: number;
};

export type DriveArchiveImportResult = {
  createdFolders: number;
  createdFiles: number;
  updatedFiles: number;
};

const EXTENSION_MIME: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  ts: "text/typescript",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  pdf: "application/pdf",
  zip: "application/zip",
};

function guessMimeByName(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return EXTENSION_MIME[ext];
}

function buildFolderPathResolver(folders: DriveFolderRow[]): (id: string) => string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, string>();
  const resolve = (id: string, guard: Set<string>): string => {
    const cached = cache.get(id);
    if (cached !== undefined) return cached;
    const folder = byId.get(id);
    if (!folder || guard.has(id)) return "";
    guard.add(id);
    const parentPath = folder.parentId ? resolve(folder.parentId, guard) : "";
    const full = `${parentPath}/${folder.name}`;
    cache.set(id, full);
    return full;
  };
  return (id: string) => resolve(id, new Set());
}

/** Join a folder path ("/a/b" or "") with a leaf name into a ZIP-relative key. */
function toZipKey(folderPath: string, name: string): string {
  const trimmed = folderPath.replace(/^\/+/, "");
  return trimmed ? `${trimmed}/${name}` : name;
}

export async function exportDriveArchive(): Promise<DriveArchiveExportResult> {
  const [folders, files] = await Promise.all([db.drive_folders.toArray(), db.drive_files.toArray()]);
  const resolvePath = buildFolderPathResolver(folders);
  const zipInput: Record<string, Uint8Array> = {};
  const manifestFiles: ManifestFile[] = [];

  for (const file of files) {
    const dir = resolvePath(file.folderId);
    const key = toZipKey(dir, file.name);
    let bytes = new Uint8Array();
    if (file.localBlobRef) {
      const row = await db.blobs.get(file.localBlobRef);
      if (row) bytes = new Uint8Array(await row.blob.arrayBuffer());
    }
    zipInput[key] = bytes;
    manifestFiles.push({
      path: key,
      mimeType: file.mimeType,
      checksum: file.checksum,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    });
  }

  const foldersWithFiles = new Set(files.map((f) => f.folderId));
  for (const folder of folders) {
    if (!foldersWithFiles.has(folder.id)) {
      const dir = resolvePath(folder.id);
      zipInput[toZipKey(dir, KEEP_ENTRY)] = new Uint8Array();
    }
  }

  const manifest: DriveArchiveManifest = {
    format: ARCHIVE_FORMAT,
    exportedAt: Date.now(),
    files: manifestFiles,
  };
  zipInput[MANIFEST_ENTRY] = strToU8(JSON.stringify(manifest, null, 2));

  const zipped = zipSync(zipInput, { level: 6 });
  const blob = new Blob([zipped], { type: "application/zip" });
  const filename = `my-notes-drive-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.zip`;
  return { blob, filename, folderCount: folders.length, fileCount: files.length };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

type MutableFolder = { id: string; name: string; parentId: string | null };

function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

function bytesToBlob(bytes: Uint8Array, type?: string): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], type ? { type } : undefined);
}

/** Ensure a chain of folders (by name segments) exists; returns the leaf folder id. */
async function ensureFolderChain(
  segments: string[],
  folders: MutableFolder[],
  cache: Map<string, string>,
  counters: { created: number },
): Promise<string | null> {
  let parentId: string | null = null;
  let pathKey = "";
  for (const rawSegment of segments) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    pathKey = `${pathKey}/${normalizeName(segment)}`;
    const cached = cache.get(pathKey);
    if (cached) {
      parentId = cached;
      continue;
    }
    const existing = folders.find(
      (f) => f.parentId === parentId && normalizeName(f.name) === normalizeName(segment),
    );
    if (existing) {
      cache.set(pathKey, existing.id);
      parentId = existing.id;
      continue;
    }
    const id = createId("drive_folder");
    const now = Date.now();
    await db.drive_folders.add({
      id,
      name: segment,
      parentId,
      path: pathKey,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local_only",
    });
    folders.push({ id, name: segment, parentId });
    counters.created += 1;
    cache.set(pathKey, id);
    parentId = id;
  }
  return parentId;
}

export async function importDriveArchive(file: File): Promise<DriveArchiveImportResult> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer);
  } catch {
    throw new Error("无法解析 ZIP 文件，请选择有效的目录压缩包");
  }

  let manifest: DriveArchiveManifest | null = null;
  const manifestRaw = entries[MANIFEST_ENTRY];
  if (manifestRaw) {
    try {
      manifest = JSON.parse(strFromU8(manifestRaw)) as DriveArchiveManifest;
    } catch {
      manifest = null;
    }
  }
  const manifestByPath = new Map((manifest?.files ?? []).map((f) => [f.path, f]));

  const folders: MutableFolder[] = (await db.drive_folders.toArray()).map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
  }));
  const folderCache = new Map<string, string>();
  const counters = { created: 0 };
  const result: DriveArchiveImportResult = { createdFolders: 0, createdFiles: 0, updatedFiles: 0 };

  for (const [rawPath, bytes] of Object.entries(entries)) {
    if (rawPath === MANIFEST_ENTRY) continue;
    const path = rawPath.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.endsWith("/")) continue;
    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) continue;
    const leaf = segments[segments.length - 1];

    if (leaf === KEEP_ENTRY) {
      await ensureFolderChain(segments.slice(0, -1), folders, folderCache, counters);
      continue;
    }

    const dirSegments = segments.slice(0, -1);
    let folderId = await ensureFolderChain(dirSegments, folders, folderCache, counters);
    if (!folderId) {
      // File at archive root: place under a synthetic "导入" folder.
      folderId = await ensureFolderChain(["导入"], folders, folderCache, counters);
    }
    if (folderId) {
      await upsertImportedFile(folderId, leaf, bytes, manifestByPath.get(path), result);
    }
  }

  result.createdFolders = counters.created;
  return result;
}

async function upsertImportedFile(
  folderId: string,
  name: string,
  bytes: Uint8Array,
  manifestFile: ManifestFile | undefined,
  result: DriveArchiveImportResult,
): Promise<void> {
  const mimeType = manifestFile?.mimeType ?? guessMimeByName(name);
  const blob = bytesToBlob(bytes, mimeType);
  const now = Date.now();
  const sizeBytes = bytes.byteLength;
  const checksum = manifestFile?.checksum ?? `${sizeBytes}-${now}`;

  const siblings = await db.drive_files.where("folderId").equals(folderId).toArray();
  const existing = siblings.find((f) => normalizeName(f.name) === normalizeName(name));

  if (existing) {
    const blobKey = existing.localBlobRef ?? createId("blob");
    await db.blobs.put({ key: blobKey, blob });
    await db.drive_files.update(existing.id, {
      name,
      mimeType,
      sizeBytes,
      checksum,
      localBlobRef: blobKey,
      updatedAt: now,
      syncStatus: nextSyncAfterEdit(existing.syncStatus),
    });
    result.updatedFiles += 1;
    return;
  }

  const blobKey = createId("blob");
  await db.blobs.put({ key: blobKey, blob });
  await db.drive_files.add({
    id: createId("drive_file"),
    folderId,
    name,
    mimeType,
    sizeBytes,
    checksum,
    localBlobRef: blobKey,
    createdAt: manifestFile?.createdAt ?? now,
    updatedAt: manifestFile?.updatedAt ?? now,
    syncStatus: "local_only",
  });
  result.createdFiles += 1;
}
