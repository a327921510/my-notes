import { db } from "@my-notes/local-db";
import type { SnippetRecord } from "@my-notes/shared";

const LEGACY_KEY = "my_notes_snippets_v1";
const MIGRATED_FLAG = "my_notes_snippets_migrated_v1";

/** One-time import from pre–IndexedDB extension storage into Dexie. */
export async function migrateLegacySnippetsIfNeeded(): Promise<void> {
  const flag = await chrome.storage.local.get(MIGRATED_FLAG);
  if (flag[MIGRATED_FLAG]) return;

  const raw = await chrome.storage.local.get(LEGACY_KEY);
  const v = raw[LEGACY_KEY];
  if (Array.isArray(v)) {
    for (const row of v as SnippetRecord[]) {
      if (row?.id) await db.snippets.put(row);
    }
    await chrome.storage.local.remove(LEGACY_KEY);
  }
  await chrome.storage.local.set({ [MIGRATED_FLAG]: true });
}
