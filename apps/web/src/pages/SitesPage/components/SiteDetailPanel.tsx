import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Modal, Popconfirm, Space, Typography, message } from "antd";
import { useMemo, useState } from "react";
import { SyncBadge } from "@/components/SyncBadge";
import type { Site } from "../types";

type SiteDetailPanelProps = {
  site: Site | null;
  onAddItem: (siteId: string) => Promise<string>;
  onUpdateItem: (siteId: string, itemId: string, payload: { name: string; content: string }) => Promise<void>;
  onDeleteItem: (siteId: string, itemId: string) => Promise<void>;
  onSync: () => Promise<void>;
  onPull: () => Promise<void>;
  onCloneSite: (sourceSiteId: string, payload: { name: string; address: string }) => Promise<void>;
};

export function SiteDetailPanel(props: SiteDetailPanelProps) {
  const { site, onAddItem, onUpdateItem, onDeleteItem, onSync, onPull, onCloneSite } = props;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [itemContentDraft, setItemContentDraft] = useState("");
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copyAddress, setCopyAddress] = useState("");

  const canSaveItem = useMemo(() => itemContentDraft.trim().length > 0, [itemContentDraft]);

  if (!site) {
    return <Empty description="请选择左侧站点查看详情" />;
  }

  const openCopyModal = () => {
    setCopyName(`${site.name}-副本`);
    setCopyAddress(site.address);
    setCopyOpen(true);
  };

  const handleClone = async () => {
    if (!copyName.trim() || !copyAddress.trim()) {
      message.warning("站点名称和地址不能为空");
      return;
    }
    await onCloneSite(site.id, { name: copyName, address: copyAddress });
    setCopyOpen(false);
  };

  const startEditItem = (itemId: string, currentName: string, currentContent: string) => {
    setEditingItemId(itemId);
    setItemNameDraft(currentName);
    setItemContentDraft(currentContent);
  };

  const saveItem = async (itemId: string) => {
    if (!itemContentDraft.trim()) {
      message.warning("内容为必填项");
      return;
    }
    await onUpdateItem(site.id, itemId, {
      name: itemNameDraft,
      content: itemContentDraft,
    });
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  const handleAddItem = async () => {
    const newId = await onAddItem(site.id);
    setEditingItemId(newId);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
        <Space>
          <Typography.Text strong>{site.address || "未设置站点地址"}</Typography.Text>
          <SyncBadge status={site.syncStatus} />
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

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200 p-3">
        {site.items.length === 0 ? (
          <Empty description="暂无条目，点击右上角新增" />
        ) : (
          <Space direction="vertical" className="w-full" size="middle">
            {site.items.map((item) => {
              const editing = editingItemId === item.id;
              return (
                <div key={item.id} className="rounded border border-solid border-gray-200 p-3">
                  {!editing ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Typography.Text strong>{item.name || "（未命名）"}</Typography.Text>
                        <div>
                          <SyncBadge status={item.syncStatus} />
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-gray-700">{item.content || "-"}</div>
                      </div>
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          onClick={() => startEditItem(item.id, item.name, item.content)}
                        >
                          编辑
                        </Button>
                        <Popconfirm
                          title="确认删除该条目？"
                          description="删除后不可恢复"
                          okText="确认"
                          cancelText="取消"
                          onConfirm={() => onDeleteItem(site.id, item.id)}
                        >
                          <Button danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  ) : (
                    <Space direction="vertical" className="w-full">
                      <Input
                        value={itemNameDraft}
                        onChange={(e) => setItemNameDraft(e.target.value)}
                        placeholder="名称（非必填）"
                      />
                      <Input.TextArea
                        value={itemContentDraft}
                        onChange={(e) => setItemContentDraft(e.target.value)}
                        placeholder="内容（必填）"
                        autoSize={{ minRows: 3, maxRows: 8 }}
                      />
                      <Space>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          disabled={!canSaveItem}
                          onClick={() => void saveItem(item.id)}
                        >
                          保存
                        </Button>
                        <Button onClick={() => setEditingItemId(null)}>取消</Button>
                      </Space>
                    </Space>
                  )}
                </div>
              );
            })}
          </Space>
        )}
      </div>
    </div>
  );
}
