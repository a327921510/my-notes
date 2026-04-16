import { Checkbox, Modal, Space, Typography } from "antd";
import { memo } from "react";

import type { SyncedRow } from "../types";

export type DeleteConfirmModalProps = {
  pending: SyncedRow | null;
  deleteCloud: boolean;
  hasToken: boolean;
  onDeleteCloudChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export const DeleteConfirmModal = memo(function DeleteConfirmModal({
  pending,
  deleteCloud,
  hasToken,
  onDeleteCloudChange,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  return (
    <Modal
      title="确认删除"
      open={!!pending}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="删除"
      okButtonProps={{ danger: true }}
    >
      <Space direction="vertical">
        <Typography.Text>
          {pending?.kind === "note" ? `笔记：${pending.title}` : `短文本：${pending?.title}`}
        </Typography.Text>
        <Checkbox checked={deleteCloud} onChange={(e) => onDeleteCloudChange(e.target.checked)}>
          同时删除云端已同步副本
        </Checkbox>
        {!hasToken && deleteCloud ? (
          <Typography.Text type="warning" className="text-sm">
            未登录时无法删除云端副本，将仅执行本地删除。
          </Typography.Text>
        ) : null}
      </Space>
    </Modal>
  );
});
