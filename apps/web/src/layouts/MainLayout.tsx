import { CloudOutlined, DownOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { formatBytes } from "@my-notes/shared";
import { App, Button, Dropdown, Input, Layout, Progress, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";

import { useDriveUsage } from "@/hooks/useDriveUsage";
import { useAuthStore } from "@/stores/useAuthStore";
import { useUsageStore } from "@/stores/useUsageStore";

export function MainLayout() {
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const clearUsage = useUsageStore((s) => s.clear);
  const { usage } = useDriveUsage(true);

  const [keyword, setKeyword] = useState(searchParams.get("keyword") ?? "");

  // 从搜索结果跳走或清空 URL 参数时，输入框要跟着回到实际状态
  useEffect(() => {
    setKeyword(searchParams.get("keyword") ?? "");
  }, [searchParams]);

  const handleSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      navigate(trimmed === "" ? "/drive" : `/drive?keyword=${encodeURIComponent(trimmed)}`);
    },
    [navigate],
  );

  const handleLogout = useCallback(() => {
    modal.confirm({
      title: "确认退出登录？",
      content: "退出后将清除本机保存的会话与缓存。",
      okText: "退出",
      cancelText: "取消",
      onOk: () => {
        clearUsage();
        logout();
        navigate("/login", { replace: true });
      },
    });
  }, [clearUsage, logout, modal, navigate]);

  const menuItems = useMemo<MenuProps["items"]>(
    () => [
      { key: "account", icon: <UserOutlined />, label: "账号信息" },
      { type: "divider" },
      { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true },
    ],
    [],
  );

  const handleMenuClick = useCallback<NonNullable<MenuProps["onClick"]>>(
    ({ key }) => {
      if (key === "account") navigate("/account");
      if (key === "logout") handleLogout();
    },
    [handleLogout, navigate],
  );

  const usagePercent = usage && usage.quotaBytes > 0
    ? Math.min(100, Math.round((usage.usedBytes / usage.quotaBytes) * 100))
    : 0;

  return (
    <Layout className="h-screen">
      <Layout.Header className="flex items-center gap-4 !bg-white px-4 shadow-sm">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0"
          onClick={() => navigate("/drive")}
        >
          <CloudOutlined className="text-xl text-[#1677ff]" />
          <span className="text-base font-semibold text-[#262626]">My Drive</span>
        </button>

        <Input.Search
          allowClear
          className="max-w-[420px]"
          data-testid="drive.searchNodes"
          placeholder="搜索文件夹和文件名称"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={handleSearch}
        />

        <div className="ml-auto flex items-center gap-4">
          {usage ? (
            <Tooltip
              title={`已用 ${formatBytes(usage.usedBytes)} / 共 ${formatBytes(usage.quotaBytes)}`}
            >
              <div className="hidden w-[160px] md:block">
                <Progress
                  percent={usagePercent}
                  size="small"
                  status={usagePercent >= 100 ? "exception" : "normal"}
                  format={() => `${formatBytes(usage.usedBytes)}`}
                />
              </div>
            </Tooltip>
          ) : null}

          <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={["click"]}>
            <Button type="text">
              <UserOutlined />
              <span className="max-w-[180px] truncate">{user?.email ?? "未登录"}</span>
              <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </Layout.Header>

      <Layout.Content className="min-h-0 overflow-hidden bg-[#f5f6f8] p-3">
        <Outlet />
      </Layout.Content>
    </Layout>
  );
}

export default MainLayout;
