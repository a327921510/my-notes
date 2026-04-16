import { and, eq } from "drizzle-orm";
import type Database from "better-sqlite3";

import type { DrizzleDB } from "../db/client.js";
import * as schema from "../db/schema.js";
import type {
  Repository,
  StoredDriveFile,
  StoredDriveFolder,
  StoredNote,
  StoredNoteImage,
  StoredSite,
  StoredSiteItem,
  StoredSnippet,
  StoredUser,
} from "./types.js";

export function createSqliteRepository(
  db: DrizzleDB,
  sqlite: Database.Database,
): Repository {
  runMigrations(sqlite);

  return {
    /* ── Users ───────────────────────────────────────────────── */
    findUserByEmailNormalized(emailNormalized) {
      const row = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.emailNormalized, emailNormalized))
        .get();
      return row ? toUser(row) : undefined;
    },

    createUser(user) {
      db.insert(schema.users)
        .values({
          id: user.id,
          email: user.email,
          emailNormalized: user.emailNormalized,
          passwordHash: user.passwordHash,
          createdAt: user.createdAt,
        })
        .run();
    },

    /* ── Notes ──────────────────────────────────────────────── */
    getNoteByCloudId(cloudId) {
      const row = db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.cloudId, cloudId))
        .get();
      if (!row) return undefined;
      return attachImages(db, row);
    },

    listNotesByUser(userId) {
      const rows = db
        .select()
        .from(schema.notes)
        .where(eq(schema.notes.userId, userId))
        .all();
      return rows.map((r) => attachImages(db, r));
    },

    upsertNote(note) {
      sqlite.transaction(() => {
        db.insert(schema.notes)
          .values({
            cloudId: note.cloudId,
            userId: note.userId,
            clientNoteId: note.clientNoteId,
            title: note.title,
            contentText: note.contentText,
            updatedAt: note.updatedAt,
          })
          .onConflictDoUpdate({
            target: schema.notes.cloudId,
            set: {
              title: note.title,
              contentText: note.contentText,
              updatedAt: note.updatedAt,
            },
          })
          .run();

        db.delete(schema.noteImages)
          .where(eq(schema.noteImages.noteCloudId, note.cloudId))
          .run();

        for (const img of note.images) {
          db.insert(schema.noteImages)
            .values({
              noteCloudId: note.cloudId,
              clientImageId: img.clientImageId,
              storageId: img.storageId,
              checksum: img.checksum,
            })
            .run();
        }
      })();
    },

    deleteNote(cloudId) {
      db.delete(schema.notes)
        .where(eq(schema.notes.cloudId, cloudId))
        .run();
    },

    /* ── Snippets ──────────────────────────────────────────── */
    getSnippetByCloudId(cloudId) {
      const row = db
        .select()
        .from(schema.snippets)
        .where(eq(schema.snippets.cloudId, cloudId))
        .get();
      return row ? toSnippet(row) : undefined;
    },

    listSnippetsByUser(userId) {
      return db
        .select()
        .from(schema.snippets)
        .where(eq(schema.snippets.userId, userId))
        .all()
        .map(toSnippet);
    },

    upsertSnippet(snippet) {
      db.insert(schema.snippets)
        .values({
          cloudId: snippet.cloudId,
          userId: snippet.userId,
          clientSnippetId: snippet.clientSnippetId,
          type: snippet.type,
          content: snippet.content,
          sourceDomain: snippet.sourceDomain,
          sourceUrl: snippet.sourceUrl,
          updatedAt: snippet.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.snippets.cloudId,
          set: {
            type: snippet.type,
            content: snippet.content,
            sourceDomain: snippet.sourceDomain,
            sourceUrl: snippet.sourceUrl,
            updatedAt: snippet.updatedAt,
          },
        })
        .run();
    },

    deleteSnippet(cloudId) {
      db.delete(schema.snippets)
        .where(eq(schema.snippets.cloudId, cloudId))
        .run();
    },

    /* ── Sites ─────────────────────────────────────────────── */
    getSiteByCloudId(cloudId) {
      const row = db
        .select()
        .from(schema.sites)
        .where(eq(schema.sites.cloudId, cloudId))
        .get();
      return row ? toSite(row) : undefined;
    },

    listSitesByUser(userId) {
      return db
        .select()
        .from(schema.sites)
        .where(eq(schema.sites.userId, userId))
        .all()
        .map(toSite);
    },

    findDuplicateSite(userId, excludeClientSiteId, name, address) {
      const rows = db
        .select()
        .from(schema.sites)
        .where(eq(schema.sites.userId, userId))
        .all();

      return rows
        .map(toSite)
        .find(
          (s) =>
            s.clientSiteId !== excludeClientSiteId &&
            s.name.trim().toLowerCase() === name.toLowerCase() &&
            s.address.trim().toLowerCase() === address.toLowerCase(),
        );
    },

    upsertSite(site) {
      db.insert(schema.sites)
        .values({
          cloudId: site.cloudId,
          userId: site.userId,
          clientSiteId: site.clientSiteId,
          name: site.name,
          address: site.address,
          version: site.version,
          updatedAt: site.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.sites.cloudId,
          set: {
            name: site.name,
            address: site.address,
            version: site.version,
            updatedAt: site.updatedAt,
          },
        })
        .run();
    },

    deleteSite(cloudId) {
      db.delete(schema.sites)
        .where(eq(schema.sites.cloudId, cloudId))
        .run();
    },

    /* ── Site Items ────────────────────────────────────────── */
    getSiteItemByCloudId(cloudId) {
      const row = db
        .select()
        .from(schema.siteItems)
        .where(eq(schema.siteItems.cloudId, cloudId))
        .get();
      return row ? toSiteItem(row) : undefined;
    },

    listSiteItemsByUser(userId) {
      return db
        .select()
        .from(schema.siteItems)
        .where(eq(schema.siteItems.userId, userId))
        .all()
        .map(toSiteItem);
    },

    upsertSiteItem(item) {
      db.insert(schema.siteItems)
        .values({
          cloudId: item.cloudId,
          userId: item.userId,
          clientItemId: item.clientItemId,
          clientSiteId: item.clientSiteId,
          name: item.name,
          content: item.content,
          updatedAt: item.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.siteItems.cloudId,
          set: {
            name: item.name,
            content: item.content,
            updatedAt: item.updatedAt,
          },
        })
        .run();
    },

    deleteSiteItem(cloudId) {
      db.delete(schema.siteItems)
        .where(eq(schema.siteItems.cloudId, cloudId))
        .run();
    },

    deleteSiteItemsByUserAndSite(userId, clientSiteId) {
      db.delete(schema.siteItems)
        .where(
          and(
            eq(schema.siteItems.userId, userId),
            eq(schema.siteItems.clientSiteId, clientSiteId),
          ),
        )
        .run();
    },

    /* ── Drive Folders ─────────────────────────────────────── */
    listDriveFoldersByUser(userId) {
      return db
        .select()
        .from(schema.driveFolders)
        .where(eq(schema.driveFolders.userId, userId))
        .all()
        .map(toDriveFolder);
    },

    upsertDriveFolder(folder) {
      db.insert(schema.driveFolders)
        .values({
          cloudId: folder.cloudId,
          userId: folder.userId,
          clientFolderId: folder.clientFolderId,
          name: folder.name,
          parentId: folder.parentId,
          path: folder.path,
          updatedAt: folder.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.driveFolders.cloudId,
          set: {
            name: folder.name,
            parentId: folder.parentId,
            path: folder.path,
            updatedAt: folder.updatedAt,
          },
        })
        .run();
    },

    /* ── Drive Files ───────────────────────────────────────── */
    getDriveFileByCloudId(cloudId) {
      const row = db
        .select()
        .from(schema.driveFiles)
        .where(eq(schema.driveFiles.cloudId, cloudId))
        .get();
      return row ? toDriveFile(row) : undefined;
    },

    listDriveFilesByUser(userId) {
      return db
        .select()
        .from(schema.driveFiles)
        .where(eq(schema.driveFiles.userId, userId))
        .all()
        .map(toDriveFile);
    },

    upsertDriveFile(file) {
      db.insert(schema.driveFiles)
        .values({
          cloudId: file.cloudId,
          userId: file.userId,
          clientFileId: file.clientFileId,
          clientFolderId: file.clientFolderId,
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          checksum: file.checksum,
          storageId: file.storageId,
          updatedAt: file.updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.driveFiles.cloudId,
          set: {
            clientFolderId: file.clientFolderId,
            name: file.name,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            checksum: file.checksum,
            storageId: file.storageId,
            updatedAt: file.updatedAt,
          },
        })
        .run();
    },

    deleteDriveFile(cloudId) {
      db.delete(schema.driveFiles)
        .where(eq(schema.driveFiles.cloudId, cloudId))
        .run();
    },

    /* ── File Ownership ────────────────────────────────────── */
    getFileOwner(storageId) {
      const row = db
        .select()
        .from(schema.fileOwners)
        .where(eq(schema.fileOwners.storageId, storageId))
        .get();
      return row?.userId;
    },

    setFileOwner(storageId, userId) {
      db.insert(schema.fileOwners)
        .values({ storageId, userId })
        .onConflictDoUpdate({
          target: schema.fileOwners.storageId,
          set: { userId },
        })
        .run();
    },

    deleteFileOwner(storageId) {
      db.delete(schema.fileOwners)
        .where(eq(schema.fileOwners.storageId, storageId))
        .run();
    },

    /* ── Lifecycle ─────────────────────────────────────────── */
    close() {
      sqlite.close();
    },
  };
}

