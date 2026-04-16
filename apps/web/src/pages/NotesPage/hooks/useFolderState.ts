import { App } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useMemo } from "react";

import { db } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";

export function useFolderState() {
  const { message } = App.useApp();
  const folders = useLiveQuery(
    () => db.folders.filter((f) => !f.deletedAt).sortBy("name"),
    [],
  );

  const addFolder = useCallback(async () => {
    const name = window.prompt("文件夹名称");
    if (!name?.trim()) return;
    await db.folders.add({
      id: createId("fld"),
      name: name.trim(),
      parentId: null,
      updatedAt: Date.now(),
    });
    message.success("已创建文件夹");
  }, [message]);

  const renameFolder = useCallback(
    async (folderId: string) => {
      if (!folderId) {
        message.warning("请先选择文件夹");
        return;
      }
      const folder = await db.folders.get(folderId);
      if (!folder || folder.deletedAt) return;
      const nextName = window.prompt("重命名文件夹", folder.name);
      if (!nextName?.trim() || nextName.trim() === folder.name) return;
      await db.folders.update(folderId, { name: nextName.trim(), updatedAt: Date.now() });
      message.success("已重命名");
    },
    [message],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!folderId) {
        message.warning("请先选择文件夹");
        return;
      }
      const folder = await db.folders.get(folderId);
      if (!folder || folder.deletedAt) return;
      if (!window.confirm(`确定删除文件夹「${folder.name}」吗？`)) return;

      const hasChildren = (await db.notes.where("folderId").equals(folderId).count()) > 0;
      if (hasChildren) {
        message.warning("文件夹下有笔记，不能删除");
        return;
      }
      const now = Date.now();
      await db.folders.update(folderId, { deletedAt: now, updatedAt: now });
      message.success("文件夹已删除");
    },
    [message],
  );

  return useMemo(
    () => ({
      folders,
      addFolder,
      renameFolder,
      deleteFolder,
    }),
    [folders, addFolder, renameFolder, deleteFolder],
  );
}
