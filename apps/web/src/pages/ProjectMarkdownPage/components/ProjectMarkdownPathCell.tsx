import { memo } from "react";

import { isWindowsAbsolutePath, normalizeWindowsPath } from "../utils/windowsPath";
import { WindowsPathLink } from "./WindowsPathLink";

export type ProjectMarkdownPathCellProps = {
  text: string;
};

export const ProjectMarkdownPathCell = memo(function ProjectMarkdownPathCell({
  text,
}: ProjectMarkdownPathCellProps) {
  const plain = text.trim();
  if (!plain) {
    return <span className="text-[#bfbfbf]">—</span>;
  }
  if (isWindowsAbsolutePath(plain)) {
    const path = normalizeWindowsPath(plain);
    return <WindowsPathLink path={path}>{plain}</WindowsPathLink>;
  }
  return <span className="break-all">{plain}</span>;
});
