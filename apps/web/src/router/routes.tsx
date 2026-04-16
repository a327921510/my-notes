import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const SitesPage = lazy(() => import("@/pages/SitesPage"));
const SyncedFilesPage = lazy(() => import("@/pages/SyncedFilesPage"));
const UploadPage = lazy(() => import("@/pages/UploadPage"));
const CloudDrivePage = lazy(() => import("@/pages/CloudDrivePage"));
const PageLayeringDemo = lazy(() => import("@/pages/PageLayeringDemo"));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <NotesPage /> },
      { path: "sites", element: <SitesPage /> },
      { path: "synced", element: <SyncedFilesPage /> },
      { path: "upload", element: <UploadPage /> },
      { path: "cloud-drive", element: <CloudDrivePage /> },
      { path: "layering-demo", element: <PageLayeringDemo /> },
    ],
  },
];
