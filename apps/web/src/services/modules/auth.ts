import { request } from "../request";

import type { AuthUser } from "@/stores/useAuthStore";

type LoginParams = {
  email: string;
  password: string;
};

type LoginResult = {
  token: string;
  user: AuthUser;
};

export const authApi = {
  login: (data: LoginParams) =>
    request.post<LoginResult>("/auth/login", data),
};
