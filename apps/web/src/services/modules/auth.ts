import type { AuthResult, AuthUser } from "@my-notes/shared";

import { get, post } from "../request";

export type CredentialsPayload = {
  email: string;
  password: string;
};

export type PasswordChangePayload = {
  currentPassword: string;
  newPassword: string;
};

export const authApi = {
  register: (data: CredentialsPayload) => post<AuthResult>("/auth/register", data),
  login: (data: CredentialsPayload) => post<AuthResult>("/auth/login", data),
  me: () => get<{ user: AuthUser }>("/auth/me"),
  changePassword: (data: PasswordChangePayload) => post<void>("/auth/password", data),
};
