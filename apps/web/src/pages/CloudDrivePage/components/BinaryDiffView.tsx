import { Descriptions, Tag, Typography } from "antd";
import { memo } from "react";

import { type DriveDiffEntry, type DriveEntrySnapshot, SyncDirection } from "@my-notes/shared";

export type BinaryDiffViewProps = {
  entry: DriveDiffEntry;
  direction: SyncDirection;
};

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

const SnapshotCard = memo(function SnapshotCard({
  title,
  snapshot,
  tone,
}: {
  title: string;
  snapshot?: DriveEntrySnapshot;
  tone: "local" | "remote";
}) {
  return (
    <div className="flex-1 rounded border border-solid border-gray-200 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Tag color={tone === "local" ? "blue" : "green"}>{title}</Tag>
        {!snapshot ? <Typography.Text type="secondary">（不存在）</Typography.Text> : null}
      </div>
      {snapshot ? (
        <Descriptions column={1} size="small" colon>
          <Descriptions.Item label="名称">{snapshot.name}</Descriptions.Item>
          <Descriptions.Item label="大小">{formatSize(snapshot.sizeBytes)}</Descriptions.Item>
          <Descriptions.Item label="类型">{snapshot.mimeType || "未知"}</Descriptions.Item>
          <Descriptions.Item label="校验值">
            <span className="break-all font-mono text-xs">{snapshot.checksum || "—"}</span>
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">{formatTime(snapshot.updatedAt)}</Descriptions.Item>
        </Descriptions>
      ) : null}
    </div>
  );
});

export const BinaryDiffView = memo(function BinaryDiffView({ entry, direction }: BinaryDiffViewProps) {
  const oldTitle = direction === SyncDirection.PUSH ? "远端（当前）" : "本地（当前）";
  const newTitle = direction === SyncDirection.PUSH ? "本地（待上行）" : "远端（待下行）";
  const oldSnap = direction === SyncDirection.PUSH ? entry.remote : entry.local;
  const newSnap = direction === SyncDirection.PUSH ? entry.local : entry.remote;
  return (
    <div className="flex flex-col gap-3">
      <Typography.Text type="secondary">二进制文件，按元数据对比：</Typography.Text>
      <div className="flex gap-3">
        <SnapshotCard title={oldTitle} snapshot={oldSnap} tone="remote" />
        <SnapshotCard title={newTitle} snapshot={newSnap} tone="local" />
      </div>
    </div>
  );
});
