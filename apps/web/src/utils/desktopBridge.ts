export type OpenPathInExplorerResult =
  | { ok: true; openedParent?: boolean }
  | { ok: false; error: string };

export function isDesktopApp(): boolean {
  return typeof window.__MY_NOTES_DESKTOP__?.openPathInExplorer === "function";
}

export async function openPathInExplorer(path: string): Promise<OpenPathInExplorerResult> {
  const open = window.__MY_NOTES_DESKTOP__?.openPathInExplorer;
  if (!open) {
    return { ok: false, error: "仅桌面客户端支持打开本地文件夹" };
  }
  return open(path);
}
