import {
  AppstoreOutlined,
  FileTextOutlined,
  SnippetsOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Avatar, Dropdown, Layout, Menu, Space, Typography } from "antd";
import { Suspense, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { GlobalEntrySearch } from "@/components/GlobalEntrySearch";
import { useAuthStore } from "@/stores/useAuthStore";

const { Header, Content } = Layout;

const NAV_ITEMS = [
  { key: "/", label: "笔记区", icon: <FileTextOutlined /> },
  { key: "/sites", label: "站点信息区", icon: <GlobalOutlined /> },
  { key: "/project-markdown", label: "项目文档", icon: <SnippetsOutlined /> },
  { key: "/projects", label: "项目信息区", icon: <AppstoreOutlined /> },
  { key: "/cloud-drive", label: "云盘", icon: <FolderOpenOutlined /> },
] as const;

/** 左侧品牌 / Logo 占位最小宽度（Tailwind `min-w-52` ≈ 13rem） */
const LOGO_AREA_CLASS = "min-w-52";

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

  const mainNavItems = useMemo<MenuProps["items"]>(
    () =>
      NAV_ITEMS.map((item) => ({
        key: item.key,
        icon: item.icon,
        label: item.label,
      })),
    [],
  );

  return (
    <Layout className="h-[100vh] bg-[#f5f5f5]">
      <div className="sticky top-0 z-10 flex h-auto min-h-14 flex-wrap items-stretch gap-0 border-b border-[#f0f0f0] bg-white px-2">
        <div
          className={`flex shrink-0 items-center ${LOGO_AREA_CLASS}`}
        >
          <Typography.Title level={4} className="!mb-0 truncate">
            My Notes
          </Typography.Title>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={selectedKey !== null ? [selectedKey] : []}
          items={mainNavItems}
          className="min-h-14 min-w-0 flex-1 border-b-0 bg-transparent px-2 [&_.ant-menu-item]:flex [&_.ant-menu-item]:items-center"
          onClick={({ key }) => {
            navigate(key);
          }}
        />
        <div className="flex min-w-0 shrink-0 items-center gap-2 py-1">
          <GlobalEntrySearch />
          <Dropdown
            menu={{ items: loggedInMenuItems }}
            trigger={["hover"]}
            placement="bottomRight"
          >
          <Space className="cursor-pointer select-none py-1 h-full" size={8}>
            <Avatar icon={<UserOutlined />} />
            {user ? (
              <Typography.Text className="max-w-[200px] truncate" type="secondary">
                {user.email}
              </Typography.Text>
            ) : (
              <Typography.Text type="secondary">游客</Typography.Text>
            )}
          </Space>
        </Dropdown>
        </div>
      </div>
      <Content>
        <Suspense>
          <Outlet />
        </Suspense>
      </Content>
    </Layout>
  );
}

export default MainLayout;
