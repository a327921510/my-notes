import { Spin } from "antd";
import { Suspense } from "react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  createHashRouter,
} from "react-router-dom";

import { routes } from "./routes";

const routeConfig = [
  ...routes,
  { path: "*", element: <Navigate to="/" replace /> },
];

/** 桌面端构建（`vite build --mode desktop`）走 Hash 路由，兼容 file://。 */
const router =
  import.meta.env.MODE === "desktop"
    ? createHashRouter(routeConfig)
    : createBrowserRouter(routeConfig);

const fallback = (
  <div className="flex h-screen items-center justify-center">
    <Spin size="large" />
  </div>
);

export function AppRouter() {
  return (
    <Suspense fallback={fallback}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
