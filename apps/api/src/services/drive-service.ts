import {
  ApiErrorCode,
  type DriveNode,
  type NodeBrief,
  NodeKind,
  OnConflictStrategy,
  checkNodeName,
  isMmdName,
  mapNameToDedupedName,
  mapNodeNameToKey,
} from "@my-notes/shared";

import { config } from "../config.js";
import { ApiError } from "../errors.js";
import type { DriveRepository, NodeRow } from "../repository/drive.js";
import { deleteObject } from "../storage.js";

export function mapNodeToDto(row: NodeRow): DriveNode {
  return {
    id: row.id,
    parentId: row.parentId,
    kind: row.kind as NodeKind,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum,
    docKind: row.docKind as "mmd" | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapNodeToBrief(row: NodeRow): NodeBrief {
  return { id: row.id, name: row.name, kind: row.kind as NodeKind };
}

export function inferDocKind(name: string): "mmd" | null {
  return isMmdName(name) ? "mmd" : null;
}

export function assertValidName(name: string): string {
  const error = checkNodeName(name);
  if (error) throw new ApiError(ApiErrorCode.NODE_NAME_INVALID, { reason: error });
  return name.trim();
}

export function assertNotRoot(node: NodeRow): void {
  if (node.parentId === null) throw new ApiError(ApiErrorCode.NODE_ROOT_IMMUTABLE);
}

export function assertQuota(repo: DriveRepository, userId: string, addedBytes: number): void {
  if (addedBytes <= 0) return;
  const { usedBytes } = repo.usage(userId);
  if (usedBytes + addedBytes > config.userQuotaBytes) {
    throw new ApiError(ApiErrorCode.QUOTA_EXCEEDED, {
      usedBytes,
      quotaBytes: config.userQuotaBytes,
      addedBytes,
    });
  }
}

export function assertFileSize(sizeBytes: number): void {
  if (sizeBytes > config.maxFileSizeBytes) {
    throw new ApiError(ApiErrorCode.FILE_TOO_LARGE, { maxFileSizeBytes: config.maxFileSizeBytes });
  }
}

export type NamePlacement =
  | { action: "create"; name: string }
  | { action: "overwrite"; name: string; existing: NodeRow }
  | { action: "skip"; name: string };

/**
 * 目标目录已存在同名时按策略决定落点。
 * 未指定策略即视为「拒绝」，向前端抛 NODE_NAME_CONFLICT 由用户选择。
 */
export function resolveNamePlacement(
  repo: DriveRepository,
  userId: string,
  parentId: string,
  rawName: string,
  onConflict: OnConflictStrategy | undefined,
  options: { excludeId?: string } = {},
): NamePlacement {
  const name = assertValidName(rawName);
  const existing = repo.findChild(userId, parentId, mapNodeNameToKey(name));

  if (!existing || existing.id === options.excludeId) return { action: "create", name };

  switch (onConflict) {
    case OnConflictStrategy.RENAME:
      return { action: "create", name: mapNameToDedupedName(name, repo.takenNameKeys(userId, parentId)) };
    case OnConflictStrategy.OVERWRITE:
      return { action: "overwrite", name, existing };
    case OnConflictStrategy.SKIP:
      return { action: "skip", name };
    default:
      throw new ApiError(ApiErrorCode.NODE_NAME_CONFLICT, { name });
  }
}

/** 覆盖一个已存在的同名节点：目录无法被文件覆盖，反之亦然。 */
export async function removeNode(
  repo: DriveRepository,
  userId: string,
  node: NodeRow,
): Promise<void> {
  const storageIds = repo.deleteSubtree(userId, node);
  await Promise.all(storageIds.map((storageId) => deleteObject(userId, storageId)));
}
