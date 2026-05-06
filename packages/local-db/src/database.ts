import Dexie, { type EntityTable } from "dexie";
import type {
  ClipRecord,
  FolderRecord,
  ImageRecord,
  NoteRecord,
  SiteSpaceRecord,
  SnippetRecord,
  SyncStatus,
} from "@my-notes/shared";

/** Dexie 物理库名（Web / 扩展共用同一常量，各-origin 仍各有一份 IndexedDB）。 */
export const NOTES_DB_NAME = "my_notes_v2";

export class NotesDB extends Dexie {
  folders!: EntityTable<FolderRecord, "id">;
  notes!: EntityTable<NoteRecord, "id">;
  images!: EntityTable<ImageRecord, "id">;
  snippets!: EntityTable<SnippetRecord, "id">;
  site_spaces!: EntityTable<SiteSpaceRecord, "id">;
  clips!: EntityTable<ClipRecord, "id">;
  blobs!: EntityTable<{ key: string; blob: Blob }, "key">;
  projects!: EntityTable<
    {
      id: string;
      name: string;
      updatedAt: number;
      syncStatus: SyncStatus;
      cloudId?: string;
    },
    "id"
  >;
  sites!: EntityTable<
    {
      id: string;
      name: string;
      /** 允许为空字符串 */
      address: string;
      projectId?: string | null;
      version: number;
      updatedAt: number;
      syncStatus: SyncStatus;
      cloudId?: string;
    },
    "id"
  >;
  site_items!: EntityTable<
    {
      id: string;
      /** 挂站点时必填；纯项目条目为空 */
      siteId?: string | null;
      /** 冗余：便于按项目筛选；挂站点时与站点 projectId 一致 */
      projectId?: string | null;
      name: string;
      content: string;
      updatedAt: number;
      syncStatus: SyncStatus;
      cloudId?: string;
    },
    "id"
  >;
  drive_folders!: EntityTable<
    {
      id: string;
      name: string;
      parentId: string | null;
      path?: string;
      createdAt: number;
      updatedAt: number;
      syncStatus: SyncStatus;
      cloudId?: string;
    },
    "id"
  >;
  drive_files!: EntityTable<
    {
      id: string;
      folderId: string;
      name: string;
      mimeType?: string;
      sizeBytes: number;
      checksum?: string;
      localBlobRef?: string;
      localPath?: string;
      cloudUrl?: string;
      cloudStorageId?: string;
      createdAt: number;
      updatedAt: number;
      syncStatus: SyncStatus;
      cloudId?: string;
    },
    "id"
  >;
  drive_file_tombstones!: EntityTable<
    {
      id: string;
      clientFileId: string;
      cloudId: string;
      deletedAt: number;
      syncStatus: "pending" | "failed";
    },
    "id"
  >;

  constructor() {
    super(NOTES_DB_NAME);
    this.version(1).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      projects: "id, name, updatedAt, syncStatus",
      sites: "id, name, version, projectId, updatedAt, syncStatus",
      site_items: "id, siteId, projectId, updatedAt, syncStatus",
      drive_folders: "id, parentId, name, createdAt, updatedAt, syncStatus",
      drive_files: "id, folderId, name, createdAt, updatedAt, syncStatus, cloudStorageId",
      drive_file_tombstones: "id, clientFileId, cloudId, deletedAt, syncStatus",
    });
  }
}

export const db = new NotesDB();
