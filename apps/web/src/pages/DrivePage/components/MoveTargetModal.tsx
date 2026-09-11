import { type DriveNode, NodeKind } from "@my-notes/shared";
import { Breadcrumb, Empty, List, Modal, Typography } from "antd";
import { FolderFilled } from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";

import { driveApi } from "@/services/modules/drive";

export type MoveTargetModalProps = {
  open: boolean;
  /** 被移动的节点 id，用于禁止选中自身 */
  movingIds: string[];
  onCancel: () => void;
  onConfirm: (targetParentId: string) => void;
};

/** 以浏览目录的方式挑选移动目标；进入自身会被服务端拒绝，这里提前灰掉。 */
export function MoveTargetModal({ open, movingIds, onCancel, onConfirm }: MoveTargetModalProps) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [parent, setParent] = useState<DriveNode | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFolderId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void driveApi
      .listNodes({ parentId: folderId })
      .then((result) => {
        if (cancelled) return;
        setParent(result.parent);
        setPath(result.path.map((item) => ({ id: item.id, name: item.name })));
        setFolders(result.nodes.filter((node) => node.kind === NodeKind.FOLDER));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folderId, open]);

  const handleConfirm = useCallback(() => {
    if (parent) onConfirm(parent.id);
  }, [onConfirm, parent]);

  return (
    <Modal
      open={open}
      title="移动到"
      okText={parent ? `移动到「${parent.name}」` : "移动"}
      cancelText="取消"
      okButtonProps={{ disabled: !parent || loading }}
      onOk={handleConfirm}
      onCancel={onCancel}
    >
      <Breadcrumb
        className="mb-2"
        items={path.map((item, index) => ({
          title:
            index === path.length - 1 ? (
              <span>{item.name}</span>
            ) : (
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 text-[#1677ff]"
                onClick={() => setFolderId(index === 0 ? null : item.id)}
              >
                {item.name}
              </button>
            ),
        }))}
      />
      <div className="max-h-[320px] overflow-auto rounded border border-solid border-[#f0f0f0]">
        {folders.length === 0 ? (
          <Empty className="py-6" image={Empty.PRESENTED_IMAGE_SIMPLE} description="该目录下没有子文件夹" />
        ) : (
          <List
            size="small"
            dataSource={folders}
            loading={loading}
            renderItem={(folder) => {
              const disabled = movingIds.includes(folder.id);
              return (
                <List.Item
                  className={disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}
                  onClick={() => {
                    if (!disabled) setFolderId(folder.id);
                  }}
                >
                  <FolderFilled className="mr-2 text-[#f7c04a]" />
                  <span className="flex-1">{folder.name}</span>
                  {disabled ? <Typography.Text type="secondary">待移动项</Typography.Text> : null}
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
}
