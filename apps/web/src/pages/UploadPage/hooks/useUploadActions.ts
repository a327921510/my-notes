import { useCallback, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";
import { authApi } from "@/services/modules/auth";
import { buildExportPayload, downloadExportJson, importArchiveMerge } from "@/lib/export-archive";
import { db } from "@my-notes/local-db";
import { needsUpload } from "@my-notes/shared";
import { pullFromCloud, uploadNote, uploadSnippet } from "@my-notes/sync-client";

export function useUploadActions() {
  const token = useAuthStore((s) => s.token);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  }, []);

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const { data } = await authApi.login({ email, password });
      setAuth(data.token, data.user);
      pushLog("登录成功，开始自动同步云端数据");
      const { notesApplied, snippetsApplied } = await pullFromCloud(db, data.token);
      pushLog(`自动同步完成：笔记 ${notesApplied} 条，短文本 ${snippetsApplied} 条`);
      return { notesApplied, snippetsApplied };
    },
    [pushLog, setAuth],
  );

  const uploadAllPending = useCallback(
    async (notes: { id: string; title: string; syncStatus: string; cloudId?: string }[], snippets: { id: string; sourceDomain: string; syncStatus: string; cloudId?: string }[]) => {
      if (!token) throw new Error("请先登录");
      setBusy(true);
      try {
        const noteList = notes.filter((n) => needsUpload(n.syncStatus));
        for (const n of noteList) {
          try {
            const imgs = await db.images.where("noteId").equals(n.id).toArray();
            const { cloudId } = await uploadNote(db, token, n, imgs);
            await db.notes.update(n.id, { syncStatus: "synced", cloudId });
            pushLog(`笔记已上传: ${n.title || n.id} -> ${cloudId}`);
          } catch (e) {
            await db.notes.update(n.id, { syncStatus: "failed" });
            pushLog(`笔记失败: ${n.title || n.id} — ${(e as Error).message}`);
          }
        }

        const snipList = snippets.filter((s) => needsUpload(s.syncStatus));
        for (const s of snipList) {
          try {
            const { cloudId } = await uploadSnippet(db, token, s);
            await db.snippets.update(s.id, { syncStatus: "synced", cloudId });
            pushLog(`短文本已上传: ${s.sourceDomain} / ${s.id} -> ${cloudId}`);
          } catch (e) {
            await db.snippets.update(s.id, { syncStatus: "failed" });
            pushLog(`短文本失败: ${s.id} — ${(e as Error).message}`);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [token, pushLog],
  );

  const handlePull = useCallback(async () => {
    if (!token) throw new Error("请先登录");
    setBusy(true);
    try {
      const { notesApplied, snippetsApplied } = await pullFromCloud(db, token);
      pushLog(`拉取完成：合并笔记 ${notesApplied} 条，短文本 ${snippetsApplied} 条`);
      return { notesApplied, snippetsApplied };
    } finally {
      setBusy(false);
    }
  }, [token, pushLog]);

  const handleExport = useCallback(async () => {
    setBusy(true);
    try {
      const payload = await buildExportPayload();
      downloadExportJson(payload);
      pushLog(`已导出 ${payload.notes.length} 条笔记、${payload.blobs.length} 个 blob`);
    } finally {
      setBusy(false);
    }
  }, [pushLog]);

  const handleImport = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        await importArchiveMerge(file);
        pushLog(`已导入: ${file.name}`);
      } finally {
        setBusy(false);
      }
    },
    [pushLog],
  );

  return {
    token,
    busy,
    log,
    handleLogin,
    uploadAllPending,
    handlePull,
    handleExport,
    handleImport,
  };
}
