import { ApiErrorCode } from "@my-notes/shared";
import type { FastifyRequest } from "fastify";

import { ApiError } from "./errors.js";

export type MultipartFile = {
  filename: string;
  mimeType: string | null;
  buffer: Buffer;
};

export type MultipartPayload = {
  fields: Record<string, string>;
  file: MultipartFile | null;
};

/**
 * 逐 part 读取，不依赖字段与文件在表单中的先后顺序。
 * 只取第一个文件 part，其余文本 part 收进 fields。
 */
export async function readMultipart(request: FastifyRequest): Promise<MultipartPayload> {
  const fields: Record<string, string> = {};
  let file: MultipartFile | null = null;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (!file) {
        file = {
          filename: part.filename,
          mimeType: part.mimetype || null,
          buffer,
        };
      }
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }

  return { fields, file };
}

export function requireFile(payload: MultipartPayload): MultipartFile {
  if (!payload.file) throw new ApiError(ApiErrorCode.BAD_REQUEST, undefined, "缺少上传文件");
  return payload.file;
}
