/**
 * 按用户确认结果写入 fs_*（事务）。
 */
import { db } from "@my-notes/local-db";
import { createId, normalizeNewlines } from "@my-notes/shared";

import { buildFolderPathById, invertFolderPathMap } from "./exportPayload";
import { folderAncestorsInclusive, normalizeFsPath, pathBasename, pathParent } from "./paths";
import type {
  FsBackupPayload,
  FsImportApplyStats,
  FsImportConflict,
  FsImportToCreate,
} from "./types";

export type ConflictResolutionResult = {
  path: string;
  contentText: string;
  kind: FsImportConflict["kind"];
  localFileId: string;
};

export type LocalOnlyDecision = {
  path: string;
  fileId: string;
  action: "keep" | "delete";
};

async function ensureFolderIdByPath(
  folderPath: string,
  pathToId: Map<string, string>,
): Promise<number> {
  const n = normalizeFsPath(folderPath);
  if (n === "/") return 0;

  let created = 0;
  for (const segmentPath of folderAncestorsInclusive(n)) {
    if (pathToId.has(segmentPath)) continue;

    const parentPath = pathParent(segmentPath);
    const parentId = parentPath === "/" ? null : pathToId.get(parentPath) ?? null;
    if (parentPath !== "/" && parentId == null) {
      throw new Error(`目录链不完整：${segmentPath}`);
    }

    const name = pathBasename(segmentPath);
    const id = createId("fs_folder");
    const now = Date.now();
    await db.fs_folders.add({
      id,
      name,
      parentId,
      createdAt: now,
      updatedAt: now,
    });
    pathToId.set(segmentPath, id);
    created += 1;
  }

  return created;
}

export async function applyFsImport(params: {
  payload: FsBackupPayload;
  toCreate: FsImportToCreate[];
  conflictResults: ConflictResolutionResult[];
  localOnlyDecisions: LocalOnlyDecision[];
  unchangedCount: number;
}): Promise<FsImportApplyStats> {
  const stats: FsImportApplyStats = {
    filesCreated: 0,
    filesUpdated: 0,
    filesDeleted: 0,
    foldersCreated: 0,
    unchanged: params.unchangedCount,
  };

  await db.transaction("rw", db.fs_folders, db.fs_files, async () => {
    const folders = await db.fs_folders.toArray();
    const pathToId = invertFolderPathMap(buildFolderPathById(folders));

    const folderPaths = new Set<string>();
    for (const f of params.payload.folders) {
      folderPaths.add(normalizeFsPath(f.path));
    }
    for (const f of params.toCreate) {
      for (const p of folderAncestorsInclusive(pathParent(f.path))) {
        folderPaths.add(p);
      }
    }
    for (const c of params.conflictResults) {
      for (const p of folderAncestorsInclusive(pathParent(c.path))) {
        folderPaths.add(p);
      }
    }

    const sortedFolders = [...folderPaths]
      .filter((p) => p !== "/")
      .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));

    for (const fp of sortedFolders) {
      stats.foldersCreated += await ensureFolderIdByPath(fp, pathToId);
    }

    for (const item of params.toCreate) {
      const parentPath = pathParent(item.path);
      const folderId = parentPath === "/" ? null : pathToId.get(parentPath) ?? null;
      if (parentPath !== "/" && folderId == null) {
        throw new Error(`无法解析父目录：${item.path}`);
      }
      const now = Date.now();
      await db.fs_files.add({
        id: createId("fs_file"),
        folderId,
        name: pathBasename(item.path),
        kind: item.kind,
        contentText: item.contentText,
        createdAt: now,
        updatedAt: now,
      });
      stats.filesCreated += 1;
    }

    for (const item of params.conflictResults) {
      const content = normalizeNewlines(item.contentText);
      await db.fs_files.update(item.localFileId, {
        contentText: content,
        kind: item.kind,
        name: pathBasename(item.path),
        updatedAt: Date.now(),
      });
      stats.filesUpdated += 1;
    }

    for (const d of params.localOnlyDecisions) {
      if (d.action !== "delete") continue;
      await db.fs_files.delete(d.fileId);
      stats.filesDeleted += 1;
    }
  });

  return stats;
}
