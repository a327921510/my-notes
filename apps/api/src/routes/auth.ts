import { ApiErrorCode, type AuthResult, type AuthUser } from "@my-notes/shared";
import type { FastifyInstance } from "fastify";

import {
  MIN_PASSWORD_LENGTH,
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "../auth/credentials.js";
import { config } from "../config.js";
import { ApiError } from "../errors.js";
import type { SessionPayload } from "../plugins/auth.js";
import type { DriveRepository } from "../repository/drive.js";
import type { UserRepository, UserRow } from "../repository/users.js";

type Credentials = { email?: string; password?: string };
type PasswordChange = { currentPassword?: string; newPassword?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapUserToDto(user: UserRow): AuthUser {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

export async function registerPublicAuthRoutes(
  app: FastifyInstance,
  { users, drive }: { users: UserRepository; drive: DriveRepository },
): Promise<void> {
  const signToken = (user: UserRow): string => {
    const payload: SessionPayload = { sub: user.id, email: user.email, pv: user.passwordVersion };
    return app.jwt.sign(payload, { expiresIn: config.jwtExpiresIn });
  };

  app.post<{ Body: Credentials }>("/api/auth/register", async (request): Promise<AuthResult> => {
    const email = (request.body?.email ?? "").trim();
    const password = request.body?.password ?? "";

    if (!EMAIL_PATTERN.test(email)) {
      throw new ApiError(ApiErrorCode.BAD_REQUEST, undefined, "请输入有效的邮箱地址");
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(ApiErrorCode.AUTH_PASSWORD_TOO_SHORT);
    }

    const emailNormalized = normalizeEmail(email);
    if (users.findByEmailNormalized(emailNormalized)) {
      throw new ApiError(ApiErrorCode.AUTH_EMAIL_TAKEN);
    }

    const user = users.create({ email, emailNormalized, passwordHash: hashPassword(password) });
    drive.ensureRoot(user.id);
    return { token: signToken(user), user: mapUserToDto(user) };
  });

  app.post<{ Body: Credentials }>("/api/auth/login", async (request): Promise<AuthResult> => {
    const email = (request.body?.email ?? "").trim();
    const password = request.body?.password ?? "";

    const user = users.findByEmailNormalized(normalizeEmail(email));
    // 不区分邮箱不存在与密码错误，避免泄露邮箱是否已注册
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(ApiErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    drive.ensureRoot(user.id);
    return { token: signToken(user), user: mapUserToDto(user) };
  });
}

/** 传入的 app 必须是已挂鉴权 hook 的作用域（见 index.ts）。 */
export async function registerProtectedAuthRoutes(
  app: FastifyInstance,
  { users }: { users: UserRepository },
): Promise<void> {
  app.get("/api/auth/me", async (request): Promise<{ user: AuthUser }> => {
    const user = users.findById(request.userId);
    if (!user) throw new ApiError(ApiErrorCode.AUTH_TOKEN_EXPIRED);
    return { user: mapUserToDto(user) };
  });

  app.post<{ Body: PasswordChange }>("/api/auth/password", async (request, reply) => {
    const currentPassword = request.body?.currentPassword ?? "";
    const newPassword = request.body?.newPassword ?? "";

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ApiError(ApiErrorCode.AUTH_PASSWORD_TOO_SHORT);
    }
    const user = users.findById(request.userId);
    if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new ApiError(ApiErrorCode.AUTH_INVALID_CREDENTIALS, undefined, "当前密码不正确");
    }

    // 自增 passwordVersion 让旧 token 失效
    users.updatePassword(user.id, hashPassword(newPassword), user.passwordVersion + 1);
    return reply.status(204).send();
  });
}
