/**
 * 站点「整页 Markdown 文档」在 `site_items.name` 上的保留值（历史数据可能仍存在）。
 * 其它 UI 应过滤，避免与逐条录入混淆。
 */
export const SITE_MARKDOWN_DOCUMENT_ITEM_NAME = "__site_markdown_document__" as const;

/**
 * 项目「整页 Markdown 文档」（仅 `projectId`、无 `siteId` 的 `site_items` 行）的保留 `name`。
 * Web「项目文档」页读写；项目信息区列表等应过滤。
 */
export const PROJECT_MARKDOWN_DOCUMENT_ITEM_NAME = "__project_markdown_document__" as const;

/** 项目文档「地址/账号/密码/备注」表同步到站点条目时的保留 `name` 前缀。 */
export const PROJECT_CREDENTIAL_MIRROR_ITEM_PREFIX = "__pm_cred_mirror__" as const;

export type ProjectCredentialMirrorKind = "acc" | "pwd";

/**
 * `__pm_cred_mirror__|<projectId>|<credentialTableIndex>|<rowIndex>|<acc|pwd>`
 * `credentialTableIndex` 为文档中凭证表出现次序（从 0 计），与其它 Markdown 段无关。
 */
export function buildProjectCredentialMirrorItemName(
  projectId: string,
  credentialTableIndex: number,
  rowIndex: number,
  kind: ProjectCredentialMirrorKind,
): string {
  return `${PROJECT_CREDENTIAL_MIRROR_ITEM_PREFIX}|${projectId}|${credentialTableIndex}|${rowIndex}|${kind}`;
}

export function projectCredentialMirrorNamesPrefix(projectId: string): string {
  return `${PROJECT_CREDENTIAL_MIRROR_ITEM_PREFIX}|${projectId}|`;
}

export function parseProjectCredentialMirrorItemName(name: string): {
  projectId: string;
  credentialTableIndex: number;
  rowIndex: number;
  kind: ProjectCredentialMirrorKind;
} | null {
  const head = `${PROJECT_CREDENTIAL_MIRROR_ITEM_PREFIX}|`;
  if (!name.startsWith(head)) return null;
  const rest = name.slice(head.length);
  const parts = rest.split("|");
  if (parts.length !== 4) return null;
  const [projectId, ctStr, rowStr, kindRaw] = parts;
  const credentialTableIndex = Number(ctStr);
  const rowIndex = Number(rowStr);
  if (!Number.isFinite(credentialTableIndex) || !Number.isFinite(rowIndex)) return null;
  if (kindRaw !== "acc" && kindRaw !== "pwd") return null;
  if (!projectId) return null;
  return { projectId, credentialTableIndex, rowIndex, kind: kindRaw };
}

export function isProjectCredentialMirrorItemName(name: string): boolean {
  return parseProjectCredentialMirrorItemName(name) !== null;
}

/** 站点条目列表、复制文案等展示的友好名称 */
export function formatSiteItemDisplayName(rawName: string): string {
  const parsed = parseProjectCredentialMirrorItemName(rawName);
  if (parsed) {
    const kindLabel = parsed.kind === "acc" ? "账号" : "密码";
    return `${kindLabel}（项目文档·第 ${parsed.rowIndex + 1} 条）`;
  }
  return rawName.trim() ? rawName : "（未命名）";
}
