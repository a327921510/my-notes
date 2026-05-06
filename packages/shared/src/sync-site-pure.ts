/**
 * Pure conflict-detection and merge-decision functions for Sites and SiteItems.
 * Used by Web, Extension, and API — no Dexie / network dependency.
 */

export type CloudSitePayload = {
  cloudId: string;
  clientSiteId: string;
  name: string;
  /** 允许为空字符串 */
  address: string;
  clientProjectId?: string | null;
  version: number;
  updatedAt: number;
};

export type CloudSiteItemPayload = {
  cloudId: string;
  clientItemId: string;
  /** 与条目关联的站点；纯项目条目可为空 */
  clientSiteId?: string | null;
  /** 冗余项目 id，与站点 project 或纯项目条目一致 */
  clientProjectId?: string | null;
  name: string;
  content: string;
  updatedAt: number;
};

export type LocalSiteRow = {
  id: string;
  name: string;
  address: string;
  projectId?: string | null;
  version: number;
  updatedAt: number;
  syncStatus: string;
  cloudId?: string;
};

export type LocalSiteItemRow = {
  id: string;
  siteId?: string | null;
  projectId?: string | null;
  name: string;
  content: string;
  updatedAt: number;
  syncStatus: string;
  cloudId?: string;
};

export function hasSiteConflict(local: LocalSiteRow, remote: CloudSitePayload): boolean {
  return (
    local.name !== remote.name ||
    local.address !== remote.address ||
    (local.projectId ?? null) !== (remote.clientProjectId ?? null)
  );
}

export function hasSiteItemConflict(
  local: LocalSiteItemRow,
  remote: CloudSiteItemPayload,
): boolean {
  return (
    local.name !== remote.name ||
    local.content !== remote.content ||
    (local.siteId ?? null) !== (remote.clientSiteId ?? null) ||
    (local.projectId ?? null) !== (remote.clientProjectId ?? null)
  );
}

export type SitePullDecision =
  | { type: "insert" }
  | { type: "noop" }
  | { type: "conflict_keep_both" };

/**
 * Decide what to do when pulling a remote site.
 * - No local record → insert
 * - Same name + address → noop (update metadata only)
 * - Different name or address → conflict: keep both (remote overwrites id, local gets a copy)
 */
export function decideSitePull(
  local: LocalSiteRow | undefined,
  remote: CloudSitePayload,
): SitePullDecision {
  if (!local) return { type: "insert" };
  if (!hasSiteConflict(local, remote)) return { type: "noop" };
  return { type: "conflict_keep_both" };
}

export type SiteItemPullDecision =
  | { type: "insert" }
  | { type: "noop" }
  | { type: "conflict_keep_both" };

/**
 * Decide what to do when pulling a remote site item.
 * - No local record → insert
 * - Same name + content + siteId → noop (update metadata only)
 * - Different → conflict: keep both (remote wins on original id, local old data gets a new id)
 */
export function decideSiteItemPull(
  local: LocalSiteItemRow | undefined,
  remote: CloudSiteItemPayload,
): SiteItemPullDecision {
  if (!local) return { type: "insert" };
  if (!hasSiteItemConflict(local, remote)) return { type: "noop" };
  return { type: "conflict_keep_both" };
}

/**
 * Whether a local site that was previously synced should be downgraded to
 * `local_only` because the remote no longer carries it.
 */
export function shouldDowngradeToLocalDraft(
  localSyncStatus: string,
  localCloudId: string | undefined,
  remoteIds: Set<string>,
  localId: string,
): boolean {
  const wasFromCloud = !!localCloudId || localSyncStatus === "synced";
  return wasFromCloud && !remoteIds.has(localId);
}
