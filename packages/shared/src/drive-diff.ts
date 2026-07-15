/**
 * Pure changeset computation for the CloudDrive "同步对比" (sync comparison) view.
 *
 * Given the local drive state (folders/files/tombstones) and the remote
 * manifest, produce a GitHub/GitLab-style list of changes for a given
 * direction (push = 本地→远端, pull = 远端→本地). No Dexie / network here.
 */

import type {
  CloudDriveFilePayload,
  CloudDriveFolderPayload,
  LocalDriveFileRow,
  LocalDriveFolderRow,
} from "./sync-drive-pure";

export const SyncDirection = {
  PUSH: "push",
  PULL: "pull",
} as const;
export type SyncDirection = (typeof SyncDirection)[keyof typeof SyncDirection];

export const DriveChangeStatus = {
  /** Present on the source, missing on the target → will be created. */
  ADDED: "added",
  /** Present on both sides but content differs → will be overwritten. */
  MODIFIED: "modified",
  /** Will be deleted on the target side. */
  REMOVED: "removed",
  /** Identical on both sides. */
  UNCHANGED: "unchanged",
} as const;
export type DriveChangeStatus = (typeof DriveChangeStatus)[keyof typeof DriveChangeStatus];

export const DriveEntryKind = {
  FOLDER: "folder",
  FILE: "file",
} as const;
export type DriveEntryKind = (typeof DriveEntryKind)[keyof typeof DriveEntryKind];

export type DriveEntrySnapshot = {
  name: string;
  sizeBytes?: number;
  checksum?: string;
  mimeType?: string;
  updatedAt: number;
};

export type DriveDiffEntry = {
  /** Stable key = client file/folder id. */
  key: string;
  kind: DriveEntryKind;
  /** Full POSIX-like path, e.g. "/docs/readme.txt". */
  path: string;
  name: string;
  status: DriveChangeStatus;
  /** The local (本地) snapshot, when present. */
  local?: DriveEntrySnapshot;
  /** The remote (远端) snapshot, when present. */
  remote?: DriveEntrySnapshot;
};

export type DriveDiffSummary = {
  added: number;
  modified: number;
  removed: number;
  unchanged: number;
};

export type DriveDiffResult = {
  direction: SyncDirection;
  entries: DriveDiffEntry[];
  summary: DriveDiffSummary;
};

export type DriveDiffInput = {
  localFolders: LocalDriveFolderRow[];
  localFiles: LocalDriveFileRow[];
  /** clientFileIds that were locally deleted but still exist on the cloud. */
  tombstoneClientFileIds: string[];
  remoteFolders: CloudDriveFolderPayload[];
  remoteFiles: CloudDriveFilePayload[];
};

function buildLocalFolderPathMap(folders: LocalDriveFolderRow[]): Map<string, string> {
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
  for (const folder of folders) resolve(folder.id, new Set());
  return cache;
}

function buildRemoteFolderPathMap(folders: CloudDriveFolderPayload[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.clientFolderId, f]));
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
  for (const folder of folders) resolve(folder.clientFolderId, new Set());
  return cache;
}

function localFileSnapshot(file: LocalDriveFileRow): DriveEntrySnapshot {
  return {
    name: file.name,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    mimeType: file.mimeType,
    updatedAt: file.updatedAt,
  };
}

function remoteFileSnapshot(file: CloudDriveFilePayload): DriveEntrySnapshot {
  return {
    name: file.name,
    sizeBytes: file.sizeBytes,
    checksum: file.checksum,
    mimeType: file.mimeType,
    updatedAt: file.updatedAt,
  };
}

/** Content difference between a local file and its remote counterpart. */
export function fileContentDiffers(local: DriveEntrySnapshot, remote: DriveEntrySnapshot): boolean {
  if (local.checksum && remote.checksum) return local.checksum !== remote.checksum;
  return (
    local.name !== remote.name ||
    (local.sizeBytes ?? -1) !== (remote.sizeBytes ?? -1) ||
    local.updatedAt !== remote.updatedAt
  );
}

function emptySummary(): DriveDiffSummary {
  return { added: 0, modified: 0, removed: 0, unchanged: 0 };
}

function tallySummary(entries: DriveDiffEntry[]): DriveDiffSummary {
  const summary = emptySummary();
  for (const entry of entries) {
    if (entry.status === DriveChangeStatus.ADDED) summary.added += 1;
    else if (entry.status === DriveChangeStatus.MODIFIED) summary.modified += 1;
    else if (entry.status === DriveChangeStatus.REMOVED) summary.removed += 1;
    else summary.unchanged += 1;
  }
  return summary;
}

