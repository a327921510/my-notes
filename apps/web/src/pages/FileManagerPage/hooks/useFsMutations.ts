/**
 * 文件管理目录 / 文件 CRUD：同级重名与非法字符校验；不与冻结的 drive_* 共用。
 */
import { useCallback } from "react";

import { db, type FsFileKind } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";

import {
  assertValidNodeName,
  ensureFileExtension,
  kindFromFileName,
  normalizeName,
} from "../types";

async function listSiblingFolders(parentId: string | null) {
  if (parentId === null) {
    return db.fs_folders.filter((f) => f.parentId === null).toArray();
  }
  return db.fs_folders.where("parentId").equals(parentId).toArray();
}

async function listSiblingFiles(folderId: string | null) {
  if (folderId === null) {
    return db.fs_files.filter((f) => f.folderId === null).toArray();
  }
  return db.fs_files.where("folderId").equals(folderId).toArray();
}

export function useFsMutations() {
  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    const trimmed = assertValidNodeName(name, "文件夹名称");
    const siblings = await listSiblingFolders(parentId);
    if (siblings.some((f) => normalizeName(f.name) === normalizeName(trimmed))) {
      throw new Error("同级目录下名称不能重复");
    }
    const id = createId("fs_folder");
    const now = Date.now();
    await db.fs_folders.add({
      id,
      name: trimmed,
      parentId,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }, []);

  const renameFolder = useCallback(async (folderId: string, nextName: string) => {
    const current = await db.fs_folders.get(folderId);
    if (!current) return;
    const trimmed = assertValidNodeName(nextName, "文件夹名称");
    const siblings = await listSiblingFolders(current.parentId);
    if (
      siblings.some(
        (f) => f.id !== folderId && normalizeName(f.name) === normalizeName(trimmed),
      )
    ) {
      throw new Error("同级目录下名称不能重复");
    }
    await db.fs_folders.update(folderId, { name: trimmed, updatedAt: Date.now() });
  }, []);

  const removeFolder = useCallback(async (folderId: string) => {
    const childFolders = await db.fs_folders.where("parentId").equals(folderId).count();
    const childFiles = await db.fs_files.where("folderId").equals(folderId).count();
    if (childFolders > 0 || childFiles > 0) {
      throw new Error("目录非空，请先删除子文件夹与文件");
    }
    await db.fs_folders.delete(folderId);
  }, []);

  const createFile = useCallback(
    async (payload: { folderId: string | null; name: string; kind: FsFileKind }) => {
      const withExt = ensureFileExtension(payload.name, payload.kind);
      const trimmed = assertValidNodeName(withExt, "文件名");
      const kind = kindFromFileName(trimmed);
      if (kind !== payload.kind) {
        throw new Error(`文件扩展名须为 .${payload.kind}`);
      }
      const siblings = await listSiblingFiles(payload.folderId);
      if (siblings.some((f) => normalizeName(f.name) === normalizeName(trimmed))) {
        throw new Error("同一目录下文件名不能重复");
      }
      const id = createId("fs_file");
      const now = Date.now();
      await db.fs_files.add({
        id,
        folderId: payload.folderId,
        name: trimmed,
        kind,
        contentText: "",
        createdAt: now,
        updatedAt: now,
      });
      return id;
    },
    [],
  );

  const renameFile = useCallback(async (fileId: string, nextName: string) => {
    const current = await db.fs_files.get(fileId);
    if (!current) return;
    const withExt = ensureFileExtension(nextName, current.kind);
    const trimmed = assertValidNodeName(withExt, "文件名");
    const kind = kindFromFileName(trimmed);
    if (kind !== current.kind) {
      throw new Error(`重命名须保持 .${current.kind} 扩展名`);
    }
    const siblings = await listSiblingFiles(current.folderId);
    if (
      siblings.some(
        (f) => f.id !== fileId && normalizeName(f.name) === normalizeName(trimmed),
      )
    ) {
      throw new Error("同一目录下文件名不能重复");
    }
    await db.fs_files.update(fileId, {
      name: trimmed,
      kind,
      updatedAt: Date.now(),
    });
  }, []);

  const removeFile = useCallback(async (fileId: string) => {
    await db.fs_files.delete(fileId);
  }, []);

  return {
    createFolder,
    renameFolder,
    removeFolder,
    createFile,
    renameFile,
    removeFile,
  };
}
