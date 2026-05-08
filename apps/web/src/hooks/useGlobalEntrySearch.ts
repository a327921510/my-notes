import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import {
  formatSiteItemDisplayName,
  PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME,
  SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
} from "@my-notes/shared";

import { db } from "@my-notes/local-db";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSnippet(text: string, keyword: string, maxLen = 120): string {
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  const idx = lower.indexOf(k);
  if (idx < 0) {
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + keyword.length + 60);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export type GlobalSearchHit =
  | {
      kind: "note";
      id: string;
      title: string;
      snippet: string;
    }
  | {
      kind: "siteItem";
      itemId: string;
      siteId: string;
      siteName: string;
      name: string;
      snippet: string;
    }
  | {
      kind: "projectItem";
      itemId: string;
      projectId: string;
      projectName: string;
      name: string;
      snippet: string;
    };

function matches(keyword: string, ...parts: string[]): boolean {
  const q = keyword.toLowerCase();
  return parts.some((p) => p.toLowerCase().includes(q));
}

export function useGlobalEntrySearch(keyword: string) {
  const noteRows =
    useLiveQuery(() => db.notes.filter((n) => !n.deletedAt).toArray(), []) ?? [];
  const itemRows = useLiveQuery(() => db.site_items.toArray(), []) ?? [];
  const siteRows = useLiveQuery(() => db.sites.toArray(), []) ?? [];
  const projectRows = useLiveQuery(() => db.projects.toArray(), []) ?? [];

  const hits = useMemo(() => {
    const q = keyword.trim();
    if (!q) return [];

    const siteMap = new Map(siteRows.map((s) => [s.id, s]));
    const projectMap = new Map(projectRows.map((p) => [p.id, p]));
    const out: GlobalSearchHit[] = [];

    for (const n of noteRows) {
      const plain = stripHtml(n.contentText ?? "");
      const title = n.title || "";
      if (!matches(q, title, plain)) continue;
      out.push({
        kind: "note",
        id: n.id,
        title: title.trim() || "无标题",
        snippet: makeSnippet(plain, q),
      });
    }

    for (const it of itemRows) {
      if (it.name === SITE_MARKDOWN_DOCUMENT_ITEM_NAME || it.name === PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME) {
        continue;
      }
      const plain = stripHtml(it.content ?? "");
      const rawName = it.name || "";
      const displayName = formatSiteItemDisplayName(rawName);
      if (!matches(q, rawName, plain, displayName)) continue;
      const snippet = makeSnippet(plain, q);

      if (it.siteId) {
        const site = siteMap.get(it.siteId);
        out.push({
          kind: "siteItem",
          itemId: it.id,
          siteId: it.siteId,
          siteName: site?.name?.trim() || "未命名站点",
          name: displayName.trim() || "未命名条目",
          snippet,
        });
      } else if (it.projectId) {
        const proj = projectMap.get(it.projectId);
        out.push({
          kind: "projectItem",
          itemId: it.id,
          projectId: it.projectId,
          projectName: proj?.name?.trim() || "未命名项目",
          name: displayName.trim() || "未命名条目",
          snippet,
        });
      }
    }

    return out.sort((a, b) => {
      const titleA = a.kind === "note" ? a.title : a.name;
      const titleB = b.kind === "note" ? b.title : b.name;
      return titleA.localeCompare(titleB, "zh-Hans");
    });
  }, [itemRows, keyword, noteRows, projectRows, siteRows]);

  return { hits };
}
