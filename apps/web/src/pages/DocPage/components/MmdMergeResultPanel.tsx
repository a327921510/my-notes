import { Alert, Input, Typography } from "antd";
import { memo } from "react";

export type MmdMergeResultPanelProps = {
  text: string;
  isManuallyEdited: boolean;
  onChange: (text: string) => void;
};

/** 合并结果实时预览，并允许直接手工改写（对齐 GitHub 冲突编辑器可自由编辑的行为）。 */
export const MmdMergeResultPanel = memo(function MmdMergeResultPanel({
  text,
  isManuallyEdited,
  onChange,
}: MmdMergeResultPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Typography.Text strong>合并结果</Typography.Text>
        <Typography.Text type="secondary" className="text-xs">
          可直接编辑；再改动勾选会以勾选结果为准
        </Typography.Text>
      </div>
      {isManuallyEdited ? <Alert type="info" showIcon title="结果已手工改写" /> : null}
      <Input.TextArea
        className="min-h-0 flex-1 font-mono"
        value={text}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        styles={{ textarea: { height: "100%", resize: "none" } }}
      />
    </div>
  );
});
