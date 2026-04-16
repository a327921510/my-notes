/**
 * Pure conflict-detection and merge-decision functions for CloudDrive folders/files.
 * Used by Web, Extension, and API — no Dexie / network dependency.
 */

import type { SyncStatus } from "./records";

export type CloudDriveFolderPayload = {
  cloudId: string;
  clientFolderId: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
};

export type CloudDriveFilePayload = {
  cloudId: string;
  clientFileId: string;
  clientFolderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  storageId: string;
  updatedAt: number;
};

export type LocalDriveFolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
};

export type LocalDriveFileRow = {
  id: string;
  folderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  cloudStorageId?: string;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
};

export function hasDriveFolderConflict(
  local: LocalDriveFolderRow,
  remote: CloudDriveFolderPayload,
): boolean {
  return local.name !== remote.name;
}

export function hasDriveFileConflict(
  local: LocalDriveFileRow,
  remote: CloudDriveFilePayload,
): boolean {
  if (local.checksum && remote.checksum) {
    return local.checksum !== remote.checksum;
  }
  return local.name !== remote.name || local.sizeBytes !== remote.sizeBytes;
}

export type DriveFolderPullDecision =
  | { type: "insert" }
  | { type: "update" }
  | { type: "noop" };

/**
 * LWW: remote timestamp wins when newer; same or older → noop (keep local).
 */
export function decideDriveFolderPull(
  local: LocalDriveFolderRow | undefined,
  remote: CloudDriveFolderPayload,
): DriveFolderPullDecision {
  if (!local) return { type: "insert" };
  if (remote.updatedAt > local.updatedAt || hasDriveFolderConflict(local, remote)) {
    return { type: "update" };
  }
  return { type: "noop" };
}

export type DriveFilePullDecision =
  | { type: "insert" }
  | { type: "update" }
  | { type: "noop" };

/**
 * LWW for drive files: remote wins when newer or checksum differs.
 */
export function decideDriveFilePull(
  local: LocalDriveFileRow | undefined,
  remote: CloudDriveFilePayload,
): DriveFilePullDecision {
  if (!local) return { type: "insert" };
  if (remote.updatedAt > local.updatedAt || hasDriveFileConflict(local, remote)) {
    return { type: "update" };
  }
  return { type: "noop" };
}

/**
 * Whether a previously-synced local drive entity should be downgraded to `local_only`
 * when the cloud no longer carries it (cloud-side deletion detected during pull).
 */
export function shouldDriveEntityFallbackToLocal(
  syncStatus: SyncStatus,
  cloudId: string | undefined,
): boolean {
  return syncStatus === "synced" && !!cloudId;
}
