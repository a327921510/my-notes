import { Button, Card, Empty, Typography } from "antd";
import { memo } from "react";

export type DemoDetailViewProps = {
  selectedLabel: string | null;
  onDeleteSelected?: () => void;
};

export const DemoDetailView = memo(function DemoDetailView({ selectedLabel, onDeleteSelected }: DemoDetailViewProps) {
  if (!selectedLabel) {
    return <Empty description="请在左侧选择一条" />;
  }

  return (
    <Card size="small" title="详情（展示层）">
      <Typography.Paragraph className="!mb-3">{selectedLabel}</Typography.Paragraph>
      {onDeleteSelected ? (
        <Button danger size="small" onClick={onDeleteSelected}>
          删除当前条目
        </Button>
      ) : null}
    </Card>
  );
});
