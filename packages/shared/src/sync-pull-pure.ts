import type { NoteRecord, SnippetRecord, SnippetType } from "./records";

export interface CloudNotePayload {
  cloudId: string;
  clientNoteId: string;
  title: string;
  contentText: string;
  updatedAt: number;
  images: { clientImageId: string; storageId: string; checksum?: string }[];
}

export interface CloudSnippetPayload {
  cloudId: string;
  clientSnippetId: string;
  type: string;
  content: string;
  sourceDomain: string;
  sourceUrl?: string;
  updatedAt: number;
}

export function hasNoteConflict(local: NoteRecord, cloud: CloudNotePayload): boolean {
  return local.contentText !== cloud.contentText || (local.title || "") !== (cloud.title || "");
}

export type NotePullDecision =
  | { type: "skip_deleted" }
  | { type: "noop" }
  | { type: "insert"; row: NoteRecord }
  | {
      type: "update";
      id: string;
      patch: {
        title: string;
        contentText: string;
        updatedAt: number;
        syncStatus: "synced";
        cloudId: string;
      };
    }
  | { type: "conflict"; row: Omit<NoteRecord, "id"> };

/**
 * Pure mirror of Web pull note loop: skip deleted, insert missing, LWW update, or duplicate row on content conflict when local is newer or same time.
 */
export function decideNotePull(
  local: NoteRecord | undefined,
  cloud: CloudNotePayload,
  defaultFolderId: string,
): NotePullDecision {
  if (local?.deletedAt) return { type: "skip_deleted" };
  if (!local) {
    return {
      type: "insert",
      row: {
        id: cloud.clientNoteId,
        folderId: defaultFolderId,
        title: cloud.title,
        contentText: cloud.contentText,
        updatedAt: cloud.updatedAt,
        syncStatus: "synced",
        cloudId: cloud.cloudId,
      },
    };
  }
  if (cloud.updatedAt > local.updatedAt) {
    return {
      type: "update",
      id: local.id,
      patch: {
        title: cloud.title,
        contentText: cloud.contentText,
        updatedAt: cloud.updatedAt,
        syncStatus: "synced",
        cloudId: cloud.cloudId,
      },
    };
  }
  if (hasNoteConflict(local, cloud)) {
    return {
      type: "conflict",
      row: {
        folderId: local.folderId ?? defaultFolderId,
        title: cloud.title ? `${cloud.title}（云端副本）` : "云端副本",
        contentText: cloud.contentText,
        updatedAt: cloud.updatedAt,
        syncStatus: "synced",
        cloudId: cloud.cloudId,
      },
    };
  }
  return { type: "noop" };
}

export function snippetPullShouldApply(local: SnippetRecord | undefined, cloud: CloudSnippetPayload): boolean {
  if (!local) return true;
  return cloud.updatedAt > local.updatedAt;
}

/**
 * Row to upsert when {@link snippetPullShouldApply} is true.
 * Cloud wins on sync payload fields (including `type`); local IndexedDB-only fields
 * (e.g. `sourceTitle`, and `createdAt` when already present) are kept until API carries them.
 */
export function buildSnippetRowFromCloudPull(
  local: SnippetRecord | undefined,
  cloud: CloudSnippetPayload,
): SnippetRecord {
  const fromCloud = {
    id: cloud.clientSnippetId,
    type: cloud.type as SnippetType,
    content: cloud.content,
    sourceDomain: cloud.sourceDomain,
    sourceUrl: cloud.sourceUrl,
    updatedAt: cloud.updatedAt,
    syncStatus: "synced" as const,
    cloudId: cloud.cloudId,
  };
  if (!local) {
    return { ...fromCloud, createdAt: cloud.updatedAt };
  }
  return { ...local, ...fromCloud };
}
