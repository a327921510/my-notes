import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("idx_users_email_normalized").on(t.emailNormalized)],
);

export const notes = sqliteTable("notes", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientNoteId: text("client_note_id").notNull(),
  title: text("title").notNull(),
  contentText: text("content_text").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const noteImages = sqliteTable("note_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noteCloudId: text("note_cloud_id")
    .notNull()
    .references(() => notes.cloudId, { onDelete: "cascade" }),
  clientImageId: text("client_image_id").notNull(),
  storageId: text("storage_id").notNull(),
  checksum: text("checksum"),
});

export const snippets = sqliteTable("snippets", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientSnippetId: text("client_snippet_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  sourceDomain: text("source_domain").notNull(),
  sourceUrl: text("source_url"),
  updatedAt: integer("updated_at").notNull(),
});

export const projects = sqliteTable("projects", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientProjectId: text("client_project_id").notNull(),
  name: text("name").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sites = sqliteTable("sites", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientSiteId: text("client_site_id").notNull(),
  name: text("name").notNull(),
  /** 允许空字符串 */
  address: text("address").notNull(),
  clientProjectId: text("client_project_id"),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

export const siteItems = sqliteTable("site_items", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientItemId: text("client_item_id").notNull(),
  clientSiteId: text("client_site_id"),
  clientProjectId: text("client_project_id"),
  name: text("name").notNull(),
  content: text("content").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const driveFolders = sqliteTable("drive_folders", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientFolderId: text("client_folder_id").notNull(),
  name: text("name").notNull(),
  parentId: text("parent_id"),
  path: text("path"),
  updatedAt: integer("updated_at").notNull(),
});

export const driveFiles = sqliteTable("drive_files", {
  cloudId: text("cloud_id").primaryKey(),
  userId: text("user_id").notNull(),
  clientFileId: text("client_file_id").notNull(),
  clientFolderId: text("client_folder_id").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum"),
  storageId: text("storage_id").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const fileOwners = sqliteTable("file_owners", {
  storageId: text("storage_id").primaryKey(),
  userId: text("user_id").notNull(),
});
