/** 前后端共用的接口契约：错误码与请求 / 响应体形状。 */

import type { DriveNode, DriveUsage, NodeBrief, OnConflictStrategy } from "./drive.js";

export const ApiErrorCode = {
  AUTH_EMAIL_TAKEN: "AUTH_EMAIL_TAKEN",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_PASSWORD_TOO_SHORT: "AUTH_PASSWORD_TOO_SHORT",
  NODE_NOT_FOUND: "NODE_NOT_FOUND",
  NODE_NAME_INVALID: "NODE_NAME_INVALID",
  NODE_NAME_CONFLICT: "NODE_NAME_CONFLICT",
  NODE_MOVE_INTO_SELF: "NODE_MOVE_INTO_SELF",
  NODE_ROOT_IMMUTABLE: "NODE_ROOT_IMMUTABLE",
  NODE_NOT_FOLDER: "NODE_NOT_FOLDER",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  DOC_NOT_MMD: "DOC_NOT_MMD",
  DOC_STALE: "DOC_STALE",
  ARCHIVE_INVALID: "ARCHIVE_INVALID",
  BAD_REQUEST: "BAD_REQUEST",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  [ApiErrorCode.AUTH_EMAIL_TAKEN]: "该邮箱已注册",
  [ApiErrorCode.AUTH_INVALID_CREDENTIALS]: "邮箱或密码不正确",
  [ApiErrorCode.AUTH_TOKEN_EXPIRED]: "登录已过期，请重新登录",
  [ApiErrorCode.AUTH_PASSWORD_TOO_SHORT]: "密码至少 8 位",
  [ApiErrorCode.NODE_NOT_FOUND]: "内容不存在或已被删除",
  [ApiErrorCode.NODE_NAME_INVALID]: "名称不合法",
  [ApiErrorCode.NODE_NAME_CONFLICT]: "该名称已存在",
  [ApiErrorCode.NODE_MOVE_INTO_SELF]: "不能把文件夹移动到它自己或它的子目录",
  [ApiErrorCode.NODE_ROOT_IMMUTABLE]: "根目录不能重命名、移动或删除",
  [ApiErrorCode.NODE_NOT_FOLDER]: "目标不是文件夹",
  [ApiErrorCode.FILE_TOO_LARGE]: "文件超过单文件大小上限",
  [ApiErrorCode.QUOTA_EXCEEDED]: "存储空间不足",
  [ApiErrorCode.DOC_NOT_MMD]: "该文件不是 .mmd 文档",
  [ApiErrorCode.DOC_STALE]: "该文档已在别处被修改",
  [ApiErrorCode.ARCHIVE_INVALID]: "导入包无法解析",
  [ApiErrorCode.BAD_REQUEST]: "请求参数有误",
};

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type NameConflictDetails = {
  name: string;
};

export type DocStaleDetails = {
  serverUpdatedAt: number;
};

export type AuthUser = {
  id: string;
  email: string;
  createdAt: number;
};

export type AuthResult = {
  token: string;
  user: AuthUser;
};

export const NodeSortField = {
  NAME: "name",
  SIZE: "size",
  UPDATED_AT: "updatedAt",
} as const;
export type NodeSortField = (typeof NodeSortField)[keyof typeof NodeSortField];

export const SortOrder = {
  ASC: "asc",
  DESC: "desc",
} as const;
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];

export type ListNodesResult = {
  parent: DriveNode;
  path: NodeBrief[];
  nodes: DriveNode[];
};

export type SearchNodesResult = {
  items: Array<DriveNode & { path: NodeBrief[] }>;
  total: number;
};

export type BatchOutcome = {
  done: string[];
  skipped: string[];
  failed: Array<{ id: string; code: ApiErrorCode; message: string }>;
};

export type MoveNodesBody = {
  ids: string[];
  targetParentId: string | null;
  onConflict?: OnConflictStrategy;
};

export type DeleteNodesBody = {
  ids: string[];
};

export type DocContent = {
  node: DriveNode;
  content: string;
};

export type ImportPreflightResult = {
  folderCount: number;
  fileCount: number;
  totalBytes: number;
  /** 与目标目录冲突的顶层条目名 */
  conflicts: string[];
  quotaOk: boolean;
};

export type ImportResult = {
  createdFolders: number;
  createdFiles: number;
  overwrittenFiles: number;
  skipped: string[];
  failed: Array<{ path: string; message: string }>;
};

export type { DriveNode, DriveUsage, NodeBrief, OnConflictStrategy };

export const EXPORT_MANIFEST_NAME = ".mydrive-manifest.json";
export const EXPORT_MANIFEST_VERSION = 1;

export type ExportManifestEntry = {
  path: string;
  kind: "folder" | "file";
  sizeBytes: number;
  mimeType: string | null;
  docKind: "mmd" | null;
  checksum: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ExportManifest = {
  manifestVersion: number;
  exportedAt: number;
  account: string;
  entries: ExportManifestEntry[];
};
