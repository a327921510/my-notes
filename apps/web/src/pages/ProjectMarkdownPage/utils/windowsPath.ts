const WIN_DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const WIN_UNC_PATH = /^\\\\[^\\]+\\[^\\]+/;

/** 是否为 Windows 绝对路径（盘符或 UNC）。 */
export function isWindowsAbsolutePath(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return WIN_DRIVE_PATH.test(t) || WIN_UNC_PATH.test(t);
}

/** 规范化路径分隔符，去掉首尾空白与包裹引号。 */
export function normalizeWindowsPath(value: string): string {
  let t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t.replace(/\//g, "\\");
}

export const WINDOWS_PATH_LINK_PREFIX = "mynotes-path:";

export function toWindowsPathMarkdownHref(path: string): string {
  return `${WINDOWS_PATH_LINK_PREFIX}${encodeURIComponent(normalizeWindowsPath(path))}`;
}

export function parseWindowsPathMarkdownHref(href: string | undefined): string | null {
  if (!href?.startsWith(WINDOWS_PATH_LINK_PREFIX)) return null;
  try {
    const decoded = decodeURIComponent(href.slice(WINDOWS_PATH_LINK_PREFIX.length));
    return isWindowsAbsolutePath(decoded) ? normalizeWindowsPath(decoded) : null;
  } catch {
    return null;
  }
}
