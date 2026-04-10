/** Sync state for notes and snippets (PRD §5). */
export type SyncStatus = "local_only" | "synced" | "dirty" | "failed";

export type SnippetType = "account" | "password" | "id" | "todo" | "custom";

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: number;
  deletedAt?: number;
}

export interface NoteRecord {
  id: string;
  folderId: string | null;
  title: string;
  contentText: string;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
  deletedAt?: number;
}

export interface ImageRecord {
  id: string;
  noteId: string;
  /** IndexedDB key or inline reference for local blob */
  localBlobRef: string;
  checksum?: string;
  /** 云端存储 id（拉取/同步后由服务端返回，非公开 URL） */
  cloudStorageId?: string;
  sortOrder: number;
}

export interface SnippetRecord {
  id: string;
  type: SnippetType;
  content: string;
  sourceDomain: string;
  sourceUrl?: string;
  sourceTitle?: string;
  createdAt: number;
  updatedAt: number;
  syncStatus: SyncStatus;
  cloudId?: string;
}

export interface SiteSpaceRecord {
  id: string;
  sourceDomain: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClipRecord {
  id: string;
  content: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceTitle?: string;
  createdAt: number;
  status: string;
}

export const SNIPPET_TYPE_LABELS: Record<SnippetType, string> = {
  account: "账号",
  password: "密码",
  id: "ID",
  todo: "待办",
  custom: "自定义",
};

export const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  local_only: "仅本地",
  synced: "已同步",
  dirty: "待上传",
  failed: "上传失败",
};
