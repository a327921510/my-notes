/**
 * 对比本地与导入 payload，产出新增 / 冲突 / 仅本地 / 未变更。
 */
import { normalizeNewlines } from "@my-notes/shared";

import { listLocalFsFilesWithPaths } from "./exportPayload";
import type {
  FsBackupPayload,
  FsImportConflict,
  FsImportLocalOnly,
  FsImportPlan,
  FsImportToCreate,
} from "./types";

export async function classifyFsImport(payload: FsBackupPayload): Promise<FsImportPlan> {
  const { files: localFiles } = await listLocalFsFilesWithPaths();
  const localByPath = new Map(localFiles.map((f) => [f.path, f]));
  const incomingByPath = new Map(payload.files.map((f) => [f.path, f]));

  const toCreate: FsImportToCreate[] = [];
  const conflicts: FsImportConflict[] = [];
  let unchangedCount = 0;

  for (const [path, incoming] of incomingByPath) {
    const local = localByPath.get(path);
    if (!local) {
      toCreate.push({
        path,
        kind: incoming.kind,
        contentText: incoming.contentText,
      });
      continue;
    }
    const sameKind = local.kind === incoming.kind;
    const sameContent =
      normalizeNewlines(local.contentText) === normalizeNewlines(incoming.contentText);
    if (sameKind && sameContent) {
      unchangedCount += 1;
      continue;
    }
    conflicts.push({
      path,
      kind: incoming.kind,
      localFileId: local.id,
      localContent: local.contentText,
      incomingContent: incoming.contentText,
    });
  }

  const localOnly: FsImportLocalOnly[] = [];
  for (const local of localFiles) {
    if (!incomingByPath.has(local.path)) {
      localOnly.push({
        path: local.path,
        fileId: local.id,
        kind: local.kind,
      });
    }
  }

  toCreate.sort((a, b) => a.path.localeCompare(b.path, "en"));
  conflicts.sort((a, b) => a.path.localeCompare(b.path, "en"));
  localOnly.sort((a, b) => a.path.localeCompare(b.path, "en"));

  return { toCreate, conflicts, localOnly, unchangedCount };
}
