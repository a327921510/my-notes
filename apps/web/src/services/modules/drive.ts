import { request } from "../request";

type CloudFolderPayload = {
  cloudId: string;
  clientFolderId: string;
  name: string;
  parentId: string | null;
  path?: string;
  updatedAt: number;
};

type CloudFilePayload = {
  cloudId: string;
  clientFileId: string;
  clientFolderId: string;
  name: string;
  mimeType?: string;
  sizeBytes: number;
  checksum?: string;
  storageId: string;
  updatedAt: number;
};

export type { CloudFolderPayload, CloudFilePayload };

export const driveApi = {
  getFolders: () =>
    request.get<{ items: CloudFolderPayload[] }>("/drive/folders"),

  getFiles: () =>
    request.get<{ items: CloudFilePayload[] }>("/drive/files"),

  upsertFolder: (data: {
    clientFolderId: string;
    name: string;
    parentId: string | null;
    path?: string;
    updatedAt: number;
  }) => request.post<{ cloudId: string }>("/drive/folders/upsert", data),

  pushFile: (formData: FormData) =>
    request.post<{ cloudId: string; storageId: string }>(
      "/drive/files/push",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    ),

  deleteFile: (clientFileId: string) =>
    request.delete(`/drive/files/${encodeURIComponent(clientFileId)}`),

  downloadFile: (cloudFileId: string) =>
    request.get<Blob>(
      `/drive/files/${encodeURIComponent(cloudFileId)}/download`,
      { responseType: "blob" },
    ),
};
