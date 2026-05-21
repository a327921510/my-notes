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
          数据完全保存在本地（IndexedDB）。可通过下方导出 / 导入 JSON 文件迁移数据。
        </Typography.Paragraph>
      </Card>

      <Card title="站点与项目数据">
        <Typography.Paragraph type="secondary" className="!mb-4">
          导出或导入本地「站点信息区」「项目信息区」数据（JSON）。导入时会按项目名称、站点名称与地址、以及条目名称与正文与本地比对：完全一致的条目会跳过，其余视为新增写入。
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
