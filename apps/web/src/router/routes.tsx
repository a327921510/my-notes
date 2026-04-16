import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const SitesPage = lazy(() => import("@/pages/SitesPage"));
const CloudDrivePage = lazy(() => import("@/pages/CloudDrivePage"));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <NotesPage /> },
      { path: "sites", element: <SitesPage /> },
      { path: "cloud-drive", element: <CloudDrivePage /> },
    ],
  },
];
