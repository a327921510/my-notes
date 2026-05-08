import { lazy } from "react";
import { Navigate } from "react-router-dom";
import type { RouteObject } from "react-router-dom";

const MainLayout = lazy(() => import("@/layouts/MainLayout"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const SitesPage = lazy(() => import("@/pages/SitesPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const ProjectMarkdownPage = lazy(() => import("@/pages/ProjectMarkdownPage"));
const CloudDrivePage = lazy(() => import("@/pages/CloudDrivePage"));
const UserInfoPage = lazy(() => import("@/pages/UserInfoPage"));

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/notes" replace /> },
      { path: "notes", element: <NotesPage /> },
      { path: "sites", element: <SitesPage /> },
      { path: "project-markdown", element: <ProjectMarkdownPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "cloud-drive", element: <CloudDrivePage /> },
      { path: "user", element: <UserInfoPage /> },
    ],
  },
];
