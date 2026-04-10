import type { SyncStatus } from "@my-notes/shared";

export type SiteItem = {
  id: string;
  name: string;
  content: string;
  syncStatus: SyncStatus;
  cloudId?: string;
};

export type Site = {
  id: string;
  name: string;
  address: string;
  version: number;
  syncStatus: SyncStatus;
  cloudId?: string;
  items: SiteItem[];
};
