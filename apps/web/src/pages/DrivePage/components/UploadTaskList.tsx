import { formatBytes } from "@my-notes/shared";
import { Progress, Tag, Typography } from "antd";
import { memo } from "react";

import type { UploadTask, UploadTaskStatus } from "../hooks/useDriveTransfer";

export type UploadTaskListProps = {
  tasks: UploadTask[];
};

const STATUS_META: Record<UploadTaskStatus, { label: string; color: string }> = {
  pending: { label: "等待中", color: "default" },
  uploading: { label: "上传中", color: "processing" },
  done: { label: "已完成", color: "success" },
  skipped: { label: "已跳过", color: "warning" },
  failed: { label: "失败", color: "error" },
};

export const UploadTaskList = memo(function UploadTaskList({ tasks }: UploadTaskListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <div key={task.id} className="rounded border border-solid border-[#f0f0f0] p-2">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">{task.name}</span>
            <Typography.Text type="secondary" className="shrink-0 text-xs">
              {formatBytes(task.sizeBytes)}
            </Typography.Text>
            <Tag color={STATUS_META[task.status].color}>{STATUS_META[task.status].label}</Tag>
          </div>
          <Progress
            percent={task.percent}
            size="small"
            showInfo={false}
            status={task.status === "failed" ? "exception" : task.status === "done" ? "success" : "active"}
          />
          {task.error ? (
            <Typography.Text type="danger" className="text-xs">
              {task.error}
            </Typography.Text>
          ) : null}
        </div>
      ))}
    </div>
  );
});
