import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Space, Typography, message } from "antd";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ItemArticleRow, formatItemArticleCopyLine } from "@/components/ItemArticleRow";
import { SiteSectionHeadingBar } from "@/components/SiteSectionHeadingBar";
import { SyncBadge } from "@/components/SyncBadge";

import type { ProjectItem, ProjectVM } from "../types";

export type ProjectDetailPanelProps = {
  project: ProjectVM | null;
  onAddItem: (projectId: string) => Promise<string>;
  onUpdateItem: (projectId: string, itemId: string, payload: { name: string; content: string }) => Promise<void>;
  onDeleteItem: (projectId: string, itemId: string) => Promise<void>;
  onSync: () => Promise<void>;
  onPull: () => Promise<void>;
  focusItemId?: string;
  onFocusItemConsumed?: () => void;
};

/** 当前行是否为「站点分组」的第一条（与前一条 siteId 不同或列表首条） */
function isSiteSectionStart(items: ProjectItem[], index: number): boolean {
  const item = items[index];
  if (!item.siteId) return false;
  if (index === 0) return true;
  return items[index - 1]?.siteId !== item.siteId;
}

function formatSiteSectionHeading(item: ProjectItem): string {
  const addr = (item.siteAddress ?? "").trim() || "未设置站点地址";
  const name = (item.siteName ?? "").trim() || "未命名站点";
  return `${addr} (${name})`;
}

export function ProjectDetailPanel(props: ProjectDetailPanelProps) {
  const { project, onAddItem, onUpdateItem, onDeleteItem, onSync, onPull, focusItemId, onFocusItemConsumed } =
    props;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [itemContentDraft, setItemContentDraft] = useState("");
  const focusItemConsumedRef = useRef(false);

  useEffect(() => {
    focusItemConsumedRef.current = false;
  }, [focusItemId]);

  const canSaveItem = useMemo(() => itemContentDraft.trim().length > 0, [itemContentDraft]);

  const handleCopyProjectItem = useCallback(
    (itemId: string) => {
      if (!project) return;
      const item = project.items.find((i) => i.id === itemId);
      if (!item) return;
      void navigator.clipboard.writeText(formatItemArticleCopyLine(item));
      message.success("已复制");
    },
    [project],
  );

  const handleEditProjectItem = useCallback(
    (itemId: string) => {
      if (!project) return;
      const item = project.items.find((i) => i.id === itemId);
      if (!item) return;
      setEditingItemId(itemId);
      setItemNameDraft(item.name);
      setItemContentDraft(item.content);
    },
    [project],
  );

  const handleDeleteProjectItem = useCallback(
    (itemId: string) => {
      if (!project) return;
      void onDeleteItem(project.id, itemId);
    },
    [project, onDeleteItem],
  );

  const cancelItemEdit = useCallback(() => {
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  }, []);

  const commitItemEdit = useCallback(async () => {
    if (!project || !editingItemId) return;
    if (!itemContentDraft.trim()) {
      message.warning("内容为必填项");
      return;
    }
    await onUpdateItem(project.id, editingItemId, {
      name: itemNameDraft,
      content: itemContentDraft,
    });
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  }, [project, editingItemId, itemContentDraft, itemNameDraft, onUpdateItem]);

  useEffect(() => {
    if (!focusItemId || focusItemConsumedRef.current || !project) return;
    const item = project.items.find((i) => i.id === focusItemId);
    if (!item) {
      focusItemConsumedRef.current = true;
      onFocusItemConsumed?.();
      return;
    }
    setEditingItemId(focusItemId);
    setItemNameDraft(item.name);
    setItemContentDraft(item.content);
    focusItemConsumedRef.current = true;
    onFocusItemConsumed?.();
  }, [focusItemId, onFocusItemConsumed, project]);

  if (!project) {
    return <Empty description="请选择左侧项目查看条目" />;
  }

  const handleAddItem = async () => {
    const newId = await onAddItem(project.id);
    setEditingItemId(newId);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
        <Space wrap>
          <Typography.Text strong>{project.name}</Typography.Text>
          <SyncBadge status={project.syncStatus} />
        </Space>
        <Space>
          <Button onClick={() => void onPull()}>拉取云端</Button>
          <Button onClick={() => void onSync()}>同步到云端</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleAddItem()}>
            新增条目
          </Button>
        </Space>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-100">
        {project.items.length === 0 ? (
          <Empty description="暂无条目，点击右上角新增（含站点下挂到此项目的条目）" />
        ) : (
          <div className="w-full">
            {project.items.map((item, index) => {
              const sectionStart = isSiteSectionStart(project.items, index);
              return (
                <Fragment key={item.id}>
                  {sectionStart ? (
                    <SiteSectionHeadingBar
                      text={formatSiteSectionHeading(item)}
                      showTopDivider={index > 0}
                    />
                  ) : null}
                  <ItemArticleRow
                    item={item}
                    isEditing={editingItemId === item.id}
                    itemNameDraft={itemNameDraft}
                    itemContentDraft={itemContentDraft}
                    onItemNameChange={setItemNameDraft}
                    onItemContentChange={setItemContentDraft}
                    canSaveItem={canSaveItem}
                    onSave={commitItemEdit}
                    onCancelEdit={cancelItemEdit}
                    onCopy={handleCopyProjectItem}
                    onEdit={handleEditProjectItem}
                    onDelete={handleDeleteProjectItem}
                  />
                </Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
