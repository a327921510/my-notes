import { normalizeTableHeaderCell } from "./splitMarkdownTableRow";

/** 凭证表必需表头（顺序固定） */
export const CREDENTIAL_TABLE_HEADERS = ["地址", "账号", "密码", "备注"] as const;

/** 代码仓库表必需表头（列顺序可任意，但须全部出现） */
export const CODE_REPO_TABLE_HEADERS = ["域名", "代码仓库", "代码路径(本地)", "备注"] as const;

export function isCredentialTableHeader(cells: string[]): boolean {
  if (cells.length < CREDENTIAL_TABLE_HEADERS.length) return false;
  const normalized = cells.map(normalizeTableHeaderCell);
  return CREDENTIAL_TABLE_HEADERS.every((h, i) => normalized[i] === h);
}

export function isCodeRepoTableHeader(cells: string[]): boolean {
  if (cells.length < CODE_REPO_TABLE_HEADERS.length) return false;
  const normalized = cells.map(normalizeTableHeaderCell);
  return CODE_REPO_TABLE_HEADERS.every((h) => normalized.includes(h));
}

export function findTableColumnIndex(header: string[], headerName: string): number {
  const normalized = header.map(normalizeTableHeaderCell);
  return normalized.indexOf(headerName);
}
