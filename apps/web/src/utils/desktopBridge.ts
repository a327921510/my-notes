export type OpenPathInExplorerResult =
  | { ok: true; openedParent?: boolean }
  | { ok: false; error: string };

export type DesktopPlatform = "darwin" | "win32" | "linux";

export function isDesktopApp(): boolean {
  return typeof window.__MY_NOTES_DESKTOP__?.openPathInExplorer === "function";
}

export function getDesktopPlatform(): DesktopPlatform | undefined {
  const platform = window.__MY_NOTES_DESKTOP__?.platform;
  if (platform === "darwin" || platform === "win32" || platform === "linux") {
    return platform;
  }
  return undefined;
}

type FileManagerCopy = {
  openTitle: string;
  openAriaPrefix: string;
  successOpen: string;
  successOpenParent: string;
};

const FILE_MANAGER_COPY: Record<DesktopPlatform, FileManagerCopy> = {
  win32: {
    openTitle: "在资源管理器中打开",
    openAriaPrefix: "在资源管理器中打开",
    successOpen: "已在资源管理器中打开",
    successOpenParent: "已在资源管理器中打开所在文件夹",
  },
  darwin: {
    openTitle: "在 Finder 中打开",
    openAriaPrefix: "在 Finder 中打开",
    successOpen: "已在 Finder 中打开",
    successOpenParent: "已在 Finder 中打开所在文件夹",
  },
  linux: {
    openTitle: "在文件管理器中打开",
    openAriaPrefix: "在文件管理器中打开",
    successOpen: "已在文件管理器中打开",
    successOpenParent: "已在文件管理器中打开所在文件夹",
  },
};

export function getFileManagerCopy(platform?: DesktopPlatform): FileManagerCopy {
  return FILE_MANAGER_COPY[platform ?? "win32"];
}

export async function openPathInExplorer(path: string): Promise<OpenPathInExplorerResult> {
  const open = window.__MY_NOTES_DESKTOP__?.openPathInExplorer;
  if (!open) {
    return { ok: false, error: "仅桌面客户端支持打开本地文件夹" };
  }
  return open(path);
}
