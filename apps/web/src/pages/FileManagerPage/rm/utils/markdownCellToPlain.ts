/** 阅读态展示用：链接仅显示其可见文字，其它轻量去除常见行内标记。 */
export function markdownCellToPlain(s: string): string {
  const t = s.trim();
  const link = t.match(/^\[([^\]]*)\]\(([^)]*)\)$/);
  if (link) return (link[1] || link[2] || "").trim();
  return t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}
