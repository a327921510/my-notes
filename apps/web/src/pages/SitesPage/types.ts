import type { SyncStatus } from "@my-notes/shared";

export type SiteItem = {
  id: string;
  name: string;
  content: string;
  syncStatus: SyncStatus;
  cloudId?: string;
  /** 来自项目文档表格同步，站点页仅可复制 */
  readOnly?: boolean;
};

export type Site = {
  id: string;
  name: string;
  address: string;
  projectId?: string | null;
  version: number;
  syncStatus: SyncStatus;
  cloudId?: string;
  items: SiteItem[];
};
