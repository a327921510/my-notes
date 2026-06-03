import { isWindowsAbsolutePath, normalizeWindowsPath, toWindowsPathMarkdownHref } from "./windowsPath";

/** 行内 Windows 路径（盘符或 UNC），避免匹配已在链接/代码中的片段。 */
const WIN_PATH_IN_LINE =
  /(?<![\[`(])(\\{2}[^\s`"<>|[\]()]+|(?:[A-Za-z]:)[\\/][^\s`"<>|[\]()]+)/g;

function trimTrailingPathPunctuation(segment: string): { core: string; suffix: string } {
  const trailing = /[),.，。；;:!?]+$/;
  const m = segment.match(trailing);
  if (!m) return { core: segment, suffix: "" };
  const suffix = m[0];
  return { core: segment.slice(0, -suffix.length), suffix };
}

function linkifyPlainSegment(segment: string): string {
  return segment.replace(WIN_PATH_IN_LINE, (raw) => {
    const { core, suffix } = trimTrailingPathPunctuation(raw);
    if (!isWindowsAbsolutePath(core)) return raw;
    const path = normalizeWindowsPath(core);
    return `[${core}](${toWindowsPathMarkdownHref(path)})${suffix}`;
  });
}

function linkifyLine(line: string): string {
  const parts = line.split(/(`[^`]*`)/g);
  return parts
    .map((part, index) => (index % 2 === 1 ? part : linkifyPlainSegment(part)))
    .join("");
}

/**
 * 将 Markdown 正文中的裸 Windows 路径转为 `mynotes-path:` 链接，便于阅读态点击打开。
 * 跳过围栏代码块；不处理管道表行（表内路径由表格单元格组件处理）。
 */
export function linkifyWindowsPathsInMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    if (trimmed.includes("|") && trimmed.startsWith("|")) {
      out.push(line);
      continue;
    }
    out.push(linkifyLine(line));
  }

  return out.join("\n");
}
