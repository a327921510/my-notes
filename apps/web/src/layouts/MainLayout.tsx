import {
  AppstoreOutlined,
  CloudSyncOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { Button, Layout, Space, Typography } from "antd";
import { Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/stores/useAuthStore";

const { Header, Content } = Layout;

const NAV_ITEMS = [
  { key: "/", label: "笔记区", icon: <FileTextOutlined /> },
  { key: "/sites", label: "站点信息区", icon: <GlobalOutlined /> },
  { key: "/cloud-drive", label: "云盘", icon: <FolderOpenOutlined /> },
] as const;

function pathToMenuKey(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => item.key !== "/" && pathname.startsWith(item.key),
  );
  return match?.key ?? "/";
}

export function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = pathToMenuKey(location.pathname);

  return (
    <Layout className="h-[100vh] bg-[#f5f5f5]">
      <Header className="sticky top-0 z-10 flex h-auto flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] bg-white px-4 py-3">
        <Typography.Title level={4} className="!mb-0">
          My Notes
        </Typography.Title>
        <div className="flex flex-wrap gap-1">
          {NAV_ITEMS.map((item) => (
            <Button
              key={item.key}
              type={selectedKey === item.key ? "primary" : "default"}
              icon={item.icon}
              onClick={() => navigate(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Space wrap>
          {user ? (
            <>
              <Typography.Text type="secondary">{user.email}</Typography.Text>
              <Button onClick={logout}>退出</Button>
            </>
          ) : (
            <Typography.Text type="secondary">
              未登录 · 可本地记录
            </Typography.Text>
          )}
        </Space>
      </Header>
      <Content>
        <Suspense>
          <Outlet />
        </Suspense>
      </Content>
    </Layout>
  );
}

export default MainLayout;
