import type { SyncStatus } from "@my-notes/shared";

export type ProjectItem = {
  id: string;
  name: string;
  content: string;
  syncStatus: SyncStatus;
  cloudId?: string;
  /** 若有站点，则为挂在站点下的条目；纯项目条目为空 */
  siteId?: string | null;
  /** 站点条目展示用：来自 db.sites */
  siteAddress?: string;
  siteName?: string;
};

export type ProjectVM = {
  id: string;
  name: string;
  syncStatus: SyncStatus;
  cloudId?: string;
  items: ProjectItem[];
};
