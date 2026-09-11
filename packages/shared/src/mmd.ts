/**
 * `.mmd`（My Markdown Document）：Markdown 超集，纯文本存储。
 * 相对 CommonMark + GFM 的唯一增强是「凭据表」——表头依次为 地址 / 账号 / 密码 / 备注
 * 的管道表，在预览态渲染为可点击复制的增强表格。
 */

export const MMD_EXTENSION = ".mmd";

export const CREDENTIAL_TABLE_HEADER = ["地址", "账号", "密码", "备注"] as const;

export const CREDENTIAL_TABLE_TEMPLATE = [
  "| 地址 | 账号 | 密码 | 备注 |",
  "| --- | --- | --- | --- |",
  "|  |  |  |  |",
].join("\n");

export function isMmdName(name: string): boolean {
  return name.trim().toLowerCase().endsWith(MMD_EXTENSION);
}

/** 补齐 `.mmd` 后缀。例：`说明` → `说明.mmd`；`说明.mmd` 原样返回 */
export function mapNameToMmdName(name: string): string {
  const trimmed = name.trim();
  return isMmdName(trimmed) ? trimmed : `${trimmed}${MMD_EXTENSION}`;
}

export type MmdSegment =
  | { type: "markdown"; text: string }
  | { type: "credentialTable"; header: string[]; body: string[][] };

/** 解析 GFM 管道表的一行，得到各单元格原始文本（无外侧 `|`）。 */
export function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return [];
  const cells = trimmed.split("|").map((cell) => cell.trim());
  if (cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

export function isTableDelimiterRow(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function normalizeHeaderCell(cell: string): string {
  return cell.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

export function isCredentialTableHeader(cells: string[]): boolean {
  if (cells.length < CREDENTIAL_TABLE_HEADER.length) return false;
  const normalized = cells.map(normalizeHeaderCell);
  return CREDENTIAL_TABLE_HEADER.every((expected, i) => normalized[i] === expected);
}

/**
 * 预览态展示用：链接只取可见文字，并去掉常见行内标记。
 * 例：`[后台](https://a.com)` → `后台`；`**admin**` → `admin`
 */
export function mapCredentialCellToPlain(cell: string): string {
  const trimmed = cell.trim();
  const link = trimmed.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
  if (link) return (link[1] || link[2] || "").trim();
  return trimmed
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

type PipeTableProbe =
  | { lineCount: number; isCredential: true; header: string[]; body: string[][] }
  | { lineCount: number; isCredential: false };

function probePipeTableAt(lines: string[], start: number): PipeTableProbe | null {
  const headerLine = lines[start];
  if (!headerLine || !headerLine.includes("|")) return null;
  if (!isTableDelimiterRow(lines[start + 1] ?? "")) return null;

  const header = splitTableRow(headerLine);
  if (header.length === 0) return null;

  const credential = isCredentialTableHeader(header);
  const body: string[][] = [];
  let i = start + 2;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "" || !line.includes("|") || isTableDelimiterRow(line)) break;
    body.push(splitTableRow(line));
    i += 1;
  }

  const lineCount = i - start;
  return credential ? { lineCount, isCredential: true, header, body } : { lineCount, isCredential: false };
}

/** 把全文切成 Markdown 段与凭据表段；非凭据表头的管道表原样留在 Markdown 段里。 */
export function parseMmdSegments(source: string): MmdSegment[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const segments: MmdSegment[] = [];
  const buffer: string[] = [];

  const flushMarkdown = () => {
    if (buffer.length === 0) return;
    segments.push({ type: "markdown", text: buffer.join("\n") });
    buffer.length = 0;
  };

  let i = 0;
  while (i < lines.length) {
    const probe = probePipeTableAt(lines, i);
    if (!probe) {
      buffer.push(lines[i]);
      i += 1;
      continue;
    }
    if (probe.isCredential) {
      flushMarkdown();
      segments.push({ type: "credentialTable", header: probe.header, body: probe.body });
    } else {
      buffer.push(...lines.slice(i, i + probe.lineCount));
    }
    i += probe.lineCount;
  }

  flushMarkdown();
  return segments;
}
