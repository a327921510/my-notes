import {
  ApiErrorCode,
  type BatchOutcome,
  type DeleteNodesBody,
  type DriveUsage,
  type ListNodesResult,
  type MoveNodesBody,
  NodeKind,
  NodeSortField,
  type OnConflictStrategy,
  type SearchNodesResult,
  SortOrder,
} from "@my-notes/shared";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { ApiError } from "../errors.js";
import { readMultipart, requireFile } from "../multipart.js";
import type { DriveRepository, NodeRow } from "../repository/drive.js";
import {
  assertFileSize,
  assertNotRoot,
  assertQuota,
  assertValidName,
  inferDocKind,
  mapNodeToBrief,
  mapNodeToDto,
  removeNode,
  resolveNamePlacement,
} from "../services/drive-service.js";
import { deleteObject, openObjectStream, writeObject } from "../storage.js";

type IdParam = { id: string };

export type DriveRouteDeps = {
  drive: DriveRepository;
};

function parseSortField(value: string | undefined): NodeSortField {
  const allowed = Object.values(NodeSortField) as string[];
  return allowed.includes(value ?? "") ? (value as NodeSortField) : NodeSortField.NAME;
}

function parseSortOrder(value: string | undefined): SortOrder {
  return value === SortOrder.DESC ? SortOrder.DESC : SortOrder.ASC;
}

