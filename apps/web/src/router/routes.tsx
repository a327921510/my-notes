import { lazy } from "react";
import type { RouteObject } from "react-router-dom";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const SitesPage = lazy(() => import("@/pages/SitesPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const CloudDrivePage = lazy(() => import("@/pages/CloudDrivePage"));
const UserInfoPage = lazy(() => import("@/pages/UserInfoPage"));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <NotesPage /> },
      { path: "sites", element: <SitesPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "cloud-drive", element: <CloudDrivePage /> },
      { path: "user", element: <UserInfoPage /> },
    ],
  },
];
