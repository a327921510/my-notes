import {
  AppstoreOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Avatar, Button, Dropdown, Layout, Space, Typography } from "antd";
import { Suspense, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/stores/useAuthStore";

const { Header, Content } = Layout;

const NAV_ITEMS = [
  { key: "/", label: "笔记区", icon: <FileTextOutlined /> },
  { key: "/sites", label: "站点信息区", icon: <GlobalOutlined /> },
  { key: "/projects", label: "项目信息区", icon: <AppstoreOutlined /> },
  { key: "/cloud-drive", label: "云盘", icon: <FolderOpenOutlined /> },
] as const;

function pathToMenuKey(pathname: string): string | null {
  const normalized =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (normalized === "/user") return null;
  const match = NAV_ITEMS.find(
    (item) => item.key !== "/" && pathname.startsWith(item.key),
  );
  return match?.key ?? "/";
}

export function MainLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const selectedKey = pathToMenuKey(pathname);

  const loggedInMenuItems = useMemo<MenuProps["items"]>(
    () => [
      {
        key: "profile",
        label: "用户信息",
        onClick: () => navigate("/user"),
      },
      { type: "divider" },
      {
        key: "logout",
        label: "登出",
        danger: true,
        onClick: () => logout(),
      },
    ],
    [logout, navigate],
  );

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
              type={selectedKey !== null && selectedKey === item.key ? "primary" : "default"}
              icon={item.icon}
              onClick={() => navigate(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Dropdown
          menu={{ items: loggedInMenuItems }}
          trigger={["hover"]}
          placement="bottomRight"
        >
          <Space className="cursor-pointer select-none py-1" size={8}>
            <Avatar icon={<UserOutlined />} />
            {user ? (
              <Typography.Text className="max-w-[200px] truncate" type="secondary">
                <span className="text-white">{user.email}</span>
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                <span className="text-white">游客</span>
              </Typography.Text>
            )}
          </Space>
        </Dropdown>
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
