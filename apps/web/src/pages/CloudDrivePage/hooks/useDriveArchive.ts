import { App } from "antd";
import { type ChangeEvent, useCallback, useRef } from "react";

import { downloadBlob, exportDriveArchive, importDriveArchive } from "@/lib/drive-archive";

/**
 * Business hook for the CloudDrive directory-nested archive (ZIP) flows:
 * - export the whole drive as a real nested directory tree
 * - import such a ZIP back into the local drive (文件导入 → 本地)
 */
export function useDriveArchive() {
  const { message } = App.useApp();
  const importInputRef = useRef<HTMLInputElement>(null);

  const exportArchive = useCallback(async () => {
    try {
      const result = await exportDriveArchive();
      if (result.fileCount === 0 && result.folderCount === 0) {
        message.warning("云盘为空，无可导出的目录或文件");
        return;
      }
      downloadBlob(result.blob, result.filename);
      message.success(`已导出 ${result.folderCount} 个目录、${result.fileCount} 个文件为目录压缩包`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message]);

  const openImportPicker = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const result = await importDriveArchive(file);
        message.success(
          `导入完成：新增目录 ${result.createdFolders}，新增文件 ${result.createdFiles}，更新文件 ${result.updatedFiles}`,
        );
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message],
  );

  return {
    exportArchive,
    openImportPicker,
    importInputProps: {
      ref: importInputRef,
      type: "file" as const,
      accept: ".zip,application/zip",
      className: "hidden",
      "aria-hidden": true,
      onChange: handleImportChange,
    },
  };
}
