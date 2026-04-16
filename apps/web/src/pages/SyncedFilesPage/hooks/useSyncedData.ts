import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";

import { useAuthStore } from "@/stores/useAuthStore";
import { noteApi } from "@/services/modules/note";
import { snippetApi } from "@/services/modules/snippet";
import { db } from "@my-notes/local-db";

import type { SyncedRow } from "../types";

export function useSyncedData() {
  const token = useAuthStore((s) => s.token);

  const notes = useLiveQuery(
    () =>
      db.notes
        .filter((n) => !n.deletedAt && n.syncStatus === "synced" && !!n.cloudId)
        .toArray(),
    [],
  );

  const snippets = useLiveQuery(
    () => db.snippets.filter((s) => s.syncStatus === "synced" && !!s.cloudId).toArray(),
    [],
  );

  const dataSource = useMemo<SyncedRow[]>(
    () =>
      [
        ...(notes ?? []).map((n) => ({
          key: `n-${n.id}`,
          kind: "note" as const,
          title: n.title || "（无标题）",
          id: n.id,
          cloudId: n.cloudId,
          updatedAt: n.updatedAt,
        })),
        ...(snippets ?? []).map((s) => ({
          key: `s-${s.id}`,
          kind: "snippet" as const,
          title: s.content.slice(0, 48) + (s.content.length > 48 ? "…" : ""),
          id: s.id,
          cloudId: s.cloudId,
          updatedAt: s.updatedAt,
          sourceDomain: s.sourceDomain,
        })),
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    [notes, snippets],
  );

  const deleteRow = useCallback(
    async (row: SyncedRow, deleteCloud: boolean) => {
      const alsoCloud = deleteCloud && token;
      if (alsoCloud) {
        if (row.kind === "note") {
          await noteApi.delete(row.id);
        } else {
          await snippetApi.delete(row.id);
        }
      }
      if (row.kind === "note") {
        await db.notes.update(row.id, { deletedAt: Date.now() });
      } else {
        await db.snippets.delete(row.id);
      }
      return alsoCloud;
    },
    [token],
  );

  return {
    token,
    dataSource,
    deleteRow,
  };
}