function mapNameToContentDisposition(name: string): string {
  const asciiFallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** 传入的 app 必须是已挂鉴权 hook 的作用域（见 index.ts）。 */
export async function registerDriveRoutes(
  app: FastifyInstance,
  { drive }: DriveRouteDeps,
): Promise<void> {
  app.get<{ Querystring: { parentId?: string; sort?: string; order?: string } }>(
    "/api/drive/nodes",
    async (request): Promise<ListNodesResult> => {
      const { userId } = request;
      const parent = drive.requireFolder(userId, request.query.parentId || null);
      const nodes = drive.listChildren(
        userId,
        parent.id,
        parseSortField(request.query.sort),
        parseSortOrder(request.query.order),
      );
      return {
        parent: mapNodeToDto(parent),
        path: drive.getPath(userId, parent).map(mapNodeToBrief),
        nodes: nodes.map(mapNodeToDto),
      };
    },
  );

  app.get<{ Params: IdParam }>("/api/drive/nodes/:id", async (request) => {
    return { node: mapNodeToDto(drive.requireNode(request.userId, request.params.id)) };
  });

  app.get<{ Params: IdParam }>("/api/drive/nodes/:id/path", async (request) => {
    const node = drive.requireNode(request.userId, request.params.id);
    return { path: drive.getPath(request.userId, node).map(mapNodeToBrief) };
  });

  app.get<{ Querystring: { keyword?: string; limit?: string; offset?: string } }>(
    "/api/drive/search",
    async (request): Promise<SearchNodesResult> => {
      const keyword = (request.query.keyword ?? "").trim();
      if (keyword === "") return { items: [], total: 0 };

      const limit = Math.min(Number(request.query.limit) || 50, 200);
      const offset = Math.max(Number(request.query.offset) || 0, 0);
      const { items, total } = drive.search(request.userId, keyword, limit, offset);
      return {
        total,
        items: items.map((node) => ({
          ...mapNodeToDto(node),
          path: drive.getPath(request.userId, node).map(mapNodeToBrief),
        })),
      };
    },
  );

  app.get("/api/drive/usage", async (request): Promise<DriveUsage> => {
    const { usedBytes, fileCount, folderCount } = drive.usage(request.userId);
    return {
      usedBytes,
      fileCount,
      folderCount,
      quotaBytes: config.userQuotaBytes,
      maxFileSizeBytes: config.maxFileSizeBytes,
    };
  });

  app.post<{ Body: { parentId?: string | null; name?: string } }>(
    "/api/drive/folders",
    async (request) => {
      const { userId } = request;
      const parent = drive.requireFolder(userId, request.body?.parentId ?? null);
      const placement = resolveNamePlacement(
        drive,
        userId,
        parent.id,
        request.body?.name ?? "",
        undefined,
      );
      return { node: mapNodeToDto(drive.createFolder(userId, parent.id, placement.name)) };
    },
  );

  app.post("/api/drive/files", async (request) => {
    const { userId } = request;
    const { fields, file: uploaded } = await readMultipart(request);
    const file = requireFile({ fields, file: uploaded });

    assertFileSize(file.buffer.byteLength);
    const parent = drive.requireFolder(userId, fields.parentId || null);
    const placement = resolveNamePlacement(
      drive,
      userId,
      parent.id,
      fields.name || file.filename,
      fields.onConflict as OnConflictStrategy | undefined,
    );
    if (placement.action === "skip") return { node: null, skipped: true };

    const previousSize =
      placement.action === "overwrite" ? placement.existing.sizeBytes : 0;
    assertQuota(drive, userId, file.buffer.byteLength - previousSize);

    const stored = await writeObject(userId, file.buffer);

    if (placement.action === "overwrite") {
      if (placement.existing.kind !== NodeKind.FILE) {
        throw new ApiError(ApiErrorCode.NODE_NAME_CONFLICT, { name: placement.name });
      }
      const oldStorageId = placement.existing.storageId;
      drive.replaceFileContent(placement.existing.id, {
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        storageId: stored.storageId,
        mimeType: file.mimeType,
      });
      if (oldStorageId) await deleteObject(userId, oldStorageId);
      return { node: mapNodeToDto(drive.requireNode(userId, placement.existing.id)), skipped: false };
    }

    const node = drive.createFile(userId, parent.id, {
      name: placement.name,
      mimeType: file.mimeType,
      sizeBytes: stored.sizeBytes,
      checksum: stored.checksum,
      storageId: stored.storageId,
      docKind: inferDocKind(placement.name),
    });
    return { node: mapNodeToDto(node), skipped: false };
  });

  app.patch<{ Params: IdParam; Body: { name?: string } }>(
    "/api/drive/nodes/:id",
    async (request) => {
      const { userId } = request;
      const node = drive.requireNode(userId, request.params.id);
      assertNotRoot(node);

      const name = assertValidName(request.body?.name ?? "");
      resolveNamePlacement(drive, userId, node.parentId!, name, undefined, { excludeId: node.id });

      drive.updatePlacement(node.id, {
        name,
        ...(node.kind === NodeKind.FILE ? { docKind: inferDocKind(name) } : {}),
      });
      return { node: mapNodeToDto(drive.requireNode(userId, node.id)) };
    },
  );

  app.post<{ Body: MoveNodesBody }>("/api/drive/nodes/move", async (request) => {
    const { userId } = request;
    const ids = request.body?.ids ?? [];
    const target = drive.requireFolder(userId, request.body?.targetParentId ?? null);
    const outcome: BatchOutcome = { done: [], skipped: [], failed: [] };

    for (const id of ids) {
      try {
        const node = drive.requireNode(userId, id);
        assertNotRoot(node);
        if (node.id === target.id || drive.isDescendant(userId, target.id, node.id)) {
          throw new ApiError(ApiErrorCode.NODE_MOVE_INTO_SELF);
        }
        if (node.parentId === target.id) {
          outcome.done.push(id);
          continue;
        }

        const placement = resolveNamePlacement(
          drive,
          userId,
          target.id,
          node.name,
          request.body?.onConflict,
        );
        if (placement.action === "skip") {
          outcome.skipped.push(id);
          continue;
        }
        if (placement.action === "overwrite") {
          await removeNode(drive, userId, placement.existing);
        }
        drive.updatePlacement(node.id, { name: placement.name, parentId: target.id });
        outcome.done.push(id);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        outcome.failed.push({
          id,
          code: apiError?.code ?? ApiErrorCode.BAD_REQUEST,
          message: apiError?.message ?? (error as Error).message,
        });
      }
    }

    return outcome;
  });

  app.post<{ Body: DeleteNodesBody }>("/api/drive/nodes/delete", async (request) => {
    const { userId } = request;
    const outcome: BatchOutcome = { done: [], skipped: [], failed: [] };

    for (const id of request.body?.ids ?? []) {
      try {
        const node = drive.requireNode(userId, id);
        assertNotRoot(node);
        await removeNode(drive, userId, node);
        outcome.done.push(id);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        outcome.failed.push({
          id,
          code: apiError?.code ?? ApiErrorCode.BAD_REQUEST,
          message: apiError?.message ?? (error as Error).message,
        });
      }
    }

    return outcome;
  });

  app.get<{ Params: IdParam }>("/api/drive/nodes/:id/download", async (request, reply) => {
    const node: NodeRow = drive.requireNode(request.userId, request.params.id);
    if (node.kind !== NodeKind.FILE || !node.storageId) {
      throw new ApiError(ApiErrorCode.NODE_NOT_FOUND);
    }
    return reply
      .header("Content-Type", node.mimeType ?? "application/octet-stream")
      .header("Content-Length", String(node.sizeBytes))
      .header("Content-Disposition", mapNameToContentDisposition(node.name))
      .send(openObjectStream(request.userId, node.storageId));
  });
}
