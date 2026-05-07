import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit, PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME } from "@my-notes/shared";

const SAVE_DEBOUNCE_MS = 500;

export function useProjectMarkdownDocument(projectId: string | null) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  const persist = useCallback(async (targetProjectId: string, text: string) => {
    const items = await db.site_items.where("projectId").equals(targetProjectId).toArray();
    const existing = items.find(
      (i) => i.name === PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME && !i.siteId,
    );
    if (existing) {
      await db.site_items.update(existing.id, {
        content: text,
        updatedAt: Date.now(),
        syncStatus: nextSyncAfterEdit(existing.syncStatus),
      });
    } else {
      await db.site_items.add({
        id: createId("item"),
        projectId: targetProjectId,
        name: PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME,
        content: text,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
    }
  }, []);

  const scheduleSave = useCallback(
    (targetProjectId: string, text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persist(targetProjectId, text);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  useEffect(() => {
    const pid = projectId;
    return () => {
      if (!pid) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persist(pid, draftRef.current);
    };
  }, [projectId, persist]);

  useEffect(() => {
    if (!projectId) {
      setDraft("");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const items = await db.site_items.where("projectId").equals(projectId).toArray();
      const row = items.find(
        (i) => i.name === PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME && !i.siteId,
      );
      if (!cancelled) {
        setDraft(row?.content ?? "");
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const setDraftAndPersist = useCallback(
    (next: string) => {
      setDraft(next);
      if (!projectId) return;
      scheduleSave(projectId, next);
    },
    [scheduleSave, projectId],
  );

  return {
    draft,
    setDraftAndPersist,
    isLoading,
  };
}
