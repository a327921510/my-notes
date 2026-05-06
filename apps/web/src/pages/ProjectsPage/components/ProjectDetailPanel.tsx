import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Space, Typography, message } from "antd";
import { useMemo, useState } from "react";

import { SyncBadge } from "@/components/SyncBadge";

import type { ProjectVM } from "../types";

export type ProjectDetailPanelProps = {
  project: ProjectVM | null;
  onAddItem: (projectId: string) => Promise<string>;
  onUpdateItem: (projectId: string, itemId: string, payload: { name: string; content: string }) => Promise<void>;
  onDeleteItem: (projectId: string, itemId: string) => Promise<void>;
  onSync: () => Promise<void>;
  onPull: () => Promise<void>;
};

export function ProjectDetailPanel(props: ProjectDetailPanelProps) {
  const { project, onAddItem, onUpdateItem, onDeleteItem, onSync, onPull } = props;
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNameDraft, setItemNameDraft] = useState("");
  const [itemContentDraft, setItemContentDraft] = useState("");

  const canSaveItem = useMemo(() => itemContentDraft.trim().length > 0, [itemContentDraft]);

  if (!project) {
    return <Empty description="请选择左侧项目查看条目" />;
  }

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
    await onUpdateItem(project.id, itemId, {
      name: itemNameDraft,
      content: itemContentDraft,
    });
    setEditingItemId(null);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  const handleAddItem = async () => {
    const newId = await onAddItem(project.id);
    setEditingItemId(newId);
    setItemNameDraft("");
    setItemContentDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3 rounded border border-solid border-gray-200 p-3">
        <Space>
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

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200 p-3">
        {project.items.length === 0 ? (
          <Empty description="暂无条目，点击右上角新增（含站点下挂到此项目的条目）" />
        ) : (
          <Space direction="vertical" className="w-full" size="middle">
            {project.items.map((item) => {
              const editing = editingItemId === item.id;
              const fromSite = Boolean(item.siteId);
              return (
                <div key={item.id} className="rounded border border-solid border-gray-200 p-3">
                  {!editing ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Typography.Text strong>{item.name || "（未命名）"}</Typography.Text>
                        {fromSite ? (
                          <Typography.Text type="secondary" className="ml-2">
                            [站点条目]
                          </Typography.Text>
                        ) : null}
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
                        <Button danger icon={<DeleteOutlined />} onClick={() => onDeleteItem(project.id, item.id)}>
                          删除
                        </Button>
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
