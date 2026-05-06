import { ExportOutlined, ImportOutlined } from "@ant-design/icons";
import { Button, Card, Descriptions, Space, Typography } from "antd";
import { memo } from "react";

export type UserInfoPanelProps = {
  displayName: string;
  isLoggedIn: boolean;
  userId: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onExport: () => void | Promise<void>;
  onImport: () => void;
};

export const UserInfoPanel = memo(function UserInfoPanel({
  displayName,
  isLoggedIn,
  userId,
  onLogin,
  onLogout,
  onExport,
  onImport,
}: UserInfoPanelProps) {
  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card title="账号信息">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="名称">{displayName}</Descriptions.Item>
          {isLoggedIn ? (
            <Descriptions.Item label="用户 ID">{userId ?? "—"}</Descriptions.Item>
          ) : null}
        </Descriptions>
        <div className="mt-4">
          {isLoggedIn ? (
            <Button onClick={onLogout}>登出</Button>
          ) : (
            <Button type="primary" onClick={onLogin}>
              登录
            </Button>
          )}
        </div>
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
