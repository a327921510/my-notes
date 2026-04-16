import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as schema from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, "..", "..", "data", "my-notes.db");

export async function createDatabase(dbPath?: string) {
  const resolvedPath = dbPath ?? process.env.DB_PATH ?? DEFAULT_DB_PATH;
  await mkdir(path.dirname(resolvedPath), { recursive: true });

  const sqlite = new Database(resolvedPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export type DrizzleDB = Awaited<ReturnType<typeof createDatabase>>["db"];
