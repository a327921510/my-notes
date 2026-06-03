import { memo } from "react";

export type MarkdownTablePlainCellProps = {
  text: string;
};

/** 管道表单元格纯文本展示（复制由表格局部的空白点击处理） */
export const MarkdownTablePlainCell = memo(function MarkdownTablePlainCell({
  text,
}: MarkdownTablePlainCellProps) {
  if (!text) {
    return <span className="text-[#bfbfbf]">（空）</span>;
  }
  return <span className="break-all">{text}</span>;
});
