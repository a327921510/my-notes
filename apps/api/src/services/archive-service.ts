import {
  EXPORT_MANIFEST_NAME,
  EXPORT_MANIFEST_VERSION,
  type ExportManifest,
  type ExportManifestEntry,
  NodeKind,
} from "@my-notes/shared";

import type { DriveRepository, NodeRow } from "../repository/drive.js";
import { readObject } from "../storage.js";

export type ArchiveEntry = {
  /** ZIP 内相对路径，目录以 `/` 结尾 */
  path: string;
  node: NodeRow;
};

/** 把若干节点展开成 ZIP 内的相对路径清单；`prefix` 为空表示放在 ZIP 根部。 */
export function collectArchiveEntries(
  drive: DriveRepository,
  userId: string,
  roots: NodeRow[],
  includeRootNames: boolean,
): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];

  const walk = (node: NodeRow, prefix: string): void => {
    if (node.kind === NodeKind.FILE) {
      entries.push({ path: `${prefix}${node.name}`, node });
      return;
    }
    const dirPath = `${prefix}${node.name}/`;
    entries.push({ path: dirPath, node });
    for (const child of drive.listChildren(userId, node.id)) walk(child, dirPath);
  };

  for (const root of roots) {
    if (includeRootNames) {
      walk(root, "");
    } else if (root.kind === NodeKind.FOLDER) {
      for (const child of drive.listChildren(userId, root.id)) walk(child, "");
    } else {
      walk(root, "");
    }
  }

  return entries;
}

export function mapEntriesToManifest(entries: ArchiveEntry[], account: string): ExportManifest {
  const manifestEntries: ExportManifestEntry[] = entries.map(({ path, node }) => ({
    path,
    kind: node.kind as "folder" | "file",
    sizeBytes: node.sizeBytes,
    mimeType: node.mimeType,
    docKind: node.docKind as "mmd" | null,
    checksum: node.checksum,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
  }));

  return {
    manifestVersion: EXPORT_MANIFEST_VERSION,
    exportedAt: Date.now(),
    account,
    entries: manifestEntries,
  };
}

export async function buildArchiveFiles(
  userId: string,
  entries: ArchiveEntry[],
  account: string,
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    if (entry.node.kind === NodeKind.FOLDER) {
      files[entry.path] = new Uint8Array(0);
      continue;
    }
    const buffer = entry.node.storageId
      ? await readObject(userId, entry.node.storageId)
      : Buffer.alloc(0);
    files[entry.path] = new Uint8Array(buffer);
  }

  const manifest = mapEntriesToManifest(entries, account);
  files[EXPORT_MANIFEST_NAME] = new Uint8Array(
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  );
  return files;
}

export type ParsedArchiveEntry = {
  /** 已清洗的相对路径段 */
  segments: string[];
  isDirectory: boolean;
  data: Uint8Array;
};

const ILLEGAL_IN_NAME = /[\\:*?"<>|\u0000-\u001f]/g;

function sanitizeSegment(segment: string): string {
  const cleaned = segment.replace(ILLEGAL_IN_NAME, "_").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") return "_";
  return cleaned.slice(0, 255);
}

/** 丢弃绝对路径与越界路径，并把非法字符替换掉，避免外部 ZIP 写穿目录。 */
export function parseArchivePath(rawPath: string): string[] | null {
  const normalized = rawPath.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return null;

  const segments = normalized
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");
  if (segments.some((segment) => segment === "..")) return null;
  if (segments.length === 0) return null;

  return segments.map(sanitizeSegment);
}

export function parseManifest(data: Uint8Array | undefined): ExportManifest | null {
  if (!data) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data).toString("utf8")) as ExportManifest;
    return Array.isArray(parsed?.entries) ? parsed : null;
  } catch {
    return null;
  }
}
