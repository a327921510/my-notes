import { App, Button, Input, Typography } from "antd";
import { memo, useCallback } from "react";

export type DiffMergePreviewProps = {
  mergedText: string;
  identical: boolean;
};

export const DiffMergePreview = memo(function DiffMergePreview({
  mergedText,
  identical,
}: DiffMergePreviewProps) {
  const { message } = App.useApp();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mergedText);
      message.success("已复制合并结果");
    } catch {
      message.error("复制失败");
    }
  }, [mergedText, message]);

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-[#f0f0f0] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography.Text strong>合并结果预览</Typography.Text>
        <Button size="small" onClick={() => void handleCopy()} disabled={identical && !mergedText}>
          复制
        </Button>
      </div>
      {identical ? (
        <Typography.Text type="secondary" className="text-sm">
          两侧完全一致，无需合并。
        </Typography.Text>
      ) : (
        <Input.TextArea
          value={mergedText}
          readOnly
          className="min-h-[160px] font-mono text-xs"
          autoSize={{ minRows: 8, maxRows: 20 }}
        />
      )}
    </div>
  );
});
