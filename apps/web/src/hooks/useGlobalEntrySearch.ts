import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";

import { db } from "@my-notes/local-db";

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

export type GlobalSearchHit = {
  kind: "fsFile";
  id: string;
  path: string;
  name: string;
  snippet: string;
};

function matches(keyword: string, ...parts: string[]): boolean {
  const q = keyword.toLowerCase();
  return parts.some((p) => p.toLowerCase().includes(q));
}

export function useGlobalEntrySearch(keyword: string) {
  // 订阅 fs 表变化；路径拼接在 memo 内与 live 数据对齐
  const fileRows = useLiveQuery(() => db.fs_files.toArray(), []) ?? [];
  const folderRows = useLiveQuery(() => db.fs_folders.toArray(), []) ?? [];

  const hits = useMemo(() => {
    const q = keyword.trim();
    if (!q) return [];

    // 轻量就地建 path（避免每次搜索都 await）
    const folderPathById = new Map<string, string>();
    const byId = new Map(folderRows.map((f) => [f.id, f]));
    const resolve = (id: string, stack: Set<string>): string => {
      const cached = folderPathById.get(id);
      if (cached) return cached;
      if (stack.has(id)) return "/";
      stack.add(id);
      const row = byId.get(id);
      if (!row) return "/";
      const parent =
        row.parentId == null ? "/" : resolve(row.parentId, stack);
      const path = parent === "/" ? `/${row.name}` : `${parent}/${row.name}`;
      folderPathById.set(id, path);
      stack.delete(id);
      return path;
    };
    for (const f of folderRows) resolve(f.id, new Set());

    const out: GlobalSearchHit[] = [];
    for (const f of fileRows) {
      const parentPath =
        f.folderId == null ? "/" : (folderPathById.get(f.folderId) ?? "/");
      const path = parentPath === "/" ? `/${f.name}` : `${parentPath}/${f.name}`;
      if (!matches(q, f.name, path, f.contentText ?? "")) continue;
      out.push({
        kind: "fsFile",
        id: f.id,
        path,
        name: f.name,
        snippet: makeSnippet(f.contentText || f.name, q),
      });
    }

    return out.sort((a, b) => a.path.localeCompare(b.path, "zh-Hans"));
  }, [fileRows, folderRows, keyword]);

  return { hits };
}
