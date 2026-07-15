import { Typography } from "antd";
import { memo } from "react";

import type { DriveDiffSummary } from "@my-notes/shared";

export type DiffStatBarProps = {
  summary: DriveDiffSummary;
};

export const DiffStatBar = memo(function DiffStatBar({ summary }: DiffStatBarProps) {
  const changed = summary.added + summary.modified + summary.removed;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <Typography.Text strong>{changed} 项变更</Typography.Text>
      <span className="text-[#1a7f37]">+{summary.added} 新增</span>
      <span className="text-[#9a6700]">~{summary.modified} 修改</span>
      <span className="text-[#cf222e]">-{summary.removed} 删除</span>
      <Typography.Text type="secondary">{summary.unchanged} 未变</Typography.Text>
    </div>
  );
});
