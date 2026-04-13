import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@my-notes/local-db";

export function useCloudDrivePageData(selectedFolderId: string | null, searchKeyword: string) {
  const folders = useLiveQuery(() => db.drive_folders.orderBy("createdAt").toArray(), []) ?? [];
  const files = useLiveQuery(() => db.drive_files.orderBy("createdAt").toArray(), []) ?? [];

  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    if (!normalizedKeyword) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(normalizedKeyword));
  }, [folders, normalizedKeyword]);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId],
  );

  const selectedFiles = useMemo(() => {
    if (!selectedFolderId) return [];
    const scoped = files.filter((file) => file.folderId === selectedFolderId);
    if (!normalizedKeyword) return scoped;
    return scoped.filter((file) => file.name.toLowerCase().includes(normalizedKeyword));
  }, [files, normalizedKeyword, selectedFolderId]);

  return {
    folders,
    files,
    filteredFolders,
    selectedFolder,
    selectedFiles,
  };
}
