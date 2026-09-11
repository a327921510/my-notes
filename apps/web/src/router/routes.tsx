import { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

import { RequireAuth } from "./RequireAuth";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DrivePage = lazy(() => import("@/pages/DrivePage"));
const DocPage = lazy(() => import("@/pages/DocPage"));
const AccountPage = lazy(() => import("@/pages/AccountPage"));

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/drive" replace /> },
          { path: "drive", element: <DrivePage /> },
          { path: "drive/doc/:nodeId", element: <DocPage /> },
          { path: "account", element: <AccountPage /> },
        ],
      },
    ],
  },
];
