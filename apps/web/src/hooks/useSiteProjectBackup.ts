import { App } from "antd";
import { useCallback, useRef, type ChangeEvent } from "react";

import {
  applySiteProjectImport,
  buildSiteProjectExportPayload,
  downloadSiteProjectBackup,
  parseSiteProjectPayload,
} from "@/services/siteProjectBackup";
import type { SiteProjectImportStats } from "@/services/siteProjectBackup";

function formatImportMessage(s: SiteProjectImportStats): string {
  return [
    `新增项目 ${s.projectsCreated}、站点 ${s.sitesCreated}`,
    `项目条目 +${s.projectItemsAdded}、站点条目 +${s.siteItemsAdded}`,
    `跳过重复：项目条目 ${s.projectItemsSkipped}、站点条目 ${s.siteItemsSkipped}`,
  ].join("；");
}

export function useSiteProjectBackup() {
  const { message } = App.useApp();
  const importInputRef = useRef<HTMLInputElement>(null);

  const exportBackup = useCallback(async () => {
    try {
      const payload = await buildSiteProjectExportPayload();
      downloadSiteProjectBackup(payload);
      message.success("已导出站点与项目信息为 JSON 文件");
    } catch (e) {
      message.error((e as Error).message);
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
        const payload = parseSiteProjectPayload(text);
        const stats = await applySiteProjectImport(payload);
        message.success(formatImportMessage(stats));
      } catch (err) {
        message.error((err as Error).message);
      }
    },
    [message],
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
