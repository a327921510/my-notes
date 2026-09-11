import type { DocContent, DriveNode } from "@my-notes/shared";

import { get, post, put } from "../request";

export type CreateDocPayload = {
  parentId: string;
  name: string;
  content?: string;
};

export type SaveDocPayload = {
  content: string;
  /** 打开文档时记下的服务端 updatedAt；不一致时后端返回 DOC_STALE */
  baseUpdatedAt?: number;
};

export const docApi = {
  create: (data: CreateDocPayload) => post<{ node: DriveNode }>("/docs", data),
  read: (id: string) => get<DocContent>(`/docs/${id}`),
  save: (id: string, data: SaveDocPayload) => put<{ node: DriveNode }>(`/docs/${id}`, data),
};
