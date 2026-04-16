import { Breadcrumb, Button, Space } from "antd";
import { memo } from "react";

import type { NoteRecord } from "@my-notes/shared";
import { SyncBadge } from "@/components/SyncBadge";

export type BreadcrumbBarProps = {
  selectedFolder: { name?: string } | undefined;
  selectedNote: NoteRecord;
  onGoToSyncedFiles: () => void;
  onDeleteNote: () => void;
};

export const BreadcrumbBar = memo(function BreadcrumbBar({
  selectedFolder,
  selectedNote,
  onGoToSyncedFiles,
  onDeleteNote,
}: BreadcrumbBarProps) {
  return (
    <Space className="w-full justify-between" wrap>
      <Breadcrumb
        items={[
          { title: "笔记" },
          { title: selectedFolder?.name ?? "未分类" },
          { title: selectedNote.title || "无标题" },
        ]}
      />
      <Space>
        <Button size="small" onClick={onGoToSyncedFiles}>
          云端文件列表
        </Button>
        <SyncBadge status={selectedNote.syncStatus} />
        <Button danger size="small" onClick={onDeleteNote}>
          删除
        </Button>
      </Space>
    </Space>
  );
});
