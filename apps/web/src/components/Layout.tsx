import {
  AppstoreOutlined,
  CloudSyncOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { Button, Layout as AntLayout, Space, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

const { Header, Content } = AntLayout;

function pathToMenuKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "/";
  if (pathname.startsWith("/sites")) return "/sites";
  if (pathname.startsWith("/upload")) return "/upload";
  if (pathname.startsWith("/synced")) return "/synced";
  if (pathname.startsWith("/layering-demo")) return "/layering-demo";
  return "/";
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedKey = pathToMenuKey(location.pathname);

  return (
    <AntLayout className="h-[100vh] bg-[#f5f5f5]">
      <Header className="sticky top-0 z-10 flex h-auto flex-wrap items-center justify-between gap-3 border-b border-[#f0f0f0] bg-white px-4 py-3">
        <Typography.Title level={4} className="!mb-0">
          My Notes
        </Typography.Title>
        <div className="flex flex-wrap gap-1">
          <Button
            type={selectedKey === "/" ? "primary" : "default"}
            icon={<FileTextOutlined />}
            onClick={() => navigate("/")}
          >
            笔记区
          </Button>
          <Button
            type={selectedKey === "/sites" ? "primary" : "default"}
            icon={<GlobalOutlined />}
            onClick={() => navigate("/sites")}
          >
            站点信息区
          </Button>
          <Button
            type={selectedKey === "/synced" ? "primary" : "default"}
            icon={<CloudSyncOutlined />}
            onClick={() => navigate("/synced")}
          >
            已同步
          </Button>
          <Button
            type={selectedKey === "/upload" ? "primary" : "default"}
            icon={<CloudUploadOutlined />}
            onClick={() => navigate("/upload")}
          >
            上传中心
          </Button>
          <Button
            type={selectedKey === "/layering-demo" ? "primary" : "default"}
            icon={<AppstoreOutlined />}
            onClick={() => navigate("/layering-demo")}
          >
            分层范例
          </Button>
        </div>
        <Space wrap>
          {user ? (
            <>
              <Typography.Text type="secondary">{user.email}</Typography.Text>
              <Button onClick={logout}>退出</Button>
            </>
          ) : (
            <Typography.Text type="secondary">未登录 · 可本地记录</Typography.Text>
          )}
        </Space>
      </Header>
      <Content>
        <Outlet />
      </Content>
    </AntLayout>
  );
}
