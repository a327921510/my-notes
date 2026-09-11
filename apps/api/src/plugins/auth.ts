import { ApiErrorCode } from "@my-notes/shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import { ApiError } from "../errors.js";
import type { UserRepository } from "../repository/users.js";

export type SessionPayload = {
  sub: string;
  email: string;
  /** 与库中 passwordVersion 不一致即拒绝，实现改密码后旧会话失效 */
  pv: number;
};

declare module "fastify" {
  interface FastifyRequest {
    /** 仅在通过 requireAuth 的路由上可用 */
    userId: string;
    userEmail: string;
  }
}

/**
 * 鉴权守卫：userId 只从 token 解析，绝不接受请求体或查询参数传入。
 */
export function createRequireAuth(users: UserRepository) {
  return async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const payload = await request.jwtVerify<SessionPayload>();
    const user = users.findById(payload.sub);
    if (!user || user.passwordVersion !== payload.pv) {
      throw new ApiError(ApiErrorCode.AUTH_TOKEN_EXPIRED);
    }
    request.userId = user.id;
    request.userEmail = user.email;
  };
}
