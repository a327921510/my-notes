import { memo } from "react";

import type { SyncStatus } from "@my-notes/shared";
import { SYNC_STATUS_LABELS } from "@my-notes/shared";
import { Tag } from "antd";

const COLORS: Record<SyncStatus, string> = {
  local_only: "gold",
  synced: "success",
  dirty: "processing",
  failed: "error",
};

export type SyncBadgeProps = {
  status: SyncStatus;
};

export const SyncBadge = memo(function SyncBadge({ status }: SyncBadgeProps) {
  return <Tag color={COLORS[status]}>{SYNC_STATUS_LABELS[status]}</Tag>;
});
