import {
  isCredentialTableHeader,
  isMarkdownTableDelimiterRow,
  splitMarkdownTableRow,
} from "./splitMarkdownTableRow";

export type ProjectMdSegment =
  | { type: "markdown"; text: string }
  | { type: "credentialTable"; header: string[]; body: string[][] };

/**
 * 将全文拆成 Markdown 段与「地址/账号/密码/备注」表；非该表头的管道表原样作为 Markdown 段保留。
 */
export function segmentProjectMarkdownWithCredentialTables(source: string): ProjectMdSegment[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const segments: ProjectMdSegment[] = [];
  const buf: string[] = [];
  let i = 0;

  const flushMd = () => {
    if (buf.length === 0) return;
    segments.push({ type: "markdown", text: buf.join("\n") });
    buf.length = 0;
  };

  while (i < lines.length) {
    const parsed = tryParsePipeTableAt(lines, i);
    if (parsed) {
      flushMd();
      if (parsed.isCredential) {
        segments.push({
          type: "credentialTable",
          header: parsed.header,
          body: parsed.body,
        });
      } else {
        buf.push(...lines.slice(i, i + parsed.lineCount));
      }
      i += parsed.lineCount;
      continue;
    }
    buf.push(lines[i]);
    i += 1;
  }
  flushMd();
  return segments;
}

type ParseResult =
  | { lineCount: number; isCredential: true; header: string[]; body: string[][] }
  | { lineCount: number; isCredential: false };

function tryParsePipeTableAt(lines: string[], start: number): ParseResult | null {
  if (start >= lines.length) return null;
  const headerLine = lines[start];
  if (!headerLine || !headerLine.includes("|")) return null;
  if (start + 1 >= lines.length) return null;
  const delimLine = lines[start + 1];
  if (!isMarkdownTableDelimiterRow(delimLine)) return null;

  const headerCells = splitMarkdownTableRow(headerLine);
  if (headerCells.length === 0) return null;

  const isCredential = isCredentialTableHeader(headerCells);
  let i = start + 2;
  const body: string[][] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (!line.includes("|")) break;
    if (isMarkdownTableDelimiterRow(line)) break;
    body.push(splitMarkdownTableRow(line));
    i += 1;
  }

  const lineCount = i - start;
  if (isCredential) {
    return { lineCount, isCredential: true, header: headerCells, body };
  }
  return { lineCount, isCredential: false };
}
