import { FolderOpenOutlined } from "@ant-design/icons";
import { App } from "antd";
import { memo, useCallback, type ReactNode } from "react";

import { isDesktopApp, getDesktopPlatform, getFileManagerCopy, openPathInExplorer } from "@/utils/desktopBridge";

export type WindowsPathLinkProps = {
  path: string;
  children: ReactNode;
};

export const WindowsPathLink = memo(function WindowsPathLink({
  path,
  children,
}: WindowsPathLinkProps) {
  const { message } = App.useApp();
  const canOpen = isDesktopApp();
  const fileManager = getFileManagerCopy(getDesktopPlatform());

  const handleOpen = useCallback(() => {
    void (async () => {
      const result = await openPathInExplorer(path);
      if (result.ok) {
        message.success(result.openedParent ? fileManager.successOpenParent : fileManager.successOpen);
        return;
      }
      message.error(result.error);
    })();
  }, [fileManager.successOpen, fileManager.successOpenParent, message, path]);

  return (
    <button
      type="button"
      className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded px-0.5 text-left text-[#1677ff] underline decoration-[#91caff] underline-offset-2 transition-colors hover:text-[#4096ff] hover:decoration-[#1677ff] disabled:cursor-not-allowed disabled:text-[#8c8c8c] disabled:no-underline"
      onClick={handleOpen}
      disabled={!canOpen}
      title={canOpen ? fileManager.openTitle : "请使用 MyNotes 桌面版打开本地路径"}
      aria-label={canOpen ? `${fileManager.openAriaPrefix} ${path}` : `本地路径（仅桌面版可打开）：${path}`}
    >
      <FolderOpenOutlined className="shrink-0 text-xs" aria-hidden />
      <span className="break-all">{children}</span>
    </button>
  );
});
