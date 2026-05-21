export type SnippetType = "account" | "password" | "id" | "todo" | "custom";

export type FolderRecord = {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: number;
  deletedAt?: number;
};

export type NoteRecord = {
  id: string;
  folderId: string | null;
  title: string;
  contentText: string;
  updatedAt: number;
  deletedAt?: number;
};

export type ImageRecord = {
  id: string;
  noteId: string;
  /** IndexedDB key or inline reference for local blob */
  localBlobRef: string;
  checksum?: string;
  sortOrder: number;
};

export type SnippetRecord = {
  id: string;
  type: SnippetType;
  content: string;
  sourceDomain: string;
  sourceUrl?: string;
  sourceTitle?: string;
  createdAt: number;
  updatedAt: number;
};

export type SiteSpaceRecord = {
  id: string;
  sourceDomain: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
};

export type ClipRecord = {
  id: string;
  content: string;
  sourceUrl?: string;
  sourceDomain?: string;
  sourceTitle?: string;
  createdAt: number;
  status: string;
};

export type ProjectRecord = {
  id: string;
  name: string;
  updatedAt: number;
};

export const SNIPPET_TYPE_LABELS: Record<SnippetType, string> = {
  account: "账号",
  password: "密码",
  id: "ID",
  todo: "待办",
  custom: "自定义",
};
