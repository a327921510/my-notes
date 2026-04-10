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
  }
}

export const db = new NotesDB();
