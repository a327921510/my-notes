import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@my-notes/local-db";
import { createId, nextSyncAfterEdit, SITE_MARKDOWN_DOCUMENT_ITEM_NAME } from "@my-notes/shared";

const SAVE_DEBOUNCE_MS = 500;

export function useSiteMarkdownDocument(siteId: string | null) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  const persist = useCallback(async (targetSiteId: string, text: string) => {
    const site = await db.sites.get(targetSiteId);
    const items = await db.site_items.where("siteId").equals(targetSiteId).toArray();
    const existing = items.find((i) => i.name === SITE_MARKDOWN_DOCUMENT_ITEM_NAME);
    if (existing) {
      await db.site_items.update(existing.id, {
        content: text,
        updatedAt: Date.now(),
        syncStatus: nextSyncAfterEdit(existing.syncStatus),
      });
    } else {
      await db.site_items.add({
        id: createId("item"),
        siteId: targetSiteId,
        projectId: site?.projectId,
        name: SITE_MARKDOWN_DOCUMENT_ITEM_NAME,
        content: text,
        updatedAt: Date.now(),
        syncStatus: "local_only",
      });
    }
  }, []);

  const scheduleSave = useCallback(
    (targetSiteId: string, text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persist(targetSiteId, text);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  /** 离开站点或卸载前落库，避免防抖未触发导致丢失 */
  useEffect(() => {
    const sid = siteId;
    return () => {
      if (!sid) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persist(sid, draftRef.current);
    };
  }, [siteId, persist]);

  useEffect(() => {
    if (!siteId) {
      setDraft("");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const items = await db.site_items.where("siteId").equals(siteId).toArray();
      const row = items.find((i) => i.name === SITE_MARKDOWN_DOCUMENT_ITEM_NAME);
      if (!cancelled) {
        setDraft(row?.content ?? "");
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const setDraftAndPersist = useCallback(
    (next: string) => {
      setDraft(next);
      if (!siteId) return;
      scheduleSave(siteId, next);
    },
    [scheduleSave, siteId],
  );

  return {
    draft,
    setDraftAndPersist,
    isLoading,
  };
}
