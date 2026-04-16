import { Space, Typography } from "antd";
import { memo } from "react";

export type DemoStatBarProps = {
  itemCount: number;
  selectedLabel: string | null;
};

export const DemoStatBar = memo(function DemoStatBar({ itemCount, selectedLabel }: DemoStatBarProps) {
  return (
    <Space wrap className="text-sm text-neutral-600">
      <Typography.Text type="secondary">共 {itemCount} 条</Typography.Text>
      <Typography.Text type="secondary">
        当前选中：{selectedLabel ?? "（无）"}
      </Typography.Text>
    </Space>
  );
});
