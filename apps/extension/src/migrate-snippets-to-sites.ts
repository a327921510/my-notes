import { db } from "@my-notes/local-db";
import { SNIPPET_TYPE_LABELS, createId, type SnippetType } from "@my-notes/shared";

const MIGRATED_KEY = "my_notes_extension_snippets_to_sites_v1";

/** 将扩展旧版「短文本 snippets」并入与 Web 站点页相同的 sites / site_items 表结构（仅本扩展 IndexedDB）。 */
export async function migrateSnippetsToSitesIfNeeded(): Promise<void> {
  const flag = await chrome.storage.local.get(MIGRATED_KEY);
  if (flag[MIGRATED_KEY]) return;

  const snippets = await db.snippets.toArray();
  if (snippets.length === 0) {
    await chrome.storage.local.set({ [MIGRATED_KEY]: true });
    return;
  }

  await db.transaction("rw", db.sites, db.site_items, db.snippets, async () => {
    const byDomain = new Map<string, typeof snippets>();
    for (const s of snippets) {
      const d = (s.sourceDomain ?? "").trim().toLowerCase();
      if (!d) continue;
      const arr = byDomain.get(d) ?? [];
      arr.push(s);
      byDomain.set(d, arr);
    }

    for (const [domain, rows] of byDomain) {
      const allSites = await db.sites.toArray();
      let siteId = allSites.find((x) => x.address.trim().toLowerCase() === domain)?.id;
      if (!siteId) {
        siteId = createId("site");
        await db.sites.add({
          id: siteId,
          name: domain,
          address: domain,
          updatedAt: Date.now(),
          version: 1,
          syncStatus: "local_only",
        });
      }
      for (const snip of rows) {
        const typeLabel = SNIPPET_TYPE_LABELS[snip.type as SnippetType] ?? String(snip.type);
        await db.site_items.add({
          id: createId("item"),
          siteId,
          name: typeLabel,
          content: snip.content,
          updatedAt: snip.updatedAt,
          syncStatus: "local_only",
        });
      }
    }

    await db.snippets.clear();
  });

  await chrome.storage.local.set({ [MIGRATED_KEY]: true });
}
