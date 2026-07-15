import type { FsFileKind } from "@my-notes/local-db";

import { normalizeFsPath, pathBasename } from "./paths";

export const FS_BACKUP_VERSION = 2 as const;

export type FsBackupFolder = {
  path: string;
};

export type FsBackupFile = {
  path: string;
  kind: FsFileKind;
  contentText: string;
};

export type FsBackupPayload = {
  formatVersion: typeof FS_BACKUP_VERSION;
  exportedAt: number;
  folders: FsBackupFolder[];
  files: FsBackupFile[];
};

export type LocalFsFileRef = {
  id: string;
  path: string;
  kind: FsFileKind;
  name: string;
  folderId: string | null;
  contentText: string;
};

export type FsImportConflict = {
  path: string;
  kind: FsFileKind;
  localFileId: string;
  localContent: string;
  incomingContent: string;
};

export type FsImportToCreate = {
  path: string;
  kind: FsFileKind;
  contentText: string;
};

export type FsImportLocalOnly = {
  path: string;
  fileId: string;
  kind: FsFileKind;
};

export type FsImportPlan = {
  toCreate: FsImportToCreate[];
  conflicts: FsImportConflict[];
  localOnly: FsImportLocalOnly[];
  unchangedCount: number;
};

export type FsImportApplyStats = {
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  foldersCreated: number;
  unchanged: number;
};

function isFsFileKind(v: unknown): v is FsFileKind {
  return v === "md" || v === "rm";
}

/**
 * 解析并校验备份 JSON；formatVersion 必须为 2。
 */
export function parseFsBackupPayload(text: string): FsBackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new Error("无法解析 JSON 文件");
  }
  if (!raw || typeof raw !== "object") throw new Error("备份格式无效");
  const obj = raw as Record<string, unknown>;
  if (obj.formatVersion === 1) {
    throw new Error("这是旧版站点/项目备份（formatVersion 1），请使用文件管理备份（formatVersion 2）");
  }
  if (obj.formatVersion !== FS_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(obj.formatVersion)}（需要 ${FS_BACKUP_VERSION}）`);
  }
  if (!Array.isArray(obj.folders) || !Array.isArray(obj.files)) {
    throw new Error("备份缺少 folders / files 字段");
  }

  const folderPaths = new Set<string>();
  const folders: FsBackupFolder[] = [];
  for (const item of obj.folders) {
    if (!item || typeof item !== "object") throw new Error("folders 项格式无效");
    const path = normalizeFsPath(String((item as { path?: unknown }).path ?? ""));
    if (path === "/") continue;
    if (folderPaths.has(path)) throw new Error(`重复的文件夹路径：${path}`);
    folderPaths.add(path);
    folders.push({ path });
  }

  const filePaths = new Set<string>();
  const files: FsBackupFile[] = [];
  for (const item of obj.files) {
    if (!item || typeof item !== "object") throw new Error("files 项格式无效");
    const rec = item as { path?: unknown; kind?: unknown; contentText?: unknown };
    const path = normalizeFsPath(String(rec.path ?? ""));
    if (path === "/") throw new Error("文件路径不能为根");
    const name = pathBasename(path);
    if (!name) throw new Error(`无效文件路径：${path}`);
    if (!isFsFileKind(rec.kind)) throw new Error(`文件 ${path} 的 kind 无效`);
    const expectedExt = rec.kind === "md" ? ".md" : ".rm";
    if (!name.toLowerCase().endsWith(expectedExt)) {
      throw new Error(`文件 ${path} 扩展名与 kind=${rec.kind} 不一致`);
    }
    if (filePaths.has(path)) throw new Error(`重复的文件路径：${path}`);
    if (folderPaths.has(path)) throw new Error(`路径同时是文件夹与文件：${path}`);
    filePaths.add(path);
    files.push({
      path,
      kind: rec.kind,
      contentText: typeof rec.contentText === "string" ? rec.contentText : "",
    });
  }

  return {
    formatVersion: FS_BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === "number" ? obj.exportedAt : Date.now(),
    folders,
    files,
  };
}
