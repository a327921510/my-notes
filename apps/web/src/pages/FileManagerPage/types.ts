import type { FsFileKind, FsFileRow, FsFolderRow } from "@my-notes/local-db";

export type { FsFileKind, FsFileRow, FsFolderRow };

/** 树选中态：文件夹（含根 null）或文件 */
export type FsTreeSelection = {
  folderId: string | null;
  selectedFileId: string | null;
  selectedFile: FsFileRow | null;
};

export type DocViewMode = "read" | "edit";

const ILLEGAL_FILE_NAME_CHARS = /[\\/:*?"<>|]/;

export function normalizeName(input: string): string {
  return input.trim().toLowerCase();
}

export function assertValidNodeName(name: string, label: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error(`${label}不能为空`);
  if (ILLEGAL_FILE_NAME_CHARS.test(trimmed)) {
    throw new Error(`${label}包含非法字符`);
  }
  return trimmed;
}

/** 由文件名后缀推导 kind；无法识别时返回 null */
export function kindFromFileName(name: string): FsFileKind | null {
  const lower = name.trim().toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".rm")) return "rm";
  return null;
}

/** 创建时强制补齐 .md / .rm 后缀 */
export function ensureFileExtension(name: string, kind: FsFileKind): string {
  const trimmed = name.trim();
  const ext = kind === "md" ? ".md" : ".rm";
  if (trimmed.toLowerCase().endsWith(ext)) return trimmed;
  return `${trimmed}${ext}`;
}

export function parseTreeKey(
  key: string,
): { type: "folder"; id: string } | { type: "file"; id: string } | null {
  if (key.startsWith("folder:")) return { type: "folder", id: key.slice("folder:".length) };
  if (key.startsWith("file:")) return { type: "file", id: key.slice("file:".length) };
  return null;
}

export function folderTreeKey(id: string): string {
  return `folder:${id}`;
}

export function fileTreeKey(id: string): string {
  return `file:${id}`;
}
