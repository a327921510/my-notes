import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { config } from "../config.js";
import * as schema from "./schema.js";

/**
 * 1.0.0 是全新基线，不存在历史库，直接建表即可，不引入迁移链。
 * 后续如需变更结构，再按 drizzle-kit 生成迁移。
 */
const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     email_normalized TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     password_version INTEGER NOT NULL DEFAULT 1,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_normalized ON users (email_normalized)`,
  `CREATE TABLE IF NOT EXISTS drive_nodes (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     parent_id TEXT REFERENCES drive_nodes(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     name TEXT NOT NULL,
     name_key TEXT NOT NULL,
     mime_type TEXT,
     size_bytes INTEGER NOT NULL DEFAULT 0,
     checksum TEXT,
     storage_id TEXT,
     doc_kind TEXT,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_drive_nodes_sibling_name
     ON drive_nodes (user_id, parent_id, name_key)`,
  `CREATE INDEX IF NOT EXISTS idx_drive_nodes_parent ON drive_nodes (user_id, parent_id)`,
  `CREATE INDEX IF NOT EXISTS idx_drive_nodes_name ON drive_nodes (user_id, name_key)`,
  `CREATE TABLE IF NOT EXISTS storage_objects (
     storage_id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     size_bytes INTEGER NOT NULL,
     checksum TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];

export function createDatabase(dbPath: string = config.databaseFile) {
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  for (const statement of CREATE_STATEMENTS) sqlite.exec(statement);

  return { db: drizzle(sqlite, { schema }), sqlite };
}

export type DrizzleDB = ReturnType<typeof createDatabase>["db"];
