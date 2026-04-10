import { DeleteOutlined, DownloadOutlined, EditOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Popconfirm, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import { SyncBadge } from "@/components/SyncBadge";
import type { DriveFile, DriveFolder } from "../types";
import { CloudDriveDetailTopBar } from "./CloudDriveDetailTopBar";

type CloudDriveDetailPanelProps = {
  folder: DriveFolder | null;
  files: DriveFile[];
  syncing: boolean;
  onPull: () => void;
  onPush: () => void;
  onAddFile: () => void;
  onDownloadFile: (file: DriveFile) => Promise<void> | void;
  onRenameFile: (fileId: string, name: string) => Promise<void>;
  onDeleteFile: (fileId: string) => Promise<void>;
};

export function CloudDriveDetailPanel({
  folder,
  files,
  syncing,
  onPull,
  onPush,
  onAddFile,
  onDownloadFile,
  onRenameFile,
  onDeleteFile,
}: CloudDriveDetailPanelProps) {
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const pathLabel = useMemo(() => folder?.path || `/${folder?.name ?? "未选择"}`, [folder]);

  if (!folder) {
    return <Empty description="请选择左侧目录查看文件" />;
  }

  const startEdit = (file: DriveFile) => {
    setEditingFileId(file.id);
    setDraftName(file.name);
  };

  const saveEdit = async (fileId: string) => {
    await onRenameFile(fileId, draftName);
    setEditingFileId(null);
    setDraftName("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <CloudDriveDetailTopBar
        pathLabel={pathLabel}
        syncing={syncing}
        onPull={onPull}
        onPush={onPush}
        onAddFile={onAddFile}
      />
      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200 p-3">
        {files.length === 0 ? (
          <Empty description="当前目录暂无文件" />
        ) : (
          <Space direction="vertical" className="w-full" size="middle">
            {files.map((file) => {
              const editing = editingFileId === file.id;
              return (
                <div key={file.id} className="rounded border border-solid border-gray-200 p-3">
                  {!editing ? (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Typography.Text strong>{file.name}</Typography.Text>
                        <div className="mt-1">
                          <SyncBadge status={file.syncStatus} />
                        </div>
                        <Typography.Text type="secondary">
                          {(file.sizeBytes / 1024).toFixed(1)} KB · {file.mimeType || "unknown"}
                        </Typography.Text>
                      </div>
                      <Space>
                        <Button icon={<DownloadOutlined />} onClick={() => void onDownloadFile(file)}>
                          下载
                        </Button>
                        <Button icon={<EditOutlined />} onClick={() => startEdit(file)}>
                          重命名
                        </Button>
                        <Popconfirm
                          title="确认删除该文件？"
                          description="删除后不可恢复"
                          okText="确认"
                          cancelText="取消"
                          onConfirm={() => onDeleteFile(file.id)}
                        >
                          <Button danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  ) : (
                    <Space>
                      <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} style={{ width: 320 }} />
                      <Button type="primary" icon={<SaveOutlined />} onClick={() => void saveEdit(file.id)}>
                        保存
                      </Button>
                      <Button onClick={() => setEditingFileId(null)}>取消</Button>
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
