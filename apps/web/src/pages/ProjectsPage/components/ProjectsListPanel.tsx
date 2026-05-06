import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Input, List, Modal, Popconfirm, Space, Typography } from "antd";
import { useMemo, useState } from "react";

import { SyncBadge } from "@/components/SyncBadge";

import type { ProjectVM } from "../types";

export type ProjectsListPanelProps = {
  projects: ProjectVM[];
  selectedProjectId: string | null;
  searchKeyword: string;
  onSearch: (keyword: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (payload: { name: string }) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onPullFromCloud: () => Promise<void>;
  onPushToCloud: () => Promise<void>;
  onExportBackup: () => void | Promise<void>;
  onImportBackup: () => void;
};

export function ProjectsListPanel(props: ProjectsListPanelProps) {
  const {
    projects,
    selectedProjectId,
    searchKeyword,
    onSearch,
    onSelectProject,
    onCreateProject,
    onDeleteProject,
    onRenameProject,
    onPullFromCloud,
    onPushToCloud,
    onExportBackup,
    onImportBackup,
  } = props;
  const [searchInput, setSearchInput] = useState(searchKeyword);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [editNameDraft, setEditNameDraft] = useState("");

  const selectedProjectName = useMemo(
    () => projects.find((p) => p.id === selectedProjectId)?.name ?? "",
    [projects, selectedProjectId],
  );

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    await onCreateProject({ name: newProjectName });
    setCreateOpen(false);
    setNewProjectName("");
  };

  const openEdit = (projectId: string, name: string) => {
    setEditingProjectId(projectId);
    setEditNameDraft(name);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingProjectId || !editNameDraft.trim()) return;
    await onRenameProject(editingProjectId, editNameDraft);
    setEditOpen(false);
    setEditingProjectId(null);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Typography.Title level={5} style={{ margin: 0 }}>
          项目列表
        </Typography.Title>
        <Space size={4}>
          <Button type="text" icon={<CloudDownloadOutlined />} onClick={() => void onPullFromCloud()} />
          <Button type="text" icon={<CloudUploadOutlined />} onClick={() => void onPushToCloud()} />
          <Button type="text" icon={<ExportOutlined />} title="导出站点与项目 JSON" onClick={() => void onExportBackup()} />
          <Button type="text" icon={<ImportOutlined />} title="导入站点与项目 JSON" onClick={onImportBackup} />
          <Button type="text" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} />
        </Space>
      </div>

      <Space.Compact className="w-full">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onPressEnter={() => onSearch(searchInput)}
          placeholder="输入项目名称"
        />
        <Button icon={<SearchOutlined />} onClick={() => onSearch(searchInput)}>
          搜索
        </Button>
      </Space.Compact>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200">
        <List
          size="small"
          dataSource={projects}
          locale={{ emptyText: "暂无项目" }}
          renderItem={(project) => {
            const active = project.id === selectedProjectId;
            return (
              <List.Item
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  background: active ? "#e6f4ff" : "transparent",
                }}
                onClick={() => onSelectProject(project.id)}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Typography.Text strong={active}>{project.name}</Typography.Text>
                    <div>
                      <SyncBadge status={project.syncStatus} />
                    </div>
                  </div>
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(project.id, project.name);
                      }}
                    />
                    <Popconfirm
                      title="确认删除项目？"
                      description="仅项目条目会删除；站点仅解除绑定"
                      okText="确认"
                      cancelText="取消"
                      onConfirm={() => onDeleteProject(project.id)}
                    >
                      <Button
                        danger
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </Space>
                </div>
              </List.Item>
            );
          }}
        />
      </div>

      <Typography.Text type="secondary">当前选中：{selectedProjectName || "无"}</Typography.Text>

      <Modal
        title="新建项目"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newProjectName.trim() }}
      >
        <Input
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="项目名称（必填）"
        />
      </Modal>

      <Modal
        title="修改项目"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => void handleSaveEdit()}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !editNameDraft.trim() }}
      >
        <Input
          value={editNameDraft}
          onChange={(e) => setEditNameDraft(e.target.value)}
          placeholder="项目名称"
        />
      </Modal>
    </div>
  );
}
