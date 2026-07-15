const WIN_DRIVE_PATH = /^[A-Za-z]:[\\/]/;
const WIN_UNC_PATH = /^\\\\[^\\]+\\[^\\]+/;
const MAC_ABSOLUTE_PATH = /^(?:~(?:\/|$)|\/)/;

/** 是否为 Windows 绝对路径（盘符或 UNC）。 */
export function isWindowsAbsolutePath(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return WIN_DRIVE_PATH.test(t) || WIN_UNC_PATH.test(t);
}

/** 是否为 macOS / Unix 绝对路径（/ 或 ~ 开头）。 */
export function isMacAbsolutePath(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  return MAC_ABSOLUTE_PATH.test(t);
}

/** 是否为当前平台可打开的本地绝对路径。 */
export function isLocalAbsolutePath(value: string): boolean {
  return isWindowsAbsolutePath(value) || isMacAbsolutePath(value);
}

function stripWrappingQuotes(value: string): string {
  let t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** 规范化路径分隔符，去掉首尾空白与包裹引号。 */
export function normalizeWindowsPath(value: string): string {
  return stripWrappingQuotes(value).replace(/\//g, "\\");
}

/** 规范化 macOS 路径分隔符，去掉首尾空白与包裹引号。 */
export function normalizeMacPath(value: string): string {
  return stripWrappingQuotes(value).replace(/\\/g, "/");
}

/** 按路径形态规范化（Windows 或 macOS）。 */
export function normalizeLocalPath(value: string): string {
  const stripped = stripWrappingQuotes(value);
  if (isWindowsAbsolutePath(stripped)) return normalizeWindowsPath(stripped);
  if (isMacAbsolutePath(stripped)) return normalizeMacPath(stripped);
  return stripped;
}

export const WINDOWS_PATH_LINK_PREFIX = "mynotes-path:";

export function toWindowsPathMarkdownHref(path: string): string {
  return `${WINDOWS_PATH_LINK_PREFIX}${encodeURIComponent(normalizeLocalPath(path))}`;
}

export function parseWindowsPathMarkdownHref(href: string | undefined): string | null {
  if (!href?.startsWith(WINDOWS_PATH_LINK_PREFIX)) return null;
  try {
    const decoded = decodeURIComponent(href.slice(WINDOWS_PATH_LINK_PREFIX.length));
    return isLocalAbsolutePath(decoded) ? normalizeLocalPath(decoded) : null;
  } catch {
    return null;
  }
}