function sortEntries(entries: DriveDiffEntry[]): DriveDiffEntry[] {
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

function computePushEntries(input: DriveDiffInput): DriveDiffEntry[] {
  const localFolderPaths = buildLocalFolderPathMap(input.localFolders);
  const remoteFileById = new Map(input.remoteFiles.map((f) => [f.clientFileId, f]));
  const remoteFolderById = new Map(input.remoteFolders.map((f) => [f.clientFolderId, f]));
  const entries: DriveDiffEntry[] = [];

  for (const folder of input.localFolders) {
    if (!remoteFolderById.has(folder.id)) {
      entries.push({
        key: folder.id,
        kind: DriveEntryKind.FOLDER,
        path: localFolderPaths.get(folder.id) ?? `/${folder.name}`,
        name: folder.name,
        status: DriveChangeStatus.ADDED,
        local: { name: folder.name, updatedAt: folder.updatedAt },
      });
    }
  }

  for (const file of input.localFiles) {
    const folderPath = localFolderPaths.get(file.folderId) ?? "";
    const path = `${folderPath}/${file.name}`;
    const remote = remoteFileById.get(file.id);
    const localSnap = localFileSnapshot(file);
    if (!remote) {
      entries.push({
        key: file.id,
        kind: DriveEntryKind.FILE,
        path,
        name: file.name,
        status: DriveChangeStatus.ADDED,
        local: localSnap,
      });
      continue;
    }
    const remoteSnap = remoteFileSnapshot(remote);
    const changed = fileContentDiffers(localSnap, remoteSnap);
    entries.push({
      key: file.id,
      kind: DriveEntryKind.FILE,
      path,
      name: file.name,
      status: changed ? DriveChangeStatus.MODIFIED : DriveChangeStatus.UNCHANGED,
      local: localSnap,
      remote: remoteSnap,
    });
  }

  const tombstoneSet = new Set(input.tombstoneClientFileIds);
  for (const remote of input.remoteFiles) {
    if (tombstoneSet.has(remote.clientFileId)) {
      const remoteFolderPaths = buildRemoteFolderPathMap(input.remoteFolders);
      const folderPath = remoteFolderPaths.get(remote.clientFolderId) ?? "";
      entries.push({
        key: remote.clientFileId,
        kind: DriveEntryKind.FILE,
        path: `${folderPath}/${remote.name}`,
        name: remote.name,
        status: DriveChangeStatus.REMOVED,
        remote: remoteFileSnapshot(remote),
      });
    }
  }

  return sortEntries(entries);
}

function computePullEntries(input: DriveDiffInput): DriveDiffEntry[] {
  const remoteFolderPaths = buildRemoteFolderPathMap(input.remoteFolders);
  const localFolderById = new Map(input.localFolders.map((f) => [f.id, f]));
  const localFileById = new Map(input.localFiles.map((f) => [f.id, f]));
  const remoteFileIdSet = new Set(input.remoteFiles.map((f) => f.clientFileId));
  const entries: DriveDiffEntry[] = [];

  for (const folder of input.remoteFolders) {
    if (!localFolderById.has(folder.clientFolderId)) {
      entries.push({
        key: folder.clientFolderId,
        kind: DriveEntryKind.FOLDER,
        path: remoteFolderPaths.get(folder.clientFolderId) ?? `/${folder.name}`,
        name: folder.name,
        status: DriveChangeStatus.ADDED,
        remote: { name: folder.name, updatedAt: folder.updatedAt },
      });
    }
  }

  for (const remote of input.remoteFiles) {
    const folderPath = remoteFolderPaths.get(remote.clientFolderId) ?? "";
    const path = `${folderPath}/${remote.name}`;
    const local = localFileById.get(remote.clientFileId);
    const remoteSnap = remoteFileSnapshot(remote);
    if (!local) {
      entries.push({
        key: remote.clientFileId,
        kind: DriveEntryKind.FILE,
        path,
        name: remote.name,
        status: DriveChangeStatus.ADDED,
        remote: remoteSnap,
      });
      continue;
    }
    const localSnap = localFileSnapshot(local);
    const changed = fileContentDiffers(localSnap, remoteSnap);
    entries.push({
      key: remote.clientFileId,
      kind: DriveEntryKind.FILE,
      path,
      name: remote.name,
      status: changed ? DriveChangeStatus.MODIFIED : DriveChangeStatus.UNCHANGED,
      local: localSnap,
      remote: remoteSnap,
    });
  }

  const localFolderPaths = buildLocalFolderPathMap(input.localFolders);
  for (const local of input.localFiles) {
    const wasSynced = local.syncStatus === "synced" || !!local.cloudId;
    if (wasSynced && !remoteFileIdSet.has(local.id)) {
      const folderPath = localFolderPaths.get(local.folderId) ?? "";
      entries.push({
        key: local.id,
        kind: DriveEntryKind.FILE,
        path: `${folderPath}/${local.name}`,
        name: local.name,
        status: DriveChangeStatus.REMOVED,
        local: localFileSnapshot(local),
      });
    }
  }

  return sortEntries(entries);
}

export function computeDriveDiff(direction: SyncDirection, input: DriveDiffInput): DriveDiffResult {
  const entries = direction === SyncDirection.PUSH ? computePushEntries(input) : computePullEntries(input);
  return { direction, entries, summary: tallySummary(entries) };
}

/** Whether there is anything actionable (non-unchanged) in a diff result. */
export function hasActionableChanges(result: DriveDiffResult): boolean {
  return result.summary.added + result.summary.modified + result.summary.removed > 0;
}
