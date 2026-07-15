import { HddOutlined, UserOutlined } from "@ant-design/icons";
import { Layout, Menu, Space, Typography } from "antd";
import type { MenuProps } from "antd";
import { Suspense, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { GlobalEntrySearch } from "@/components/GlobalEntrySearch";

const { Content } = Layout;

const NAV_ITEMS = [
  { key: "/files", label: "文件管理", icon: <HddOutlined /> },
] as const;

const LOGO_AREA_CLASS = "min-w-52";

function pathToMenuKey(pathname: string): string | null {
  const normalized =
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (normalized === "/user" || normalized.startsWith("/user/")) return null;
  const sorted = [...NAV_ITEMS].sort((a, b) => b.key.length - a.key.length);
  const match = sorted.find(
    (item) => normalized === item.key || normalized.startsWith(`${item.key}/`),
  );
  return match?.key ?? null;
}

export function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const selectedKey = pathToMenuKey(pathname);

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
    <Layout className="h-screen bg-[#f5f5f5]">
      <div className="sticky top-0 z-10 flex h-auto min-h-14 flex-wrap items-stretch border-b border-[#f0f0f0] bg-white px-2">
        <div className={`flex shrink-0 items-center ${LOGO_AREA_CLASS}`}>
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
          <Space
            className="h-full cursor-pointer select-none py-1"
            size={6}
            onClick={() => navigate("/user")}
            role="button"
            aria-label="进入个人信息"
          >
            <UserOutlined />
            <Typography.Text type="secondary">本地账户</Typography.Text>
          </Space>
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
