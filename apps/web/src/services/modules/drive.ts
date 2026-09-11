import type {
  BatchOutcome,
  DriveNode,
  DriveUsage,
  ListNodesResult,
  NodeBrief,
  NodeSortField,
  OnConflictStrategy,
  SearchNodesResult,
  SortOrder,
} from "@my-notes/shared";

import { get, patch, post, request } from "../request";

export type ListNodesParams = {
  parentId?: string | null;
  sort?: NodeSortField;
  order?: SortOrder;
};

export type UploadFileParams = {
  parentId: string;
  file: File;
  name?: string;
  onConflict?: OnConflictStrategy;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
};

export type UploadFileResult = {
  node: DriveNode | null;
  skipped: boolean;
};

export const driveApi = {
  listNodes: (params: ListNodesParams = {}) =>
    get<ListNodesResult>("/drive/nodes", {
      params: { parentId: params.parentId ?? "", sort: params.sort, order: params.order },
    }),

  getNode: (id: string) => get<{ node: DriveNode }>(`/drive/nodes/${id}`),

  getPath: (id: string) => get<{ path: NodeBrief[] }>(`/drive/nodes/${id}/path`),

  search: (keyword: string, limit = 50, offset = 0) =>
    get<SearchNodesResult>("/drive/search", { params: { keyword, limit, offset } }),

  usage: () => get<DriveUsage>("/drive/usage"),

  createFolder: (parentId: string, name: string) =>
    post<{ node: DriveNode }>("/drive/folders", { parentId, name }),

  rename: (id: string, name: string) => patch<{ node: DriveNode }>(`/drive/nodes/${id}`, { name }),

  move: (ids: string[], targetParentId: string, onConflict?: OnConflictStrategy) =>
    post<BatchOutcome>("/drive/nodes/move", { ids, targetParentId, onConflict }),

  remove: (ids: string[]) => post<BatchOutcome>("/drive/nodes/delete", { ids }),

  async uploadFile({
    parentId,
    file,
    name,
    onConflict,
    onProgress,
    signal,
  }: UploadFileParams): Promise<UploadFileResult> {
    const form = new FormData();
    form.set("parentId", parentId);
    if (name) form.set("name", name);
    if (onConflict) form.set("onConflict", onConflict);
    form.set("file", file, name ?? file.name);

    const response = await request.post<UploadFileResult>("/drive/files", form, {
      signal,
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });
    return response.data;
  },

  async downloadBlob(id: string): Promise<Blob> {
    const response = await request.get<Blob>(`/drive/nodes/${id}/download`, { responseType: "blob" });
    return response.data;
  },
};
