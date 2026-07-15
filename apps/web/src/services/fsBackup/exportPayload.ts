/**
 * 从 IndexedDB 导出 fs_* 为路径树 JSON。
 */
import { db, type FsFileRow, type FsFolderRow } from "@my-notes/local-db";

import { joinFsPath, normalizeFsPath } from "./paths";
import {
  FS_BACKUP_VERSION,
  type FsBackupFile,
  type FsBackupFolder,
  type FsBackupPayload,
  type LocalFsFileRef,
} from "./types";

export function buildFolderPathById(folders: FsFolderRow[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, string>();

  const resolve = (id: string, stack: Set<string>): string => {
    const hit = cache.get(id);
    if (hit) return hit;
    if (stack.has(id)) throw new Error("检测到文件夹环");
    stack.add(id);
    const row = byId.get(id);
    if (!row) throw new Error(`缺少文件夹：${id}`);
    const path =
      row.parentId == null
        ? joinFsPath("/", row.name)
        : joinFsPath(resolve(row.parentId, stack), row.name);
    cache.set(id, path);
    stack.delete(id);
    return path;
  };

  for (const f of folders) {
    resolve(f.id, new Set());
  }
  return cache;
}

/** id→path 转为 path→id */
export function invertFolderPathMap(folderPathById: Map<string, string>): Map<string, string> {
  const pathToId = new Map<string, string>();
  for (const [id, path] of folderPathById) {
    pathToId.set(normalizeFsPath(path), id);
  }
  return pathToId;
}

export async function listLocalFsFilesWithPaths(): Promise<{
  folderPathById: Map<string, string>;
  files: LocalFsFileRef[];
}> {
  const folders = await db.fs_folders.toArray();
  const fileRows = await db.fs_files.toArray();
  const folderPathById = buildFolderPathById(folders);

  const files: LocalFsFileRef[] = fileRows.map((f: FsFileRow) => {
    const parentPath =
      f.folderId == null ? "/" : (folderPathById.get(f.folderId) ?? "/");
    const path =
      parentPath === "/" ? joinFsPath("/", f.name) : joinFsPath(parentPath, f.name);
    return {
      id: f.id,
      path: normalizeFsPath(path),
      kind: f.kind,
      name: f.name,
      folderId: f.folderId,
      contentText: f.contentText,
    };
  });

  return { folderPathById, files };
}

export async function buildFsExportPayload(): Promise<FsBackupPayload> {
  const folders = await db.fs_folders.toArray();
  const folderPathById = buildFolderPathById(folders);
  const { files: localFiles } = await listLocalFsFilesWithPaths();

  const folderEntries: FsBackupFolder[] = [...folderPathById.values()]
    .map((path) => ({ path: normalizeFsPath(path) }))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));

  const fileEntries: FsBackupFile[] = localFiles
    .map((f) => ({
      path: f.path,
      kind: f.kind,
      contentText: f.contentText,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, "en"));

  return {
    formatVersion: FS_BACKUP_VERSION,
    exportedAt: Date.now(),
    folders: folderEntries,
    files: fileEntries,
  };
}

export function downloadFsBackup(payload: FsBackupPayload): void {
  const name = `my-notes-fs-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
