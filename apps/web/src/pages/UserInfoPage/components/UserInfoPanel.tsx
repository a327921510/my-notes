import { ExportOutlined, ImportOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Space, Typography } from "antd";
import { memo } from "react";

export type UserInfoPanelProps = {
  displayName: string;
  onExport: () => void | Promise<void>;
  onImport: () => void;
};

export const UserInfoPanel = memo(function UserInfoPanel({
  displayName,
  onExport,
  onImport,
}: UserInfoPanelProps) {
  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="账号信息">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="名称">{displayName}</Descriptions.Item>
        </Descriptions>
        <Typography.Paragraph type="secondary" className="!mt-3 !mb-0">
          数据完全保存在本地（IndexedDB）。可通过下方导出 / 导入 JSON 迁移「文件管理」数据。
        </Typography.Paragraph>
      </Card>

      <Card title="文件管理数据">
        <Typography.Paragraph type="secondary" className="!mb-4">
          导出或导入本地文件管理（目录 + `.md` / `.rm`）备份。选择导入文件后将跳转到「导入确认」页：按路径比对，冲突可逐文件裁决，仅本地文件可选保留或删除。
        </Typography.Paragraph>
        <Space wrap>
          <Button type="primary" icon={<ExportOutlined />} onClick={() => void onExport()}>
            导出 JSON
          </Button>
          <Button icon={<ImportOutlined />} onClick={onImport}>
            导入 JSON
          </Button>
        </Space>
      </Card>
    </Space>
  );
});
