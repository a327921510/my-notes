import {
  AppstoreOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  LoginOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Layout, Space, Typography } from "antd";
import { Suspense, useCallback, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { LoginModal } from "@/components/LoginModal";
import { useAuthStore } from "@/stores/useAuthStore";

const { Header, Content } = Layout;

const NAV_ITEMS = [
  { key: "/", label: "笔记区", icon: <FileTextOutlined /> },
  { key: "/sites", label: "站点信息区", icon: <GlobalOutlined /> },
  { key: "/projects", label: "项目信息区", icon: <AppstoreOutlined /> },
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
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

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
              <Space size={4}>
                <UserOutlined />
                <Typography.Text type="secondary">{user.email}</Typography.Text>
              </Space>
              <Button onClick={logout}>退出</Button>
            </>
          ) : (
            <Button type="primary" icon={<LoginOutlined />} onClick={openLogin}>
              登录
            </Button>
          )}
        </Space>
      </Header>
      <Content>
        <Suspense>
          <Outlet />
        </Suspense>
      </Content>
      <LoginModal isOpen={loginOpen} onClose={closeLogin} />
    </Layout>
  );
}

export default MainLayout;
