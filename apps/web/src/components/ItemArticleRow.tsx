import { CopyOutlined, DeleteOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";
import { formatSiteItemDisplayName, type SyncStatus } from "@my-notes/shared";
import { Badge, Button, Input, Popconfirm, Space, Typography } from "antd";
import { memo } from "react";

const ITEM_BADGE_STATUS: Record<SyncStatus, "success" | "processing" | "default" | "error" | "warning"> = {
  synced: "success",
  dirty: "processing",
  local_only: "warning",
  failed: "error",
};

export type ItemArticleRowItem = {
  id: string;
  name: string;
  content: string;
  syncStatus: SyncStatus;
};

export function formatItemArticleCopyLine(item: ItemArticleRowItem): string {
  const title = formatSiteItemDisplayName(item.name);
  const body = item.content.trim() ? item.content : "-";
  return `${title}：${body}`;
}

export type ItemArticleRowProps = {
  item: ItemArticleRowItem;
  /** 项目文档同步的镜像条目：仅可复制，不可编辑删除 */
  readOnly?: boolean;
  isEditing: boolean;
  itemNameDraft: string;
  itemContentDraft: string;
  onItemNameChange: (value: string) => void;
  onItemContentChange: (value: string) => void;
  canSaveItem: boolean;
  onSave: () => void | Promise<void>;
  onCancelEdit: () => void;
  onCopy: (itemId: string) => void;
  onEdit: (itemId: string) => void;
  onDelete: (itemId: string) => void;
};

export const ItemArticleRow = memo(function ItemArticleRow({
  item,
  readOnly = false,
  isEditing,
  itemNameDraft,
  itemContentDraft,
  onItemNameChange,
  onItemContentChange,
  canSaveItem,
  onSave,
  onCancelEdit,
  onCopy,
  onEdit,
  onDelete,
}: ItemArticleRowProps) {
  const displayName = formatSiteItemDisplayName(item.name);
  const displayContent = item.content.trim() ? item.content : "-";

  if (isEditing && !readOnly) {
    return (
      <div className="border-b border-gray-100 py-3">
        <Space direction="vertical" className="w-full" size="small">
          <Input
            value={itemNameDraft}
            onChange={(e) => onItemNameChange(e.target.value)}
            placeholder="名称（非必填）"
          />
          <Input.TextArea
            value={itemContentDraft}
            onChange={(e) => onItemContentChange(e.target.value)}
            placeholder="内容（必填）"
            autoSize={{ minRows: 3, maxRows: 8 }}
          />
          <Space>
            <Button type="primary" icon={<SaveOutlined />} disabled={!canSaveItem} onClick={() => void onSave()}>
              保存
            </Button>
            <Button onClick={onCancelEdit}>取消</Button>
          </Space>
        </Space>
      </div>
    );
  }

  return (
    <div className="group/item relative border-b border-gray-100 px-2 py-2 last:border-b-0">
      <div className="relative z-0 flex gap-2">
        <span className="shrink-0">
          <Badge status={ITEM_BADGE_STATUS[item.syncStatus]} text={`${displayName && `${displayName}：`}`} />
        </span>
        <div className="min-w-0 whitespace-pre-wrap break-words text-gray-800">{displayContent}</div>
      </div>
      <div
        className="absolute inset-0 z-10 hidden cursor-pointer items-start justify-end gap-3 rounded-lg bg-black/[0.06] px-2 py-1 group-hover/item:flex"
        onClick={() => onCopy(item.id)}
        role="presentation"
        title="点击复制"
      >
        <Space
          size="small"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="rounded-md bg-white/90 px-2 py-1 shadow-sm"
        >
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            aria-label="复制"
            title="复制"
            onClick={() => onCopy(item.id)}
          />
          {!readOnly ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label="编辑"
                title="编辑"
                onClick={() => onEdit(item.id)}
              />
              <Popconfirm
                title="确认删除该条目？"
                description="删除后不可恢复"
                okText="确认"
                cancelText="取消"
                onConfirm={() => onDelete(item.id)}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="删除" title="删除" />
              </Popconfirm>
            </>
          ) : null}
        </Space>
      </div>
    </div>
  );
});
