import { createDatabase } from "../db/client.js";
import { createSqliteRepository } from "./sqlite.js";
import type { Repository } from "./types.js";

export type { Repository } from "./types.js";
export type {
  StoredUser,
  StoredNote,
  StoredNoteImage,
  StoredSnippet,
  StoredProject,
  StoredSite,
  StoredSiteItem,
  StoredDriveFolder,
  StoredDriveFile,
} from "./types.js";

/**
 * Initialise the repository.
 *
 * Currently returns a SQLite-backed implementation.
 * To switch databases, replace the body of this function — all callers
 * depend only on the `Repository` interface.
 */
export async function initRepository(): Promise<Repository> {
  const { db, sqlite } = await createDatabase();
  return createSqliteRepository(db, sqlite);
}
