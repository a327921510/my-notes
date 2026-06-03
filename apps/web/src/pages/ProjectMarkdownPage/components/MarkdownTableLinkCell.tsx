import { memo } from "react";

import { markdownCellToPlain } from "../utils/markdownCellToPlain";
import { parseMarkdownCellLink } from "../utils/parseMarkdownCellLink";

import { MarkdownTablePlainCell } from "./MarkdownTablePlainCell";

export type MarkdownTableLinkCellProps = {
  raw: string;
};

export const MarkdownTableLinkCell = memo(function MarkdownTableLinkCell({
  raw,
}: MarkdownTableLinkCellProps) {
  const link = parseMarkdownCellLink(raw);
  if (link) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer noopener"
        className="break-all text-[#1677ff] underline decoration-[#91caff] underline-offset-2 transition-colors hover:text-[#4096ff] hover:decoration-[#1677ff]"
      >
        {link.label}
      </a>
    );
  }

  return <MarkdownTablePlainCell text={markdownCellToPlain(raw)} />;
});
