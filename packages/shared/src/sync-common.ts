import type { SyncStatus } from "./records";

/** After local edit: previously synced or failed rows become dirty and need upload. */
export function nextSyncAfterEdit(current: SyncStatus): SyncStatus {
  if (current === "synced") return "dirty";
  if (current === "failed") return "dirty";
  return current;
}

export function needsUpload(syncStatus: SyncStatus): boolean {
  return syncStatus === "local_only" || syncStatus === "dirty" || syncStatus === "failed";
}
