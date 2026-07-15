import { CloudDownloadOutlined, CloudUploadOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import { memo } from "react";

export type CloudDriveDetailTopBarProps = {
  pathLabel: string;
  syncing: boolean;
  onPull: () => void;
  onPush: () => void;
  onAddFile: () => void;
};

export const CloudDriveDetailTopBar = memo(function CloudDriveDetailTopBar({
  pathLabel,
  syncing,
  onPull,
  onPush,
  onAddFile,
}: CloudDriveDetailTopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
      <Typography.Text strong>当前路径：{pathLabel}</Typography.Text>
      <Space>
        <Button icon={<CloudDownloadOutlined />} disabled={syncing} onClick={onPull}>
          下行对比
        </Button>
        <Button icon={<CloudUploadOutlined />} disabled={syncing} onClick={onPush}>
          上行对比
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAddFile}>
          新增文件
        </Button>
      </Space>
    </div>
  );
});
