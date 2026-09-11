import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/useAuthStore";

/** 无有效会话时跳登录页，并把来源路由带过去以便登录后原路返回。 */
export function RequireAuth() {
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

export default RequireAuth;
