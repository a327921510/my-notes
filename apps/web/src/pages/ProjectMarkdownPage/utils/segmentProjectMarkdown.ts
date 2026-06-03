import {
  isCodeRepoTableHeader,
  isCredentialTableHeader,
} from "./projectMarkdownTableHeaders";
import { isMarkdownTableDelimiterRow, splitMarkdownTableRow } from "./splitMarkdownTableRow";

export type ProjectMdSegment =
  | { type: "markdown"; text: string }
  | { type: "genericTable"; header: string[]; body: string[][] }
  | { type: "credentialTable"; header: string[]; body: string[][] }
  | { type: "codeRepoTable"; header: string[]; body: string[][] };

type SpecialTableKind = "credential" | "codeRepo";

/**
 * 将全文拆成 Markdown 段与管道表：特殊表头（凭证、代码仓库）与通用 GFM 表分别输出；其余 Markdown 原样保留。
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
      if (parsed.kind === "credential") {
        segments.push({
          type: "credentialTable",
          header: parsed.header,
          body: parsed.body,
        });
      } else if (parsed.kind === "codeRepo") {
        segments.push({
          type: "codeRepoTable",
          header: parsed.header,
          body: parsed.body,
        });
      } else {
        segments.push({
          type: "genericTable",
          header: parsed.header,
          body: parsed.body,
        });
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

type ParseResult = {
  lineCount: number;
  kind: SpecialTableKind | null;
  header: string[];
  body: string[][];
};

function detectSpecialTableKind(headerCells: string[]): SpecialTableKind | null {
  if (isCredentialTableHeader(headerCells)) return "credential";
  if (isCodeRepoTableHeader(headerCells)) return "codeRepo";
  return null;
}

function tryParsePipeTableAt(lines: string[], start: number): ParseResult | null {
  if (start >= lines.length) return null;
  const headerLine = lines[start];
  if (!headerLine || !headerLine.includes("|")) return null;
  if (start + 1 >= lines.length) return null;
  const delimLine = lines[start + 1];
  if (!isMarkdownTableDelimiterRow(delimLine)) return null;

  const headerCells = splitMarkdownTableRow(headerLine);
  if (headerCells.length === 0) return null;

  const kind = detectSpecialTableKind(headerCells);
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
  return { lineCount, kind, header: headerCells, body };
}
