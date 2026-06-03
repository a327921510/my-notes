/** 解析 GFM 管道表的一行，得到各单元格原始文本（无外侧 `|`）。 */
export function splitMarkdownTableRow(line: string): string[] {
  const t = line.trim();
  if (!t.includes("|")) return [];
  const parts = t.split("|");
  const cells = parts.map((p) => p.trim());
  if (cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

export function isMarkdownTableDelimiterRow(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

export function normalizeTableHeaderCell(s: string): string {
  return s.replace(/\*\*/g, "").replace(/`/g, "").trim();
}
