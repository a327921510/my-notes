/**
 * fsBackup 路径工具：用「/a/b/file.rm」形式对齐本地与导入两侧。
 */

const ILLEGAL_SEGMENT = /[\\:*?"<>|]/;

/** 规范化为以 / 开头、无尾斜线的绝对路径；根目录为 "/" */
export function normalizeFsPath(path: string): string {
  const trimmed = path.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed === "/") return "/";
  const parts = trimmed.split("/").filter((p) => p.length > 0 && p !== ".");
  for (const part of parts) {
    if (part === "..") throw new Error(`非法路径：${path}`);
    if (ILLEGAL_SEGMENT.test(part)) throw new Error(`路径含非法字符：${path}`);
  }
  return `/${parts.join("/")}`;
}

export function pathBasename(path: string): string {
  const n = normalizeFsPath(path);
  if (n === "/") return "";
  const i = n.lastIndexOf("/");
  return n.slice(i + 1);
}

export function pathParent(path: string): string {
  const n = normalizeFsPath(path);
  if (n === "/") return "/";
  const i = n.lastIndexOf("/");
  if (i <= 0) return "/";
  return n.slice(0, i);
}

/** 返回从根之下到该路径（含自身）的全部文件夹 path，深度升序 */
export function folderAncestorsInclusive(folderPath: string): string[] {
  const n = normalizeFsPath(folderPath);
  if (n === "/") return [];
  const parts = n.slice(1).split("/");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    out.push(`/${parts.slice(0, i + 1).join("/")}`);
  }
  return out;
}

/** 文件路径所需的全部父文件夹 path */
export function parentFoldersOfFile(filePath: string): string[] {
  return folderAncestorsInclusive(pathParent(filePath));
}

export function joinFsPath(parentPath: string, name: string): string {
  const parent = normalizeFsPath(parentPath);
  const seg = name.trim();
  if (!seg || ILLEGAL_SEGMENT.test(seg) || seg.includes("/")) {
    throw new Error(`非法名称：${name}`);
  }
  return parent === "/" ? `/${seg}` : `${parent}/${seg}`;
}