/* ── Internal helpers ─────────────────────────────────────────── */

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id                TEXT PRIMARY KEY,
      email             TEXT NOT NULL,
      email_normalized  TEXT NOT NULL,
      password_hash     TEXT NOT NULL,
      created_at        INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users(email_normalized);

    CREATE TABLE IF NOT EXISTS notes (
      cloud_id        TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      client_note_id  TEXT NOT NULL,
      title           TEXT NOT NULL,
      content_text    TEXT NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS note_images (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      note_cloud_id   TEXT NOT NULL REFERENCES notes(cloud_id) ON DELETE CASCADE,
      client_image_id TEXT NOT NULL,
      storage_id      TEXT NOT NULL,
      checksum        TEXT
    );

    CREATE TABLE IF NOT EXISTS snippets (
      cloud_id           TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL,
      client_snippet_id  TEXT NOT NULL,
      type               TEXT NOT NULL,
      content            TEXT NOT NULL,
      source_domain      TEXT NOT NULL,
      source_url         TEXT,
      updated_at         INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      cloud_id        TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      client_site_id  TEXT NOT NULL,
      name            TEXT NOT NULL,
      address         TEXT NOT NULL,
      version         INTEGER NOT NULL DEFAULT 1,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS site_items (
      cloud_id        TEXT PRIMARY KEY,
      user_id         TEXT NOT NULL,
      client_item_id  TEXT NOT NULL,
      client_site_id  TEXT NOT NULL,
      name            TEXT NOT NULL,
      content         TEXT NOT NULL,
      updated_at      INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drive_folders (
      cloud_id          TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL,
      client_folder_id  TEXT NOT NULL,
      name              TEXT NOT NULL,
      parent_id         TEXT,
      path              TEXT,
      updated_at        INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drive_files (
      cloud_id          TEXT PRIMARY KEY,
      user_id           TEXT NOT NULL,
      client_file_id    TEXT NOT NULL,
      client_folder_id  TEXT NOT NULL,
      name              TEXT NOT NULL,
      mime_type         TEXT,
      size_bytes        INTEGER NOT NULL,
      checksum          TEXT,
      storage_id        TEXT NOT NULL,
      updated_at        INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_owners (
      storage_id  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
    CREATE INDEX IF NOT EXISTS idx_note_images_note_cloud_id ON note_images(note_cloud_id);
    CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id);
    CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites(user_id);
    CREATE INDEX IF NOT EXISTS idx_site_items_user_id ON site_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_site_items_client_site_id ON site_items(client_site_id);
    CREATE INDEX IF NOT EXISTS idx_drive_folders_user_id ON drive_folders(user_id);
    CREATE INDEX IF NOT EXISTS idx_drive_files_user_id ON drive_files(user_id);
  `);
}

function toUser(row: typeof schema.users.$inferSelect): StoredUser {
  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.emailNormalized,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
  };
}

type NoteRow = typeof schema.notes.$inferSelect;
type NoteImageRow = typeof schema.noteImages.$inferSelect;

function attachImages(db: DrizzleDB, row: NoteRow): StoredNote {
  const imgRows = db
    .select()
    .from(schema.noteImages)
    .where(eq(schema.noteImages.noteCloudId, row.cloudId))
    .all();
  return {
    userId: row.userId,
    clientNoteId: row.clientNoteId,
    cloudId: row.cloudId,
    title: row.title,
    contentText: row.contentText,
    updatedAt: row.updatedAt,
    images: imgRows.map(toNoteImage),
  };
}

function toNoteImage(row: NoteImageRow): StoredNoteImage {
  return {
    clientImageId: row.clientImageId,
    storageId: row.storageId,
    checksum: row.checksum ?? undefined,
  };
}

function toSnippet(row: typeof schema.snippets.$inferSelect): StoredSnippet {
  return {
    userId: row.userId,
    clientSnippetId: row.clientSnippetId,
    cloudId: row.cloudId,
    type: row.type,
    content: row.content,
    sourceDomain: row.sourceDomain,
    sourceUrl: row.sourceUrl ?? undefined,
    updatedAt: row.updatedAt,
  };
}

function toSite(row: typeof schema.sites.$inferSelect): StoredSite {
  return {
    userId: row.userId,
    clientSiteId: row.clientSiteId,
    cloudId: row.cloudId,
    name: row.name,
    address: row.address,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function toSiteItem(row: typeof schema.siteItems.$inferSelect): StoredSiteItem {
  return {
    userId: row.userId,
    clientItemId: row.clientItemId,
    clientSiteId: row.clientSiteId,
    cloudId: row.cloudId,
    name: row.name,
    content: row.content,
    updatedAt: row.updatedAt,
  };
}

function toDriveFolder(
  row: typeof schema.driveFolders.$inferSelect,
): StoredDriveFolder {
  return {
    userId: row.userId,
    clientFolderId: row.clientFolderId,
    cloudId: row.cloudId,
    name: row.name,
    parentId: row.parentId,
    path: row.path ?? undefined,
    updatedAt: row.updatedAt,
  };
}

function toDriveFile(
  row: typeof schema.driveFiles.$inferSelect,
): StoredDriveFile {
  return {
    userId: row.userId,
    clientFileId: row.clientFileId,
    clientFolderId: row.clientFolderId,
    cloudId: row.cloudId,
    name: row.name,
    mimeType: row.mimeType ?? undefined,
    sizeBytes: row.sizeBytes,
    checksum: row.checksum ?? undefined,
    storageId: row.storageId,
    updatedAt: row.updatedAt,
  };
}
