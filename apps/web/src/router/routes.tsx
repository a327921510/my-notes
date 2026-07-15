import { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const FileManagerPage = lazy(() => import("@/pages/FileManagerPage"));
const UserInfoPage = lazy(() => import("@/pages/UserInfoPage"));
const FsImportConfirmPage = lazy(() => import("@/pages/FsImportConfirmPage"));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/files" replace /> },
      { path: "files", element: <FileManagerPage /> },
      { path: "user", element: <UserInfoPage /> },
      { path: "user/import-confirm", element: <FsImportConfirmPage /> },
    ],
  },
];
