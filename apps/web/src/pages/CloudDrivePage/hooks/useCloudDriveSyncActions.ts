import { db } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";
import { pullDriveFromCloud, pushDriveToCloud } from "@/lib/drive-sync";
import type { ConflictRecord } from "../types";

type SyncTaskState = {
  running: boolean;
  type: "push" | "pull" | null;
};

export function useCloudDriveSyncActions(
  setTaskState: (next: SyncTaskState) => void,
  setConflicts: (updater: (prev: ConflictRecord[]) => ConflictRecord[]) => void,
) {
  const ensureLogin = (token: string | null) => {
    if (!token) {
      throw new Error("请先登录后再同步");
    }
  };

  const pushToCloud = async (token: string | null) => {
    ensureLogin(token);
    setTaskState({ running: true, type: "push" });
    try {
      const result = await pushDriveToCloud(token);
      return { foldersSynced: result.foldersSynced, filesSynced: result.filesSynced };
    } finally {
      setTaskState({ running: false, type: null });
    }
  };

  const pullFromCloud = async (token: string | null) => {
    ensureLogin(token);
    setTaskState({ running: true, type: "pull" });
    try {
      const pullResult = await pullDriveFromCloud(token);
      const dirtyFiles = await db.drive_files.filter((f) => f.syncStatus === "dirty").toArray();
      if (dirtyFiles.length > 0) {
        const resolvedAt = Date.now();
        setConflicts((prev) => [
          ...dirtyFiles.map<ConflictRecord>((file) => ({
            id: createId("conflict"),
            entityType: "file",
            entityId: file.id,
            field: "name",
            localValue: file.name,
            cloudValue: `${file.name}(cloud)`,
            resolvedBy: "lww",
            resolvedAt,
          })),
          ...prev,
        ]);
        for (const file of dirtyFiles) {
          await db.drive_files.update(file.id, { syncStatus: "synced", updatedAt: resolvedAt });
        }
      }

      return {
        createdFolders: pullResult.createdFolders,
        pulledConflicts: dirtyFiles.length,
        downgradedFolders: pullResult.downgradedFolders,
        downgradedFiles: pullResult.downgradedFiles,
      };
    } finally {
      setTaskState({ running: false, type: null });
    }
  };

  return {
    pushToCloud,
    pullFromCloud,
  };
}
