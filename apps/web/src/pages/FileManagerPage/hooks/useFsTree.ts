/**
 * 订阅 fs_folders / fs_files，供树形 UI 组装。
 */
import { useLiveQuery } from "dexie-react-hooks";

import { db, type FsFileRow, type FsFolderRow } from "@my-notes/local-db";

const EMPTY_FOLDERS: FsFolderRow[] = [];
const EMPTY_FILES: FsFileRow[] = [];

export function useFsTree() {
  const folders = useLiveQuery(() => db.fs_folders.toArray(), []) ?? EMPTY_FOLDERS;
  const files = useLiveQuery(() => db.fs_files.toArray(), []) ?? EMPTY_FILES;

  return { folders, files };
}
