import { Spin } from "antd";
import { Suspense } from "react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { routes } from "./routes";

const router = createBrowserRouter([
  ...routes,
  { path: "*", element: <Navigate to="/" replace /> },
]);

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
