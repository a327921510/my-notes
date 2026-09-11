import {
  ApiErrorCode,
  NodeKind,
  NodeSortField,
  SortOrder,
  mapNodeNameToKey,
} from "@my-notes/shared";
import { and, eq, isNull, like, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { DrizzleDB } from "../db/client.js";
import { driveNodes } from "../db/schema.js";
import { ApiError } from "../errors.js";

export type NodeRow = typeof driveNodes.$inferSelect;

export const ROOT_NAME = "我的云盘";

type CreateFileInput = {
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  checksum: string;
  storageId: string;
  docKind: "mmd" | null;
};

function byParent(userId: string, parentId: string | null) {
  return and(
    eq(driveNodes.userId, userId),
    parentId === null ? isNull(driveNodes.parentId) : eq(driveNodes.parentId, parentId),
  );
}

function compareNodes(a: NodeRow, b: NodeRow, field: NodeSortField, order: SortOrder): number {
  if (a.kind !== b.kind) return a.kind === NodeKind.FOLDER ? -1 : 1;

  let result: number;
  if (field === NodeSortField.SIZE) result = a.sizeBytes - b.sizeBytes;
  else if (field === NodeSortField.UPDATED_AT) result = a.updatedAt - b.updatedAt;
  else result = a.name.localeCompare(b.name, "zh-Hans-CN");

  if (result === 0) result = a.name.localeCompare(b.name, "zh-Hans-CN");
  return order === SortOrder.DESC ? -result : result;
}

export function createDriveRepository(db: DrizzleDB) {
  const repo = {
    /** 注册时调用；每个账号有且仅有一个根节点。 */
    ensureRoot(userId: string): NodeRow {
      const existing = db.select().from(driveNodes).where(byParent(userId, null)).get();
      if (existing) return existing;

      const now = Date.now();
      const row: NodeRow = {
        id: randomUUID(),
        userId,
        parentId: null,
        kind: NodeKind.FOLDER,
        name: ROOT_NAME,
        nameKey: mapNodeNameToKey(ROOT_NAME),
        mimeType: null,
        sizeBytes: 0,
        checksum: null,
        storageId: null,
        docKind: null,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(driveNodes).values(row).run();
      return row;
    },

    getNode(userId: string, id: string): NodeRow | undefined {
      return db
        .select()
        .from(driveNodes)
        .where(and(eq(driveNodes.userId, userId), eq(driveNodes.id, id)))
        .get();
    },

    /** 越权与不存在都返回 NODE_NOT_FOUND，避免探测他人节点。 */
    requireNode(userId: string, id: string): NodeRow {
      const node = repo.getNode(userId, id);
      if (!node) throw new ApiError(ApiErrorCode.NODE_NOT_FOUND);
      return node;
    },

    /** parentId 为空时回落到根目录。 */
    requireFolder(userId: string, parentId: string | null | undefined): NodeRow {
      if (parentId === null || parentId === undefined) return repo.ensureRoot(userId);
      const node = repo.requireNode(userId, parentId);
      if (node.kind !== NodeKind.FOLDER) throw new ApiError(ApiErrorCode.NODE_NOT_FOLDER);
      return node;
    },

    listChildren(
      userId: string,
      parentId: string,
      field: NodeSortField = NodeSortField.NAME,
      order: SortOrder = SortOrder.ASC,
    ): NodeRow[] {
      const rows = db.select().from(driveNodes).where(byParent(userId, parentId)).all();
      return rows.sort((a, b) => compareNodes(a, b, field, order));
    },

    /** 根 → 自身。 */
    getPath(userId: string, node: NodeRow): NodeRow[] {
      const path: NodeRow[] = [node];
      let current = node;
      while (current.parentId) {
        const parent = repo.getNode(userId, current.parentId);
        if (!parent) break;
        path.unshift(parent);
        current = parent;
      }
      return path;
    },

    findChild(userId: string, parentId: string, nameKey: string): NodeRow | undefined {
      return db
        .select()
        .from(driveNodes)
        .where(and(byParent(userId, parentId), eq(driveNodes.nameKey, nameKey)))
        .get();
    },

    /** 同级已占用的比较键，用于「保留副本」时生成不重名的名字。 */
    takenNameKeys(userId: string, parentId: string): Set<string> {
      const rows = db
        .select({ nameKey: driveNodes.nameKey })
        .from(driveNodes)
        .where(byParent(userId, parentId))
        .all();
      return new Set(rows.map((r) => r.nameKey));
    },

    createFolder(userId: string, parentId: string, name: string): NodeRow {
      const now = Date.now();
      const row: NodeRow = {
        id: randomUUID(),
        userId,
        parentId,
        kind: NodeKind.FOLDER,
        name,
        nameKey: mapNodeNameToKey(name),
        mimeType: null,
        sizeBytes: 0,
        checksum: null,
        storageId: null,
        docKind: null,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(driveNodes).values(row).run();
      return row;
    },

    createFile(userId: string, parentId: string, input: CreateFileInput): NodeRow {
      const now = Date.now();
      const row: NodeRow = {
        id: randomUUID(),
        userId,
        parentId,
        kind: NodeKind.FILE,
        name: input.name,
        nameKey: mapNodeNameToKey(input.name),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        storageId: input.storageId,
        docKind: input.docKind,
        createdAt: now,
        updatedAt: now,
      };
      db.insert(driveNodes).values(row).run();
      return row;
    },

    /** 覆盖写：节点 id 不变，只换内容与元数据。 */
    replaceFileContent(
      id: string,
      input: { sizeBytes: number; checksum: string; storageId: string; mimeType?: string | null },
    ): void {
      db.update(driveNodes)
        .set({
          sizeBytes: input.sizeBytes,
          checksum: input.checksum,
          storageId: input.storageId,
          ...(input.mimeType === undefined ? {} : { mimeType: input.mimeType }),
          updatedAt: Date.now(),
        })
        .where(eq(driveNodes.id, id))
        .run();
    },

    updatePlacement(id: string, input: { name?: string; parentId?: string; docKind?: "mmd" | null }): void {
      db.update(driveNodes)
        .set({
          ...(input.name === undefined ? {} : { name: input.name, nameKey: mapNodeNameToKey(input.name) }),
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
          ...(input.docKind === undefined ? {} : { docKind: input.docKind }),
          updatedAt: Date.now(),
        })
        .where(eq(driveNodes.id, id))
        .run();
    },

    /** 含自身的整棵子树，广度优先。 */
    collectSubtree(userId: string, root: NodeRow): NodeRow[] {
      const result: NodeRow[] = [root];
      const queue: NodeRow[] = [root];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.kind !== NodeKind.FOLDER) continue;
        const children = db.select().from(driveNodes).where(byParent(userId, current.id)).all();
        result.push(...children);
        queue.push(...children.filter((c) => c.kind === NodeKind.FOLDER));
      }
      return result;
    },

    /** 返回被释放的 storageId，交由调用方删盘。 */
    deleteSubtree(userId: string, root: NodeRow): string[] {
      const subtree = repo.collectSubtree(userId, root);
      const storageIds = subtree
        .map((node) => node.storageId)
        .filter((id): id is string => id !== null);
      // 自下而上删除，避免外键约束顺序问题
      for (const node of [...subtree].reverse()) {
        db.delete(driveNodes).where(eq(driveNodes.id, node.id)).run();
      }
      return storageIds;
    },

    isDescendant(userId: string, candidateId: string, ancestorId: string): boolean {
      let current = repo.getNode(userId, candidateId);
      while (current?.parentId) {
        if (current.parentId === ancestorId) return true;
        current = repo.getNode(userId, current.parentId);
      }
      return false;
    },

    search(userId: string, keyword: string, limit: number, offset: number) {
      const pattern = `%${mapNodeNameToKey(keyword)}%`;
      const condition = and(
        eq(driveNodes.userId, userId),
        like(driveNodes.nameKey, pattern),
        sql`${driveNodes.parentId} IS NOT NULL`,
      );
      const total =
        db.select({ value: sql<number>`count(*)` }).from(driveNodes).where(condition).get()?.value ?? 0;
      const items = db
        .select()
        .from(driveNodes)
        .where(condition)
        .orderBy(driveNodes.kind, driveNodes.name)
        .limit(limit)
        .offset(offset)
        .all();
      return { items, total };
    },

    usage(userId: string): { usedBytes: number; fileCount: number; folderCount: number } {
      const row = db
        .select({
          usedBytes: sql<number>`coalesce(sum(case when ${driveNodes.kind} = 'file' then ${driveNodes.sizeBytes} else 0 end), 0)`,
          fileCount: sql<number>`sum(case when ${driveNodes.kind} = 'file' then 1 else 0 end)`,
          folderCount: sql<number>`sum(case when ${driveNodes.kind} = 'folder' and ${driveNodes.parentId} is not null then 1 else 0 end)`,
        })
        .from(driveNodes)
        .where(eq(driveNodes.userId, userId))
        .get();
      return {
        usedBytes: row?.usedBytes ?? 0,
        fileCount: row?.fileCount ?? 0,
        folderCount: row?.folderCount ?? 0,
      };
    },
  };

  return repo;
}

export type DriveRepository = ReturnType<typeof createDriveRepository>;
