import { API_ERROR_MESSAGES, ApiErrorCode } from "@my-notes/shared";
import type { FastifyInstance } from "fastify";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  [ApiErrorCode.AUTH_EMAIL_TAKEN]: 409,
  [ApiErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ApiErrorCode.AUTH_TOKEN_EXPIRED]: 401,
  [ApiErrorCode.AUTH_PASSWORD_TOO_SHORT]: 400,
  [ApiErrorCode.NODE_NOT_FOUND]: 404,
  [ApiErrorCode.NODE_NAME_INVALID]: 400,
  [ApiErrorCode.NODE_NAME_CONFLICT]: 409,
  [ApiErrorCode.NODE_MOVE_INTO_SELF]: 400,
  [ApiErrorCode.NODE_ROOT_IMMUTABLE]: 400,
  [ApiErrorCode.NODE_NOT_FOLDER]: 400,
  [ApiErrorCode.FILE_TOO_LARGE]: 413,
  [ApiErrorCode.QUOTA_EXCEEDED]: 507,
  [ApiErrorCode.DOC_NOT_MMD]: 400,
  [ApiErrorCode.DOC_STALE]: 409,
  [ApiErrorCode.ARCHIVE_INVALID]: 400,
  [ApiErrorCode.BAD_REQUEST]: 400,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, details?: unknown, message?: string) {
    super(message ?? API_ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply
        .status(error.status)
        .send({ code: error.code, message: error.message, details: error.details });
    }

    // @fastify/jwt 与 multipart 的内置错误
    const raw = error as { code?: string; statusCode?: number };
    if (raw.code?.startsWith("FST_JWT_")) {
      return reply.status(401).send({
        code: ApiErrorCode.AUTH_TOKEN_EXPIRED,
        message: API_ERROR_MESSAGES[ApiErrorCode.AUTH_TOKEN_EXPIRED],
      });
    }
    if (raw.code === "FST_REQ_FILE_TOO_LARGE") {
      return reply.status(413).send({
        code: ApiErrorCode.FILE_TOO_LARGE,
        message: API_ERROR_MESSAGES[ApiErrorCode.FILE_TOO_LARGE],
      });
    }

    request.log.error({ err: error }, "unhandled error");
    const status = raw.statusCode && raw.statusCode >= 400 ? raw.statusCode : 500;
    const message = status >= 500 ? "服务异常，请稍后重试" : (error as Error).message;
    return reply.status(status).send({ code: ApiErrorCode.BAD_REQUEST, message });
  });
}
