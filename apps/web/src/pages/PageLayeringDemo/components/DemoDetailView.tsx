import { Button, Card, Empty, Typography } from "antd";

export type DemoDetailViewProps = {
  selectedLabel: string | null;
  onDeleteSelected?: () => void;
};

/** 纯展示 + 回调：右侧详情区样式与操作入口。 */
export function DemoDetailView({ selectedLabel, onDeleteSelected }: DemoDetailViewProps) {
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
}
