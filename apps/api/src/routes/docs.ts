import {
  ApiErrorCode,
  type DocContent,
  NodeKind,
  isMmdName,
  mapNameToMmdName,
} from "@my-notes/shared";
import type { FastifyInstance } from "fastify";

import { ApiError } from "../errors.js";
import type { DriveRepository, NodeRow } from "../repository/drive.js";
import {
  assertQuota,
  mapNodeToDto,
  resolveNamePlacement,
} from "../services/drive-service.js";
import { deleteObject, readObject, writeObject } from "../storage.js";

const MMD_MIME = "text/markdown";

export type DocRouteDeps = {
  drive: DriveRepository;
};

function requireMmdNode(drive: DriveRepository, userId: string, id: string): NodeRow {
  const node = drive.requireNode(userId, id);
  if (node.kind !== NodeKind.FILE || node.docKind !== "mmd") {
    throw new ApiError(ApiErrorCode.DOC_NOT_MMD);
  }
  return node;
}

/** 传入的 app 必须是已挂鉴权 hook 的作用域（见 index.ts）。 */
export async function registerDocRoutes(
  app: FastifyInstance,
  { drive }: DocRouteDeps,
): Promise<void> {
  app.post<{ Body: { parentId?: string | null; name?: string; content?: string } }>(
    "/api/docs",
    async (request) => {
      const { userId } = request;
      const parent = drive.requireFolder(userId, request.body?.parentId ?? null);
      const placement = resolveNamePlacement(
        drive,
        userId,
        parent.id,
        mapNameToMmdName(request.body?.name ?? ""),
        undefined,
      );

      const content = request.body?.content ?? "";
      const buffer = Buffer.from(content, "utf8");
      assertQuota(drive, userId, buffer.byteLength);

      const stored = await writeObject(userId, buffer);
      const node = drive.createFile(userId, parent.id, {
        name: placement.name,
        mimeType: MMD_MIME,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        storageId: stored.storageId,
        docKind: "mmd",
      });
      return { node: mapNodeToDto(node) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/docs/:id", async (request): Promise<DocContent> => {
    const node = requireMmdNode(drive, request.userId, request.params.id);
    const buffer = node.storageId ? await readObject(request.userId, node.storageId) : Buffer.alloc(0);
    return { node: mapNodeToDto(node), content: buffer.toString("utf8") };
  });

  app.put<{ Params: { id: string }; Body: { content?: string; baseUpdatedAt?: number } }>(
    "/api/docs/:id",
    async (request) => {
      const { userId } = request;
      const node = requireMmdNode(drive, userId, request.params.id);

      const { baseUpdatedAt } = request.body ?? {};
      // 基版本过期不静默覆盖，交由客户端进入差异对比
      if (typeof baseUpdatedAt === "number" && baseUpdatedAt !== node.updatedAt) {
        throw new ApiError(ApiErrorCode.DOC_STALE, { serverUpdatedAt: node.updatedAt });
      }

      const buffer = Buffer.from(request.body?.content ?? "", "utf8");
      assertQuota(drive, userId, buffer.byteLength - node.sizeBytes);

      const stored = await writeObject(userId, buffer);
      drive.replaceFileContent(node.id, {
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        storageId: stored.storageId,
        mimeType: MMD_MIME,
      });
      if (node.storageId) await deleteObject(userId, node.storageId);

      return { node: mapNodeToDto(drive.requireNode(userId, node.id)) };
    },
  );

  app.get<{ Params: { id: string } }>("/api/docs/:id/can-open", async (request) => {
    const node = drive.requireNode(request.userId, request.params.id);
    return { canOpen: node.kind === NodeKind.FILE && isMmdName(node.name) };
  });
}
