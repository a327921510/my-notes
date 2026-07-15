import {
  isMacAbsolutePath,
  isWindowsAbsolutePath,
  normalizeLocalPath,
  toWindowsPathMarkdownHref,
} from "./windowsPath";

/** 行内 Windows 路径（盘符或 UNC），避免匹配已在链接/代码中的片段。 */
const WIN_PATH_IN_LINE =
  /(?<![\[`(])(\\{2}[^\s`"<>|[\]()]+|(?:[A-Za-z]:)[\\/][^\s`"<>|[\]()]+)/g;

/** 行内 macOS / Unix 绝对路径（/ 或 ~/ 开头）。 */
const MAC_PATH_IN_LINE =
  /(?<![\[`(:])(?:~\/[^\s`"<>|[\]()]+|\/(?:Users|Volumes|Applications|private|opt|var|tmp|Library|System)(?:\/[^\s`"<>|[\]()]+)*)/g;

function trimTrailingPathPunctuation(segment: string): { core: string; suffix: string } {
  const trailing = /[),.，。；;:!?]+$/;
  const m = segment.match(trailing);
  if (!m) return { core: segment, suffix: "" };
  const suffix = m[0];
  return { core: segment.slice(0, -suffix.length), suffix };
}

function linkifyPlainSegment(segment: string): string {
  const withWin = segment.replace(WIN_PATH_IN_LINE, (raw) => {
    const { core, suffix } = trimTrailingPathPunctuation(raw);
    if (!isWindowsAbsolutePath(core)) return raw;
    const path = normalizeLocalPath(core);
    return `[${core}](${toWindowsPathMarkdownHref(path)})${suffix}`;
  });

  return withWin.replace(MAC_PATH_IN_LINE, (raw) => {
    const { core, suffix } = trimTrailingPathPunctuation(raw);
    if (!isMacAbsolutePath(core)) return raw;
    const path = normalizeLocalPath(core);
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
 * 将 Markdown 正文中的裸本地路径转为 `mynotes-path:` 链接，便于阅读态点击打开。
 * 支持 Windows 盘符/UNC 与 macOS `/`、`~/` 路径；跳过围栏代码块；不处理管道表行。
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
