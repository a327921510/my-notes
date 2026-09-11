import {
  ApiErrorCode,
  EXPORT_MANIFEST_NAME,
  type ImportPreflightResult,
  type ImportResult,
  NodeKind,
  type OnConflictStrategy,
  mapNodeNameToKey,
} from "@my-notes/shared";
import { unzipSync, zipSync } from "fflate";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { ApiError } from "../errors.js";
import { readMultipart, requireFile } from "../multipart.js";
import type { DriveRepository, NodeRow } from "../repository/drive.js";
import {
  buildArchiveFiles,
  collectArchiveEntries,
  parseArchivePath,
  parseManifest,
} from "../services/archive-service.js";
import { inferDocKind, removeNode, resolveNamePlacement } from "../services/drive-service.js";
import { deleteObject, writeObject } from "../storage.js";

export type ArchiveRouteDeps = {
  drive: DriveRepository;
};

type ParsedArchive = {
  /** 相对路径段 → 内容；目录项 data 为空 */
  files: Array<{ segments: string[]; data: Uint8Array; isDirectory: boolean }>;
  manifestPresent: boolean;
};

function parseArchive(buffer: Buffer): ParsedArchive {
  let raw: Record<string, Uint8Array>;
  try {
    raw = unzipSync(new Uint8Array(buffer));
  } catch {
    throw new ApiError(ApiErrorCode.ARCHIVE_INVALID);
  }

  const files: ParsedArchive["files"] = [];
  let manifestPresent = false;

  for (const [rawPath, data] of Object.entries(raw)) {
    if (rawPath === EXPORT_MANIFEST_NAME) {
      manifestPresent = parseManifest(data) !== null;
      continue;
    }
    const isDirectory = rawPath.endsWith("/");
    const segments = parseArchivePath(rawPath);
    if (!segments) continue;
    files.push({ segments, data, isDirectory });
  }

  // 目录在前，保证父目录先于子项创建
  files.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.segments.length - b.segments.length;
  });

  return { files, manifestPresent };
}

function mapExtensionToMime(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".mmd") || lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  return null;
}

function formatArchiveName(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `export-${stamp}.zip`;
}

