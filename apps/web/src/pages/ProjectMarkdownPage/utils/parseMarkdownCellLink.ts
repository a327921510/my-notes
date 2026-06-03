export type MarkdownCellLink = {
  label: string;
  href: string;
};

/** 解析单元格是否为单行 Markdown 链接 `[label](href)`。 */
export function parseMarkdownCellLink(raw: string): MarkdownCellLink | null {
  const t = raw.trim();
  const match = t.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
  if (!match) return null;
  const href = (match[2] ?? "").trim();
  if (!href) return null;
  const label = (match[1] || href).trim();
  return { label, href };
}
