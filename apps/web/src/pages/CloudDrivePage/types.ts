import type { SyncStatus } from "@my-notes/shared";

export type DriveFolder = {
  id: string;
  name: string;
  parentId: string | null;
  path?: string;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
};

export type DriveFile = {
  id: string;
  folderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  localBlobRef?: string;
  localPath?: string;
  cloudUrl?: string;
  cloudStorageId?: string;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
};

export type ConflictRecord = {
  id: string;
  entityType: "folder" | "file";
  entityId: string;
  field: string;
  localValue: string;
  cloudValue: string;
  resolvedBy: "lww";
  resolvedAt: number;
};
