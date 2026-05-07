const ENTRY_LINE = /^\*\*(.+?)\*\*：(.*)$/;

export type SiteMdBlock =
  | { type: "markdown"; text: string }
  | { type: "entry"; name: string; value: string };

/**
 * 将整站 Markdown 按行拆成块：符合 `**名称**：内容`（全角冒号）的整行视为可点击复制的条目，其余行合并为普通 Markdown 块。
 */
export function parseSiteMarkdownToBlocks(source: string): SiteMdBlock[] {
  const lines = source.split("\n");
  const blocks: SiteMdBlock[] = [];
  const buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    blocks.push({ type: "markdown", text: buf.join("\n") });
    buf.length = 0;
  };

  for (const line of lines) {
    const m = line.match(ENTRY_LINE);
    if (m) {
      flush();
      blocks.push({ type: "entry", name: m[1].trim(), value: m[2] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}
