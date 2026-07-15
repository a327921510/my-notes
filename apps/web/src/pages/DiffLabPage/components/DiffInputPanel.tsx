import { Input, Select, Typography } from "antd";
import { memo } from "react";

import type { DiffSideInput } from "../types";

export type DiffInputPanelProps = {
  title: string;
  side: DiffSideInput;
  fileOptions: { value: string; label: string }[];
  onSelectFile: (fileId: string | null) => void;
  onTextChange: (text: string) => void;
};

export const DiffInputPanel = memo(function DiffInputPanel({
  title,
  side,
  fileOptions,
  onSelectFile,
  onTextChange,
}: DiffInputPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-[#f0f0f0] bg-white p-3">
      <Typography.Text strong>{title}</Typography.Text>
      <Select
        allowClear
        showSearch
        placeholder="从文件管理选择 .md / .rm"
        optionFilterProp="label"
        options={fileOptions}
        value={side.fileId ?? undefined}
        onChange={(value) => onSelectFile(value ?? null)}
        className="w-full"
      />
      <Input.TextArea
        value={side.text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="或在此粘贴文本…"
        className="min-h-[180px] flex-1 font-mono text-xs"
        autoSize={{ minRows: 8, maxRows: 16 }}
      />
      {side.fileName ? (
        <Typography.Text type="secondary" className="text-xs">
          当前文件：{side.fileName}
        </Typography.Text>
      ) : null}
    </div>
  );
});
