import { Drawer, List, Space, Tag, Typography } from "antd";
import { memo } from "react";

import type { ConflictRecord } from "../types";

export type SyncPanelProps = {
  open: boolean;
  onClose: () => void;
  runningType: "push" | "pull" | null;
  conflicts: ConflictRecord[];
};

export const SyncPanel = memo(function SyncPanel({ open, onClose, runningType, conflicts }: SyncPanelProps) {
  return (
    <Drawer
      title="同步中心"
      placement="right"
      width={520}
      open={open}
      onClose={onClose}
      extra={runningType ? <Tag color="processing">{runningType === "push" ? "正在上行" : "正在下行"}</Tag> : null}
    >
      <Space direction="vertical" className="w-full" size="middle">
        <Typography.Text>
          冲突统计：<Typography.Text strong>{conflicts.length}</Typography.Text> 条（默认策略：LWW 自动处理）
        </Typography.Text>
        <List
          bordered
          dataSource={conflicts}
          locale={{ emptyText: "暂无冲突记录" }}
          renderItem={(item) => (
            <List.Item>
              <div className="w-full">
                <Space>
                  <Tag>{item.entityType === "file" ? "文件" : "目录"}</Tag>
                  <Typography.Text code>{item.field}</Typography.Text>
                </Space>
                <div className="mt-2">
                  <Typography.Text type="secondary">本地：{item.localValue}</Typography.Text>
                </div>
                <div>
                  <Typography.Text type="secondary">云端：{item.cloudValue}</Typography.Text>
                </div>
              </div>
            </List.Item>
          )}
        />
      </Space>
    </Drawer>
  );
});
