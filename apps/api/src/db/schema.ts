import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailNormalized: text("email_normalized").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** 修改密码后自增，用于让旧 token 失效 */
    passwordVersion: integer("password_version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("idx_users_email_normalized").on(t.emailNormalized)],
);

/** 目录与文件统一为节点，以 kind 区分；user_id 是隔离键。 */
export const driveNodes = sqliteTable(
  "drive_nodes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    /** null 表示根节点，每个账号有且仅有一个 */
    parentId: text("parent_id"),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    /** 归一化名（去首尾空格 + 小写），同级唯一 */
    nameKey: text("name_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    checksum: text("checksum"),
    storageId: text("storage_id"),
    /** `mmd` 表示系统专属文档 */
    docKind: text("doc_kind"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_drive_nodes_sibling_name").on(t.userId, t.parentId, t.nameKey),
    index("idx_drive_nodes_parent").on(t.userId, t.parentId),
    index("idx_drive_nodes_name").on(t.userId, t.nameKey),
  ],
);

export const storageObjects = sqliteTable("storage_objects", {
  storageId: text("storage_id").primaryKey(),
  userId: text("user_id").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  checksum: text("checksum").notNull(),
  createdAt: integer("created_at").notNull(),
});
