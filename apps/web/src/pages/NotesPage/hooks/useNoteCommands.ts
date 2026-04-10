import { App } from "antd";
import { useCallback, useMemo } from "react";
import type { NoteRecord } from "@my-notes/shared";
import { db } from "@/db/database";
import { ensureDefaultFolder, nextSyncAfterEdit } from "@/db/seed";
import { stripHtml } from "@/lib/html";
import { createId } from "@/lib/id";

function titleFromContent(html: string): string {
  const text = stripHtml(html);
  const line = text.split("\n").find((l) => l.trim().length > 0);
  if (!line) return "无标题笔记";
  const t = line.trim().slice(0, 48);
  return t.length < line.trim().length ? `${t}…` : t;
}

/** 不订阅 notes 列表，避免与树侧 `useNotesList` 重复 Dexie 订阅。 */
export function useNoteCommands() {
  const { message } = App.useApp();

  const createNote = useCallback(async (folderId: string | null): Promise<string> => {
    const fid = folderId ?? (await ensureDefaultFolder());
    const now = Date.now();
    const id = createId("note");
    await db.notes.add({
      id,
      folderId: fid,
      title: "新笔记",
      contentText: "",
      updatedAt: now,
      syncStatus: "local_only",
    });
    return id;
  }, []);

  const saveNote = useCallback(
    async (
      selectedId: string | null,
      folderId: string | null,
      patch: Partial<Pick<NoteRecord, "title" | "contentText" | "folderId">>,
    ) => {
      if (!selectedId) return;
      const selected = await db.notes.get(selectedId);
      if (!selected || selected.deletedAt) return;
      if (folderId && selected.folderId !== folderId) return;
      const now = Date.now();
      const nextTitle =
        patch.title !== undefined
          ? patch.title
          : selected.title || titleFromContent(patch.contentText ?? selected.contentText);
      await db.notes.update(selected.id, {
        ...patch,
        title: nextTitle,
        updatedAt: now,
        syncStatus: nextSyncAfterEdit(selected.syncStatus),
      });
    },
    [],
  );

  const deleteNote = useCallback(
    async (selectedId: string | null, folderId: string | null) => {
      if (!selectedId) return;
      const selected = await db.notes.get(selectedId);
      if (!selected || selected.deletedAt) return;
      if (folderId && selected.folderId !== folderId) return;
      await db.notes.update(selected.id, { deletedAt: Date.now() });
      message.success("已移入本地删除");
    },
    [message],
  );

  return useMemo(
    () => ({
      createNote,
      saveNote,
      deleteNote,
    }),
    [createNote, saveNote, deleteNote],
  );
}
