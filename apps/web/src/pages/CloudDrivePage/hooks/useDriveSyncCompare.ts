import { useCallback, useRef, useState } from "react";

import { db } from "@my-notes/local-db";
import {
  type CloudDriveFilePayload,
  type DriveDiffEntry,
  type DriveDiffResult,
  DriveChangeStatus,
  DriveEntryKind,
  SyncDirection,
  type TextDiffResult,
  computeDriveDiff,
  diffLines,
} from "@my-notes/shared";
import {
  fetchCloudFileText,
  fetchRemoteDriveManifest,
  pullDriveFromCloud,
  pushDriveToCloud,
} from "@/lib/drive-sync";

export type EntryCompareContent = {
  kind: "text" | "binary" | "folder";
  /** Old (base) side text for the unified diff. */
  oldText?: string;
  /** New (target) side text for the unified diff. */
  newText?: string;
  diff?: TextDiffResult;
  loading: boolean;
  error?: string;
};

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "tsv",
  "html",
  "htm",
  "xml",
  "css",
  "less",
  "scss",
  "js",
  "jsx",
  "ts",
  "tsx",
  "yml",
  "yaml",
  "sql",
  "sh",
  "log",
  "env",
  "ini",
  "conf",
]);

function isTextLike(name: string, mimeType?: string): boolean {
  if (mimeType) {
    if (mimeType.startsWith("text/")) return true;
    if (mimeType === "application/json" || mimeType === "application/xml") return true;
    if (mimeType.includes("javascript") || mimeType.includes("typescript")) return true;
  }
  const ext = name.split(".").pop()?.toLowerCase();
  return ext ? TEXT_EXTENSIONS.has(ext) : false;
}

async function readLocalFileText(clientFileId: string): Promise<string> {
  const file = await db.drive_files.get(clientFileId);
  if (!file?.localBlobRef) return "";
  const row = await db.blobs.get(file.localBlobRef);
  if (!row) return "";
  return row.blob.text();
}

export type DriveSyncCompareState = {
  open: boolean;
  direction: SyncDirection;
  loading: boolean;
  applying: boolean;
  error: string | null;
  diff: DriveDiffResult | null;
  selectedKey: string | null;
};

export function useDriveSyncCompare(token: string | null) {
  const [state, setState] = useState<DriveSyncCompareState>({
    open: false,
    direction: SyncDirection.PUSH,
    loading: false,
    applying: false,
    error: null,
    diff: null,
    selectedKey: null,
  });
  const remoteFilesRef = useRef<Map<string, CloudDriveFilePayload>>(new Map());

  const loadDiff = useCallback(
    async (direction: SyncDirection) => {
      if (!token) {
        setState((prev) => ({ ...prev, error: "请先登录后再进行同步对比" }));
        return;
      }
      setState((prev) => ({ ...prev, loading: true, error: null, direction }));
      try {
        const [manifest, localFolders, localFiles, tombstones] = await Promise.all([
          fetchRemoteDriveManifest(token),
          db.drive_folders.toArray(),
          db.drive_files.toArray(),
          db.drive_file_tombstones.toArray(),
        ]);
        remoteFilesRef.current = new Map(manifest.files.map((f) => [f.clientFileId, f]));
        const diff = computeDriveDiff(direction, {
          localFolders,
          localFiles,
          tombstoneClientFileIds: tombstones.map((t) => t.clientFileId),
          remoteFolders: manifest.folders,
          remoteFiles: manifest.files,
        });
        const firstActionable =
          diff.entries.find((e) => e.status !== DriveChangeStatus.UNCHANGED) ?? diff.entries[0] ?? null;
        setState((prev) => ({
          ...prev,
          loading: false,
          diff,
          selectedKey: firstActionable?.key ?? null,
        }));
      } catch (e) {
        setState((prev) => ({ ...prev, loading: false, error: (e as Error).message }));
      }
    },
    [token],
  );

  const openCompare = useCallback(
    async (direction: SyncDirection) => {
      setState((prev) => ({ ...prev, open: true, direction }));
      await loadDiff(direction);
    },
    [loadDiff],
  );

  const closeCompare = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const setDirection = useCallback(
    (direction: SyncDirection) => {
      void loadDiff(direction);
    },
    [loadDiff],
  );

  const selectEntry = useCallback((key: string) => {
    setState((prev) => ({ ...prev, selectedKey: key }));
  }, []);

  const loadEntryContent = useCallback(
    async (entry: DriveDiffEntry, direction: SyncDirection): Promise<EntryCompareContent> => {
      if (entry.kind === DriveEntryKind.FOLDER) {
        return { kind: "folder", loading: false };
      }
      const meta = entry.remote ?? entry.local;
      const textLike = meta ? isTextLike(entry.name, meta.mimeType) : false;
      if (!textLike) {
        return { kind: "binary", loading: false };
      }

      try {
        const localText = entry.local ? await readLocalFileText(entry.key) : "";
        let remoteText = "";
        if (entry.remote && token) {
          const remoteFile = remoteFilesRef.current.get(entry.key);
          if (remoteFile) {
            remoteText = await fetchCloudFileText(token, remoteFile.cloudId);
          }
        }
        const oldText = direction === SyncDirection.PUSH ? remoteText : localText;
        const newText = direction === SyncDirection.PUSH ? localText : remoteText;
        const diff = diffLines(oldText, newText);
        return { kind: "text", oldText, newText, diff, loading: false };
      } catch (e) {
        return { kind: "text", loading: false, error: (e as Error).message };
      }
    },
    [token],
  );

  const applyCurrent = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!token) return { ok: false, message: "请先登录后再同步" };
    setState((prev) => ({ ...prev, applying: true, error: null }));
    try {
      let message: string;
      if (state.direction === SyncDirection.PUSH) {
        const res = await pushDriveToCloud(token);
        message = `上行完成：目录 ${res.foldersSynced}，文件 ${res.filesSynced}${
          res.failedFileIds.length > 0 ? `，失败 ${res.failedFileIds.length}` : ""
        }`;
      } else {
        const res = await pullDriveFromCloud(token);
        message = `下行完成：新增目录 ${res.createdFolders}，更新文件 ${res.pulledFiles}`;
      }
      await loadDiff(state.direction);
      setState((prev) => ({ ...prev, applying: false }));
      return { ok: true, message };
    } catch (e) {
      setState((prev) => ({ ...prev, applying: false, error: (e as Error).message }));
      return { ok: false, message: (e as Error).message };
    }
  }, [token, state.direction, loadDiff]);

  return {
    state,
    openCompare,
    closeCompare,
    setDirection,
    selectEntry,
    loadEntryContent,
    applyCurrent,
    refresh: loadDiff,
  };
}
