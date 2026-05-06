export type {
  SiteProjectBackupPayload,
  SiteProjectBackupProject,
  SiteProjectBackupSite,
  SiteProjectBackupItem,
  SiteProjectImportStats,
} from "./types";
export {
  SITE_PROJECT_BACKUP_VERSION,
  parseSiteProjectPayload,
  normProjectName,
  siteDedupKey,
  itemDedupKey,
} from "./types";
export { buildSiteProjectExportPayload } from "./exportPayload";
export { applySiteProjectImport } from "./applyImport";

import type { SiteProjectBackupPayload } from "./types";

export function downloadSiteProjectBackup(payload: SiteProjectBackupPayload): void {
  const name = `site-project-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
