/**
 * 当前选中文件的草稿加载与防抖落库（仅写 contentText，无站点镜像）。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { db } from "@my-notes/local-db";

const SAVE_DEBOUNCE_MS = 500;

export function useFsDocument(fileId: string | null) {
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  const persist = useCallback(async (targetFileId: string, text: string) => {
    const row = await db.fs_files.get(targetFileId);
    if (!row) return;
    await db.fs_files.update(targetFileId, {
      contentText: text,
      updatedAt: Date.now(),
    });
  }, []);

  const scheduleSave = useCallback(
    (targetFileId: string, text: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persist(targetFileId, text);
      }, SAVE_DEBOUNCE_MS);
    },
    [persist],
  );

  // 切换文件前 flush，避免丢未落库草稿
  useEffect(() => {
    const id = fileId;
    return () => {
      if (!id) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persist(id, draftRef.current);
    };
  }, [fileId, persist]);

  useEffect(() => {
    if (!fileId) {
      setDraft("");
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    void (async () => {
      const row = await db.fs_files.get(fileId);
      if (!cancelled) {
        setDraft(row?.contentText ?? "");
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const setDraftAndPersist = useCallback(
    (next: string) => {
      setDraft(next);
      if (!fileId) return;
      scheduleSave(fileId, next);
    },
    [fileId, scheduleSave],
  );

  return {
    draft,
    setDraftAndPersist,
    isLoading,
  };
}
