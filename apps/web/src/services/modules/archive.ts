import type { ImportPreflightResult, ImportResult, OnConflictStrategy } from "@my-notes/shared";

import { request } from "../request";

export type ExportParams = {
  /** 传 ids 导出所选条目本身；只传 folderId 导出该目录的子树 */
  ids?: string[];
  folderId?: string | null;
};

export type ImportParams = {
  archive: File;
  targetParentId: string;
  onConflict?: OnConflictStrategy;
};

function mapImportParamsToForm({ archive, targetParentId, onConflict }: ImportParams): FormData {
  const form = new FormData();
  form.set("targetParentId", targetParentId);
  if (onConflict) form.set("onConflict", onConflict);
  form.set("archive", archive, archive.name);
  return form;
}

/** 从 Content-Disposition 取服务端给的文件名。例：`attachment; filename="a.zip"` → `a.zip` */
function parseAttachmentName(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = header.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : fallback;
}

export const archiveApi = {
  async exportArchive(params: ExportParams): Promise<{ blob: Blob; filename: string }> {
    const response = await request.post<Blob>("/drive/export", params, { responseType: "blob" });
    return {
      blob: response.data,
      filename: parseAttachmentName(response.headers["content-disposition"] as string, "export.zip"),
    };
  },

  async preflight(params: ImportParams): Promise<ImportPreflightResult> {
    const response = await request.post<ImportPreflightResult>(
      "/drive/import/preflight",
      mapImportParamsToForm(params),
    );
    return response.data;
  },

  async importArchive(params: ImportParams): Promise<ImportResult> {
    const response = await request.post<ImportResult>("/drive/import", mapImportParamsToForm(params));
    return response.data;
  },
};
