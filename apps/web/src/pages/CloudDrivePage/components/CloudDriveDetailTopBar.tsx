import { PlusOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import { memo } from "react";

export type CloudDriveDetailTopBarProps = {
  pathLabel: string;
  onAddFile: () => void;
};

export const CloudDriveDetailTopBar = memo(function CloudDriveDetailTopBar({
  pathLabel,
  onAddFile,
}: CloudDriveDetailTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
      <Typography.Text strong>当前路径：{pathLabel}</Typography.Text>
      <Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddFile}>
          新增文件
        </Button>
      </Space>
    </div>
  );
});
