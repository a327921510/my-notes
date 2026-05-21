import Dexie, { type EntityTable } from "dexie";
import type {
  ClipRecord,
  FolderRecord,
  ImageRecord,
  NoteRecord,
  SiteSpaceRecord,
  SnippetRecord,
} from "@my-notes/shared";

/** Dexie 物理库名（Web / 桌面端共用同一常量，各-origin 仍各有一份 IndexedDB）。 */
export const NOTES_DB_NAME = "my_notes_v2";

export type ProjectRow = {
  id: string;
  name: string;
  updatedAt: number;
};

export type SiteRow = {
  id: string;
  name: string;
  /** 允许为空字符串 */
  address: string;
  projectId?: string | null;
  version: number;
  updatedAt: number;
};

export type SiteItemRow = {
  id: string;
  /** 挂站点时必填；纯项目条目为空 */
  siteId?: string | null;
  /** 冗余：便于按项目筛选；挂站点时与站点 projectId 一致 */
  projectId?: string | null;
  name: string;
  content: string;
  updatedAt: number;
};

export type DriveFolderRow = {
  id: string;
  name: string;
  parentId: string | null;
  path?: string;
  createdAt: number;
  updatedAt: number;
};

export type DriveFileRow = {
  id: string;
  folderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  localBlobRef?: string;
  localPath?: string;
  createdAt: number;
  updatedAt: number;
};

export class NotesDB extends Dexie {
  folders!: EntityTable<FolderRecord, "id">;
  notes!: EntityTable<NoteRecord, "id">;
  images!: EntityTable<ImageRecord, "id">;
  snippets!: EntityTable<SnippetRecord, "id">;
  site_spaces!: EntityTable<SiteSpaceRecord, "id">;
  clips!: EntityTable<ClipRecord, "id">;
  blobs!: EntityTable<{ key: string; blob: Blob }, "key">;
  projects!: EntityTable<ProjectRow, "id">;
  sites!: EntityTable<SiteRow, "id">;
  site_items!: EntityTable<SiteItemRow, "id">;
  drive_folders!: EntityTable<DriveFolderRow, "id">;
  drive_files!: EntityTable<DriveFileRow, "id">;

  constructor() {
    super(NOTES_DB_NAME);
    this.version(1).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      projects: "id, name, updatedAt",
      sites: "id, name, version, projectId, updatedAt",
      site_items: "id, siteId, projectId, updatedAt",
      drive_folders: "id, parentId, name, createdAt, updatedAt",
      drive_files: "id, folderId, name, createdAt, updatedAt",
    });
  }
}

export const db = new NotesDB();
