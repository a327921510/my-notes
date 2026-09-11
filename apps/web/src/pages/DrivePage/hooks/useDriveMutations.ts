import {
  ApiErrorCode,
  type BatchOutcome,
  type DriveNode,
  NodeKind,
  type OnConflictStrategy,
  checkNodeName,
  NODE_NAME_ERROR_MESSAGES,
} from "@my-notes/shared";
import { App } from "antd";
import { useCallback, useState } from "react";

import { confirmAsync } from "@/lib/confirm";

import { docApi } from "@/services/modules/doc";
import { driveApi } from "@/services/modules/drive";

export type DeleteTarget = {
  folderCount: number;
  fileCount: number;
};

function summarizeOutcome(outcome: BatchOutcome): string {
  const parts = [`成功 ${outcome.done.length}`];
  if (outcome.skipped.length > 0) parts.push(`跳过 ${outcome.skipped.length}`);
  if (outcome.failed.length > 0) parts.push(`失败 ${outcome.failed.length}`);
  return parts.join("，");
}

/** 目录与文件的新建、重命名、删除、移动（含批量）。 */
export function useDriveMutations(onChanged: () => void | Promise<void>) {
  const { message, modal } = App.useApp();
  const [pending, setPending] = useState(false);

  const validateName = useCallback(
    (name: string): boolean => {
      const error = checkNodeName(name);
      if (error) {
        message.error(NODE_NAME_ERROR_MESSAGES[error]);
        return false;
      }
      return true;
    },
    [message],
  );

  const createFolder = useCallback(
    async (parentId: string, name: string): Promise<DriveNode | null> => {
      if (!validateName(name)) return null;
      setPending(true);
      try {
        const { node } = await driveApi.createFolder(parentId, name);
        await onChanged();
        return node;
      } catch (error) {
        message.error((error as Error).message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [message, onChanged, validateName],
  );

  const createDoc = useCallback(
    async (parentId: string, name: string): Promise<DriveNode | null> => {
      if (!validateName(name)) return null;
      setPending(true);
      try {
        const { node } = await docApi.create({ parentId, name });
        await onChanged();
        return node;
      } catch (error) {
        message.error((error as Error).message);
        return null;
      } finally {
        setPending(false);
      }
    },
    [message, onChanged, validateName],
  );

  const rename = useCallback(
    async (node: DriveNode, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (trimmed === node.name) return true;
      if (!validateName(trimmed)) return false;

      // 改掉 / 改到 .mmd 后缀会改变可打开性，先确认
      const wasDoc = node.docKind === "mmd";
      const willBeDoc = trimmed.toLowerCase().endsWith(".mmd");
      if (node.kind === NodeKind.FILE && wasDoc && !willBeDoc) {
        const confirmed = await confirmAsync(modal, {
          title: "改掉 .mmd 后缀？",
          content: `「${node.name}」将降级为普通文件，不再能在系统内打开与编辑。`,
          okText: "确认修改",
          cancelText: "取消",
        });
        if (!confirmed) return false;
      }

      setPending(true);
      try {
        await driveApi.rename(node.id, trimmed);
        await onChanged();
        return true;
      } catch (error) {
        message.error((error as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [message, modal, onChanged, validateName],
  );

  const remove = useCallback(
    async (nodes: DriveNode[]): Promise<boolean> => {
      if (nodes.length === 0) return false;
      const folders = nodes.filter((node) => node.kind === NodeKind.FOLDER);
      const files = nodes.filter((node) => node.kind === NodeKind.FILE);

      const scope = [
        folders.length > 0 ? `${folders.length} 个文件夹` : "",
        files.length > 0 ? `${files.length} 个文件` : "",
      ]
        .filter(Boolean)
        .join("、");

      const confirmed = await confirmAsync(modal, {
        title: "确认删除？",
        okText: "删除",
        okButtonProps: { danger: true },
        cancelText: "取消",
        content:
          `将删除 ${scope}。` +
          (folders.length > 0 ? "文件夹会连同其中的全部子目录与文件一并递归删除。" : "") +
          "删除后不可恢复。",
      });
      if (!confirmed) return false;

      setPending(true);
      try {
        const outcome = await driveApi.remove(nodes.map((node) => node.id));
        await onChanged();
        if (outcome.failed.length > 0) {
          message.warning(`删除完成：${summarizeOutcome(outcome)}。${outcome.failed[0].message}`);
        } else {
          message.success(`已删除 ${outcome.done.length} 项`);
        }
        return true;
      } catch (error) {
        message.error((error as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [message, modal, onChanged],
  );

  const move = useCallback(
    async (ids: string[], targetParentId: string, onConflict?: OnConflictStrategy): Promise<boolean> => {
      if (ids.length === 0) return false;
      setPending(true);
      try {
        const outcome = await driveApi.move(ids, targetParentId, onConflict);
        await onChanged();

        const conflicted = outcome.failed.find((item) => item.code === ApiErrorCode.NODE_NAME_CONFLICT);
        if (conflicted) {
          message.warning(`移动完成：${summarizeOutcome(outcome)}。目标目录存在同名项，可改用「保留副本」重试。`);
        } else if (outcome.failed.length > 0) {
          message.warning(`移动完成：${summarizeOutcome(outcome)}。${outcome.failed[0].message}`);
        } else {
          message.success(`已移动 ${outcome.done.length} 项`);
        }
        return outcome.failed.length === 0;
      } catch (error) {
        message.error((error as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [message, onChanged],
  );

  return { pending, createFolder, createDoc, rename, remove, move };
}
