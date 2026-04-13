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

export class NotesDB extends Dexie {
  folders!: EntityTable<FolderRecord, "id">;
  notes!: EntityTable<NoteRecord, "id">;
  images!: EntityTable<ImageRecord, "id">;
  snippets!: EntityTable<SnippetRecord, "id">;
  site_spaces!: EntityTable<SiteSpaceRecord, "id">;
  clips!: EntityTable<ClipRecord, "id">;
  blobs!: EntityTable<{ key: string; blob: Blob }, "key">;
  sites!: EntityTable<
    {
      id: string;
      name: string;
      address: string;
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
      siteId: string;
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
    super("my_notes_v1");
    this.version(1).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
    });
    this.version(2).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
    });
    this.version(3).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, version, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
    });
    this.version(4).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, version, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
      drive_folders: "id, parentId, name, updatedAt, syncStatus",
      drive_files: "id, folderId, name, updatedAt, syncStatus",
    });
    this.version(5).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, version, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
      drive_folders: "id, parentId, name, createdAt, updatedAt, syncStatus",
      drive_files: "id, folderId, name, createdAt, updatedAt, syncStatus",
    });
    this.version(6).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, version, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
      drive_folders: "id, parentId, name, createdAt, updatedAt, syncStatus",
      drive_files: "id, folderId, name, createdAt, updatedAt, syncStatus, cloudStorageId",
    });
    this.version(7).stores({
      folders: "id, parentId, updatedAt, deletedAt",
      notes: "id, folderId, updatedAt, syncStatus, deletedAt",
      images: "id, noteId, sortOrder",
      snippets: "id, sourceDomain, type, updatedAt, syncStatus",
      site_spaces: "id, sourceDomain, updatedAt",
      clips: "id, sourceDomain, createdAt",
      blobs: "key",
      sites: "id, name, version, updatedAt, syncStatus",
      site_items: "id, siteId, updatedAt, syncStatus",
      drive_folders: "id, parentId, name, createdAt, updatedAt, syncStatus",
      drive_files: "id, folderId, name, createdAt, updatedAt, syncStatus, cloudStorageId",
      drive_file_tombstones: "id, clientFileId, cloudId, deletedAt, syncStatus",
    });
  }
}

export const db = new NotesDB();
