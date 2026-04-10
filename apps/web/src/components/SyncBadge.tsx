import type { SyncStatus } from "@my-notes/shared";
import { SYNC_STATUS_LABELS } from "@my-notes/shared";
import { Tag } from "antd";

const colors: Record<SyncStatus, string> = {
  local_only: "gold",
  synced: "success",
  dirty: "processing",
  failed: "error",
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  return <Tag color={colors[status]}>{SYNC_STATUS_LABELS[status]}</Tag>;
}
