import MDEditor from "@uiw/react-md-editor";
import { memo, useMemo } from "react";
import type { Components } from "react-markdown";

import { linkifyWindowsPathsInMarkdown } from "../utils/linkifyWindowsPathsInMarkdown";
import { parseWindowsPathMarkdownHref } from "../utils/windowsPath";
import { WindowsPathLink } from "./WindowsPathLink";

export type ProjectMarkdownHtmlChunkProps = {
  source: string;
};

const markdownAnchorComponents: Components = {
  a({ href, children, ...rest }) {
    const winPath = parseWindowsPathMarkdownHref(href);
    if (winPath) {
      return <WindowsPathLink path={winPath}>{children}</WindowsPathLink>;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" {...rest}>
        {children}
      </a>
    );
  },
};

export const ProjectMarkdownHtmlChunk = memo(function ProjectMarkdownHtmlChunk({
  source,
}: ProjectMarkdownHtmlChunkProps) {
  const linked = useMemo(() => linkifyWindowsPathsInMarkdown(source), [source]);

  return (
    <div data-color-mode="light" className="project-md-html">
      <MDEditor.Markdown source={linked} components={markdownAnchorComponents} />
    </div>
  );
});
