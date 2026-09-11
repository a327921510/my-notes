/** 云盘节点模型与命名规则。目录与文件统一为节点，以 `kind` 区分。 */

export const NodeKind = {
  FOLDER: "folder",
  FILE: "file",
} as const;
export type NodeKind = (typeof NodeKind)[keyof typeof NodeKind];

export const OnConflictStrategy = {
  /** 追加序号保留副本 */
  RENAME: "rename",
  OVERWRITE: "overwrite",
  SKIP: "skip",
} as const;
export type OnConflictStrategy = (typeof OnConflictStrategy)[keyof typeof OnConflictStrategy];

export type DriveNode = {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  checksum: string | null;
  /** `mmd` 表示系统专属文档，可在系统内打开；其余文件为 null。 */
  docKind: "mmd" | null;
  createdAt: number;
  updatedAt: number;
};

export type NodeBrief = Pick<DriveNode, "id" | "name" | "kind">;

export type DriveUsage = {
  usedBytes: number;
  quotaBytes: number;
  fileCount: number;
  folderCount: number;
  maxFileSizeBytes: number;
};

export const NODE_NAME_MAX_LENGTH = 255;

/** Windows/POSIX 两边都不安全的字符，外加控制字符。 */
const ILLEGAL_NAME_CHARS = /[/\\:*?"<>|\u0000-\u001f]/;

export const NodeNameError = {
  EMPTY: "empty",
  TOO_LONG: "tooLong",
  ILLEGAL_CHAR: "illegalChar",
  RESERVED: "reserved",
} as const;
export type NodeNameError = (typeof NodeNameError)[keyof typeof NodeNameError];

export const NODE_NAME_ERROR_MESSAGES: Record<NodeNameError, string> = {
  [NodeNameError.EMPTY]: "名称不能为空",
  [NodeNameError.TOO_LONG]: `名称不能超过 ${NODE_NAME_MAX_LENGTH} 个字符`,
  [NodeNameError.ILLEGAL_CHAR]: '名称不能包含 / \\ : * ? " < > | 等字符',
  [NodeNameError.RESERVED]: "名称不能为 . 或 ..",
};

/** 返回第一个违反的规则，全部通过时返回 null。 */
export function checkNodeName(name: string): NodeNameError | null {
  const trimmed = name.trim();
  if (trimmed === "") return NodeNameError.EMPTY;
  if (trimmed.length > NODE_NAME_MAX_LENGTH) return NodeNameError.TOO_LONG;
  if (ILLEGAL_NAME_CHARS.test(trimmed)) return NodeNameError.ILLEGAL_CHAR;
  if (trimmed === "." || trimmed === "..") return NodeNameError.RESERVED;
  return null;
}

export function isValidNodeName(name: string): boolean {
  return checkNodeName(name) === null;
}

/** 同级唯一性的比较键：去首尾空格 + 忽略大小写。例：` Report.TXT ` → `report.txt` */
export function mapNodeNameToKey(name: string): string {
  return name.trim().toLowerCase();
}

function splitExtension(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

/**
 * 同名保留副本时的序号追加。例：`报告.pdf` + 已占用 `报告.pdf` → `报告(1).pdf`
 * `taken` 传入同级已占用的比较键集合。
 */
export function mapNameToDedupedName(name: string, taken: ReadonlySet<string>): string {
  const trimmed = name.trim();
  if (!taken.has(mapNodeNameToKey(trimmed))) return trimmed;

  const { base, ext } = splitExtension(trimmed);
  for (let i = 1; ; i += 1) {
    const candidate = `${base}(${i})${ext}`;
    if (!taken.has(mapNodeNameToKey(candidate))) return candidate;
  }
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** 例：1536 → `1.5 KB` */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unitIndex]}`;
}