/** 传入的 app 必须是已挂鉴权 hook 的作用域（见 index.ts）。 */
export async function registerArchiveRoutes(
  app: FastifyInstance,
  { drive }: ArchiveRouteDeps,
): Promise<void> {
  app.post<{ Body: { ids?: string[]; folderId?: string | null } }>(
    "/api/drive/export",
    async (request, reply) => {
      const { userId } = request;
      const ids = request.body?.ids ?? [];

      let roots: NodeRow[];
      let includeRootNames: boolean;
      if (ids.length > 0) {
        roots = ids.map((id) => drive.requireNode(userId, id));
        includeRootNames = true;
      } else {
        // 目录导出：把该目录的子树放在 ZIP 根部，回导到同一目录即可还原
        roots = [drive.requireFolder(userId, request.body?.folderId ?? null)];
        includeRootNames = false;
      }

      const entries = collectArchiveEntries(drive, userId, roots, includeRootNames);
      const files = await buildArchiveFiles(userId, entries, request.userEmail);
      const zipped = zipSync(files, { level: 6 });

      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${formatArchiveName()}"`)
        .send(Buffer.from(zipped));
    },
  );

  app.post("/api/drive/import/preflight", async (request): Promise<ImportPreflightResult> => {
    const { userId } = request;
    const payload = await readMultipart(request);
    const archive = parseArchive(requireFile(payload).buffer);
    const target = drive.requireFolder(userId, payload.fields.targetParentId || null);

    const folderPaths = new Set<string>();
    let fileCount = 0;
    let totalBytes = 0;

    for (const entry of archive.files) {
      if (entry.isDirectory) {
        folderPaths.add(entry.segments.join("/"));
        continue;
      }
      fileCount += 1;
      totalBytes += entry.data.byteLength;
      for (let i = 1; i < entry.segments.length; i += 1) {
        folderPaths.add(entry.segments.slice(0, i).join("/"));
      }
    }

    const takenKeys = drive.takenNameKeys(userId, target.id);
    const topLevelNames = new Set(archive.files.map((entry) => entry.segments[0]));
    const conflicts = [...topLevelNames].filter((name) => takenKeys.has(mapNodeNameToKey(name)));

    const { usedBytes } = drive.usage(userId);
    return {
      folderCount: folderPaths.size,
      fileCount,
      totalBytes,
      conflicts,
      quotaOk: usedBytes + totalBytes <= config.userQuotaBytes,
    };
  });

  app.post("/api/drive/import", async (request): Promise<ImportResult> => {
    const { userId } = request;
    const payload = await readMultipart(request);
    const archive = parseArchive(requireFile(payload).buffer);
    const target = drive.requireFolder(userId, payload.fields.targetParentId || null);
    const onConflict = (payload.fields.onConflict || undefined) as OnConflictStrategy | undefined;

    const totalBytes = archive.files.reduce((sum, entry) => sum + entry.data.byteLength, 0);
    const { usedBytes } = drive.usage(userId);
    if (usedBytes + totalBytes > config.userQuotaBytes) {
      throw new ApiError(ApiErrorCode.QUOTA_EXCEEDED, {
        usedBytes,
        quotaBytes: config.userQuotaBytes,
        addedBytes: totalBytes,
      });
    }

    const result: ImportResult = {
      createdFolders: 0,
      createdFiles: 0,
      overwrittenFiles: 0,
      skipped: [],
      failed: [],
    };
    /** 路径 → 已落地的目录节点 id，避免重复建目录 */
    const folderCache = new Map<string, string>([["", target.id]]);

    const ensureFolderPath = (segments: string[]): string | null => {
      let parentId = target.id;
      for (let i = 0; i < segments.length; i += 1) {
        const key = segments.slice(0, i + 1).join("/");
        const cached = folderCache.get(key);
        if (cached) {
          parentId = cached;
          continue;
        }
        const name = segments[i];
        const existing = drive.findChild(userId, parentId, mapNodeNameToKey(name));
        if (existing) {
          if (existing.kind !== NodeKind.FOLDER) return null;
          folderCache.set(key, existing.id);
          parentId = existing.id;
          continue;
        }
        const created = drive.createFolder(userId, parentId, name);
        result.createdFolders += 1;
        folderCache.set(key, created.id);
        parentId = created.id;
      }
      return parentId;
    };

    for (const entry of archive.files) {
      const displayPath = entry.segments.join("/");
      try {
        if (entry.isDirectory) {
          if (ensureFolderPath(entry.segments) === null) {
            result.failed.push({ path: displayPath, message: "同名位置已存在文件" });
          }
          continue;
        }

        const parentId = ensureFolderPath(entry.segments.slice(0, -1));
        if (parentId === null) {
          result.failed.push({ path: displayPath, message: "同名位置已存在文件" });
          continue;
        }

        const fileName = entry.segments[entry.segments.length - 1];
        const placement = resolveNamePlacement(
          drive,
          userId,
          parentId,
          fileName,
          onConflict ?? "rename",
        );
        if (placement.action === "skip") {
          result.skipped.push(displayPath);
          continue;
        }

        const buffer = Buffer.from(entry.data);
        const stored = await writeObject(userId, buffer);

        if (placement.action === "overwrite") {
          if (placement.existing.kind !== NodeKind.FILE) {
            await removeNode(drive, userId, placement.existing);
            drive.createFile(userId, parentId, {
              name: placement.name,
              mimeType: mapExtensionToMime(placement.name),
              sizeBytes: stored.sizeBytes,
              checksum: stored.checksum,
              storageId: stored.storageId,
              docKind: inferDocKind(placement.name),
            });
            result.createdFiles += 1;
            continue;
          }
          const oldStorageId = placement.existing.storageId;
          drive.replaceFileContent(placement.existing.id, {
            sizeBytes: stored.sizeBytes,
            checksum: stored.checksum,
            storageId: stored.storageId,
            mimeType: mapExtensionToMime(placement.name),
          });
          if (oldStorageId) await deleteObject(userId, oldStorageId);
          result.overwrittenFiles += 1;
          continue;
        }

        drive.createFile(userId, parentId, {
          name: placement.name,
          mimeType: mapExtensionToMime(placement.name),
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          storageId: stored.storageId,
          docKind: inferDocKind(placement.name),
        });
        result.createdFiles += 1;
      } catch (error) {
        result.failed.push({ path: displayPath, message: (error as Error).message });
      }
    }

    return result;
  });
}
