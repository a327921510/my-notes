import {
  ApiErrorCode,
  type DriveNode,
  type ImportPreflightResult,
  type ImportResult,
  type OnConflictStrategy,
  formatBytes,
} from "@my-notes/shared";
import { App } from "antd";
import { useCallback, useRef, useState } from "react";

import { saveBlob } from "@/lib/download";
import { archiveApi } from "@/services/modules/archive";
import { driveApi } from "@/services/modules/drive";
import { RequestError } from "@/services/request";
import { useUsageStore } from "@/stores/useUsageStore";

export type UploadTaskStatus = "pending" | "uploading" | "done" | "skipped" | "failed";

export type UploadTask = {
  id: string;
  name: string;
  sizeBytes: number;
  percent: number;
  status: UploadTaskStatus;
  error?: string;
};

export type ConflictChoice = {
  strategy: OnConflictStrategy | null;
  applyToAll: boolean;
};

export type ConflictRequest = {
  name: string;
  /** 剩余待处理数量，用于「对本批全部应用」的文案 */
  remaining: number;
  resolve: (choice: ConflictChoice) => void;
};

export type UploadSummary = {
  done: number;
  skipped: number;
  failed: number;
};

/** 上传、下载、导出、导入。同名冲突通过 conflict 状态回到页面层弹窗询问。 */
export function useDriveTransfer(onChanged: () => void | Promise<void>) {
  const { message } = App.useApp();
  const usage = useUsageStore((s) => s.usage);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [conflict, setConflict] = useState<ConflictRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const taskSeq = useRef(0);

  const askConflict = useCallback(
    (name: string, remaining: number) =>
      new Promise<ConflictChoice>((resolve) => {
        setConflict({
          name,
          remaining,
          resolve: (choice) => {
            setConflict(null);
            resolve(choice);
          },
        });
      }),
    [],
  );

  const updateTask = useCallback((id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }, []);

  const clearTasks = useCallback(() => setTasks([]), []);

  const uploadFiles = useCallback(
    async (files: File[], parentId: string): Promise<UploadSummary | null> => {
      if (files.length === 0) return null;

      // validateFiles：单文件上限与剩余配额都在上传前拦截
      const maxFileSize = usage?.maxFileSizeBytes ?? Number.POSITIVE_INFINITY;
      const oversized = files.filter((file) => file.size > maxFileSize);
      if (oversized.length > 0) {
        message.error(`${oversized[0].name} 等 ${oversized.length} 个文件超过单文件上限 ${formatBytes(maxFileSize)}`);
        return null;
      }
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      if (usage && usage.usedBytes + totalBytes > usage.quotaBytes) {
        message.error("存储空间不足，请先清理后再上传");
        return null;
      }

      const queued: UploadTask[] = files.map((file) => {
        taskSeq.current += 1;
        return {
          id: `upload-${taskSeq.current}`,
          name: file.name,
          sizeBytes: file.size,
          percent: 0,
          status: "pending",
        };
      });
      setTasks(queued);
      setBusy(true);

      const summary: UploadSummary = { done: 0, skipped: 0, failed: 0 };
      let batchStrategy: OnConflictStrategy | null = null;
      let cancelled = false;

      for (const [index, file] of files.entries()) {
        const task = queued[index];
        if (cancelled) {
          updateTask(task.id, { status: "skipped" });
          summary.skipped += 1;
          continue;
        }

        updateTask(task.id, { status: "uploading" });
        const attempt = async (onConflict?: OnConflictStrategy) =>
          driveApi.uploadFile({
            parentId,
            file,
            onConflict,
            onProgress: (percent) => updateTask(task.id, { percent }),
          });

        try {
          const result = await attempt(batchStrategy ?? undefined);
          if (result.skipped) {
            updateTask(task.id, { status: "skipped", percent: 100 });
            summary.skipped += 1;
          } else {
            updateTask(task.id, { status: "done", percent: 100 });
            summary.done += 1;
          }
        } catch (error) {
          if (error instanceof RequestError && error.code === ApiErrorCode.NODE_NAME_CONFLICT) {
            const choice = await askConflict(file.name, files.length - index);
            if (!choice.strategy) {
              cancelled = true;
              updateTask(task.id, { status: "skipped" });
              summary.skipped += 1;
              continue;
            }
            if (choice.applyToAll) batchStrategy = choice.strategy;
            try {
              const retried = await attempt(choice.strategy);
              if (retried.skipped) {
                updateTask(task.id, { status: "skipped", percent: 100 });
                summary.skipped += 1;
              } else {
                updateTask(task.id, { status: "done", percent: 100 });
                summary.done += 1;
              }
            } catch (retryError) {
              updateTask(task.id, { status: "failed", error: (retryError as Error).message });
              summary.failed += 1;
            }
            continue;
          }
          updateTask(task.id, { status: "failed", error: (error as Error).message });
          summary.failed += 1;
        }
      }

      setBusy(false);
      await onChanged();
      return summary;
    },
    [askConflict, message, onChanged, updateTask, usage],
  );

  const downloadNode = useCallback(
    async (node: DriveNode) => {
      try {
        saveBlob(await driveApi.downloadBlob(node.id), node.name);
      } catch (error) {
        message.error((error as Error).message);
      }
    },
    [message],
  );

  const exportNodes = useCallback(
    async (params: { ids?: string[]; folderId?: string | null }) => {
      setBusy(true);
      try {
        const { blob, filename } = await archiveApi.exportArchive(params);
        saveBlob(blob, filename);
        message.success("导出完成");
      } catch (error) {
        message.error((error as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [message],
  );

  const preflightImport = useCallback(
    async (archive: File, targetParentId: string): Promise<ImportPreflightResult | null> => {
      setBusy(true);
      try {
        return await archiveApi.preflight({ archive, targetParentId });
      } catch (error) {
        message.error((error as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [message],
  );

  const runImport = useCallback(
    async (
      archive: File,
      targetParentId: string,
      onConflict: OnConflictStrategy,
    ): Promise<ImportResult | null> => {
      setBusy(true);
      try {
        const result = await archiveApi.importArchive({ archive, targetParentId, onConflict });
        await onChanged();
        return result;
      } catch (error) {
        message.error((error as Error).message);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [message, onChanged],
  );

  return {
    tasks,
    conflict,
    busy,
    clearTasks,
    uploadFiles,
    downloadNode,
    exportNodes,
    preflightImport,
    runImport,
  };
}
