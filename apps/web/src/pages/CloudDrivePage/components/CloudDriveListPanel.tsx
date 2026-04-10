import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Input, List, Modal, Popconfirm, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import { SyncBadge } from "@/components/SyncBadge";
import type { DriveFolder } from "../types";

type CloudDriveListPanelProps = {
  folders: DriveFolder[];
  selectedFolderId: string | null;
  searchKeyword: string;
  onSearchChange: (keyword: string) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onPullFromCloud: () => Promise<void> | void;
  onPushToCloud: () => Promise<void> | void;
};

export function CloudDriveListPanel({
  folders,
  selectedFolderId,
  searchKeyword,
  onSearchChange,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onPullFromCloud,
  onPushToCloud,
}: CloudDriveListPanelProps) {
  const [searchInput, setSearchInput] = useState(searchKeyword);
  const [createOpen, setCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const selectedFolderName = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId)?.name ?? "无",
    [folders, selectedFolderId],
  );

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName);
    setCreateOpen(false);
    setNewFolderName("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Space>
          <FolderOpenOutlined />
          <Typography.Title level={5} style={{ margin: 0 }}>
            云盘目录
          </Typography.Title>
        </Space>
        <Space size={4}>
          <Button type="text" icon={<CloudDownloadOutlined />} onClick={() => void onPullFromCloud()} />
          <Button type="text" icon={<CloudUploadOutlined />} onClick={() => void onPushToCloud()} />
          <Button type="text" icon={<FolderAddOutlined />} onClick={() => setCreateOpen(true)} />
        </Space>
      </div>

      <Space.Compact className="w-full">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onPressEnter={() => onSearchChange(searchInput)}
          placeholder="搜索目录"
        />
        <Button icon={<SearchOutlined />} onClick={() => onSearchChange(searchInput)}>
          搜索
        </Button>
      </Space.Compact>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200">
        <List
          size="small"
          dataSource={folders}
          locale={{ emptyText: "暂无目录，点击右上角创建" }}
          renderItem={(folder) => {
            const active = folder.id === selectedFolderId;
            return (
              <List.Item
                style={{ cursor: "pointer", padding: "10px 12px", background: active ? "#e6f4ff" : "transparent" }}
                onClick={() => onSelectFolder(folder.id)}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Space size={6}>
                      <FolderOpenOutlined />
                      <Typography.Text ellipsis strong={active}>
                        {folder.name}
                      </Typography.Text>
                    </Space>
                    <div>
                      <SyncBadge status={folder.syncStatus} />
                    </div>
                  </div>
                  <Popconfirm
                    title="确认删除目录？"
                    description="目录需为空才可删除"
                    okText="确认"
                    cancelText="取消"
                    onConfirm={() => onDeleteFolder(folder.id)}
                  >
                    <Button
                      danger
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </List.Item>
            );
          }}
        />
      </div>

      <Typography.Text type="secondary">当前目录：{selectedFolderName}</Typography.Text>

      <Modal
        title="新增目录"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newFolderName.trim() }}
      >
        <Input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="目录名称（必填）" />
      </Modal>
    </div>
  );
}
