import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Modal, Select, Space, Typography, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ItemArticleRow, formatItemArticleCopyLine } from "@/components/ItemArticleRow";
import { SyncBadge } from "@/components/SyncBadge";
import type { Site } from "../types";

export type SiteDetailPanelProps = {
  site: Site | null;
  projectOptions: { value: string; label: string }[];
  onAddItem: (siteId: string) => Promise<string>;
  onUpdateItem: (siteId: string, itemId: string, payload: { name: string; content: string }) => Promise<void>;
  onDeleteItem: (siteId: string, itemId: string) => Promise<void>;
  onSync: () => Promise<void>;
  onPull: () => Promise<void>;
  onCloneSite: (sourceSiteId: string, payload: { name: string; address: string }) => Promise<void>;
  onSiteProjectChange: (siteId: string, projectId: string | null) => Promise<void>;
  focusItemId?: string;
  onFocusItemConsumed?: () => void;
};

export function SiteDetailPanel(props: SiteDetailPanelProps) {
  const {
    site,
    projectOptions,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
    onSync,
    onPull,
    onCloneSite,
    onSiteProjectChange,
    focusItemId,
    onFocusItemConsumed,
  } = props;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [itemContentDraft, setItemContentDraft] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copyAddress, setCopyAddress] = useState("");
  const focusItemConsumedRef = useRef(false);

  useEffect(() => {
    focusItemConsumedRef.current = false;
  }, [focusItemId]);

  const canSaveItem = useMemo(() => itemContentDraft.trim().length > 0, [itemContentDraft]);

  const handleCopySiteItem = useCallback((itemId: string) => {
    if (!site) return;
    const item = site.items.find((i) => i.id === itemId);
    if (!item) return;
    void navigator.clipboard.writeText(formatItemArticleCopyLine(item));
    message.success("已复制");
  }, [site]);

  const handleEditSiteItem = useCallback((itemId: string) => {
    if (!site) return;
    const item = site.items.find((i) => i.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setItemNameDraft(item.name);
    setItemContentDraft(item.content);
  }, [site]);

  const handleDeleteSiteItem = useCallback(
    (itemId: string) => {
      if (!site) return;
      void onDeleteItem(site.id, itemId);
    },
    [site, onDeleteItem],
  );

  const cancelItemEdit = useCallback(() => {
    if (site && editingItemId) {
      const row = site.items.find((i) => i.id === editingItemId);
      /** 未保存过正文（仅占位）时取消，删除记录避免出现空白行 */
      if (row && !row.content.trim()) {
        void onDeleteItem(site.id, editingItemId);
      }
    }
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  }, [site, editingItemId, onDeleteItem]);

  const commitItemEdit = useCallback(async () => {
    if (!site || !editingItemId) return;
    if (!itemContentDraft.trim()) {
      message.warning("内容为必填项");
      return;
    }
    await onUpdateItem(site.id, editingItemId, {
      name: itemNameDraft,
      content: itemContentDraft,
    });
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  }, [site, editingItemId, itemContentDraft, itemNameDraft, onUpdateItem]);

  useEffect(() => {
    if (!focusItemId || focusItemConsumedRef.current || !site) return;
    const item = site.items.find((i) => i.id === focusItemId);
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
  }, [focusItemId, onFocusItemConsumed, site]);

  if (!site) {
    return <Empty description="请选择左侧站点查看详情" />;
  }

  const openCopyModal = () => {
    setCopyName(`${site.name}-副本`);
    setCopyAddress(site.address);
    setCopyOpen(true);
  };

  const handleClone = async () => {
    if (!copyName.trim()) {
      message.warning("站点名称不能为空");
      return;
    }
    await onCloneSite(site.id, { name: copyName, address: copyAddress });
    setCopyOpen(false);
  };

  const handleAddItem = async () => {
    const newId = await onAddItem(site.id);
    setEditingItemId(newId);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
        <Space wrap>
          <Typography.Text strong>{site.address || "未设置站点地址"}</Typography.Text>
          <SyncBadge status={site.syncStatus} />
          <Select
            className="min-w-[180px]"
            allowClear
            placeholder="绑定项目（筛选）"
            value={site.projectId ?? undefined}
            options={projectOptions}
            onChange={(v) => void onSiteProjectChange(site.id, v ?? null)}
          />
        </Space>
        <Space>
          <Button onClick={openCopyModal}>复制站点信息</Button>
          <Button onClick={() => void onPull()}>拉取云端</Button>
          <Button onClick={() => void onSync()}>同步到云端</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleAddItem()}>
            新增条目
          </Button>
        </Space>
      </div>
      <Modal
        title="复制站点信息"
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        onOk={() => void handleClone()}
        okText="创建"
        cancelText="取消"
      >
        <Space direction="vertical" className="w-full">
          <Input value={copyName} onChange={(e) => setCopyName(e.target.value)} placeholder="站点名称" />
          <Input value={copyAddress} onChange={(e) => setCopyAddress(e.target.value)} placeholder="站点地址" />
        </Space>
      </Modal>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-100">
        {site.items.length === 0 ? (
          <Empty description="暂无条目，点击右上角新增" />
        ) : (
          <div className="w-full">
            {site.items.map((item) => (
              <ItemArticleRow
                key={item.id}
                item={item}
                isEditing={editingItemId === item.id}
                itemNameDraft={itemNameDraft}
                itemContentDraft={itemContentDraft}
                onItemNameChange={setItemNameDraft}
                onItemContentChange={setItemContentDraft}
                canSaveItem={canSaveItem}
                onSave={commitItemEdit}
                onCancelEdit={cancelItemEdit}
                onCopy={handleCopySiteItem}
                onEdit={handleEditSiteItem}
                onDelete={handleDeleteSiteItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
