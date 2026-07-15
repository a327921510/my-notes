/**
 * 用户页：导出 + 选择备份文件后跳转导入确认页。
 */
import { App } from "antd";
import { useCallback, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  buildFsExportPayload,
  classifyFsImport,
  downloadFsBackup,
  parseFsBackupPayload,
  setImportSession,
} from "@/services/fsBackup";

export function useFsBackup() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement>(null);

  const exportBackup = useCallback(async () => {
    try {
      const payload = await buildFsExportPayload();
      downloadFsBackup(payload);
      message.success("已导出文件管理数据为 JSON");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "导出失败");
    }
  }, [message]);

  const openImportPicker = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const payload = parseFsBackupPayload(text);
        const plan = await classifyFsImport(payload);
        const localOnlyActions: Record<string, "keep" | "delete"> = {};
        for (const item of plan.localOnly) {
          localOnlyActions[item.path] = "keep";
        }
        setImportSession({
          payload,
          plan,
          conflictResolutions: {},
          localOnlyActions,
          sourceFileName: file.name,
        });
        if (
          plan.conflicts.length === 0 &&
          plan.toCreate.length === 0 &&
          plan.localOnly.length === 0
        ) {
          message.info(`无变更可导入（已有 ${plan.unchangedCount} 个文件相同）`);
        }
        navigate("/user/import-confirm");
      } catch (err) {
        message.error(err instanceof Error ? err.message : "导入解析失败");
      }
    },
    [message, navigate],
  );

  return {
    exportBackup,
    openImportPicker,
    importInputProps: {
      ref: importInputRef,
      type: "file" as const,
      accept: "application/json,.json",
      className: "hidden",
      "aria-hidden": true,
      onChange: handleImportFileChange,
    },
  };
}
