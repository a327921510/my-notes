import { useCallback } from "react";

import { db } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit } from "@my-notes/shared";

const ILLEGAL_FILE_NAME_CHARS = /[\\/:*?"<>|]/;

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function useCloudDriveMutations() {
  const createFolder = useCallback(async (name: string, parentId: string | null = null) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("目录名称不能为空");
    const normalized = normalize(trimmed);
    const siblings =
      parentId === null
        ? await db.drive_folders.filter((folder) => folder.parentId === null).toArray()
        : await db.drive_folders.where("parentId").equals(parentId).toArray();
    const exists = siblings.some((folder) => normalize(folder.name) === normalized);
    if (exists) throw new Error("同级目录下名称不能重复");

    const id = createId("drive_folder");
    const now = Date.now();
    await db.drive_folders.add({
      id,
      name: trimmed,
      parentId,
      path: `/${trimmed}`,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local_only",
    });
    return id;
  }, []);

  const removeFolder = useCallback(async (folderId: string) => {
    const children = await db.drive_files.where("folderId").equals(folderId).toArray();
    if (children.length > 0) {
      throw new Error("目录包含文件，请先删除文件后再删除目录");
    }
    await db.drive_folders.delete(folderId);
  }, []);

  const addFile = useCallback(async (payload: { folderId: string; file: File }) => {
    const trimmed = payload.file.name.trim();
    if (!trimmed) throw new Error("文件名不能为空");
    if (ILLEGAL_FILE_NAME_CHARS.test(trimmed)) throw new Error("文件名包含非法字符");
    if (payload.file.size < 0) throw new Error("文件大小无效");

    const siblings = await db.drive_files.where("folderId").equals(payload.folderId).toArray();
    if (siblings.some((file) => normalize(file.name) === normalize(trimmed))) {
      throw new Error("同一目录下文件名不能重复");
    }

    const id = createId("drive_file");
    const blobKey = createId("blob");
    const now = Date.now();
    await db.blobs.put({ key: blobKey, blob: payload.file });
    await db.drive_files.add({
      id,
      folderId: payload.folderId,
      name: trimmed,
      sizeBytes: payload.file.size,
      mimeType: payload.file.type || undefined,
      checksum: `${payload.file.size}-${payload.file.lastModified}-${now}`,
      localBlobRef: blobKey,
      createdAt: now,
      updatedAt: now,
      syncStatus: "local_only",
    });
    return id;
  }, []);

  const renameFile = useCallback(async (fileId: string, nextName: string) => {
    const current = await db.drive_files.get(fileId);
    if (!current) return;
    const trimmed = nextName.trim();
    if (!trimmed) throw new Error("文件名不能为空");
    if (ILLEGAL_FILE_NAME_CHARS.test(trimmed)) throw new Error("文件名包含非法字符");

    const siblings = await db.drive_files.where("folderId").equals(current.folderId).toArray();
    const duplicated = siblings.some((file) => file.id !== fileId && normalize(file.name) === normalize(trimmed));
    if (duplicated) throw new Error("同一目录下文件名不能重复");

    await db.drive_files.update(fileId, {
      name: trimmed,
      updatedAt: Date.now(),
      syncStatus: nextSyncAfterEdit(current.syncStatus),
    });
  }, []);

  const removeFile = useCallback(async (fileId: string) => {
    const current = await db.drive_files.get(fileId);
    if (current?.cloudId) {
      await db.drive_file_tombstones.put({
        id: createId("drive_delete"),
        clientFileId: current.id,
        cloudId: current.cloudId,
        deletedAt: Date.now(),
        syncStatus: "pending",
      });
    }
    if (current?.localBlobRef) {
      await db.blobs.delete(current.localBlobRef);
    }
    await db.drive_files.delete(fileId);
  }, []);

  return {
    createFolder,
    removeFolder,
    addFile,
    renameFile,
    removeFile,
  };
}
