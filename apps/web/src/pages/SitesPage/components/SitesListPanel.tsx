import {
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { Button, Input, List, Modal, Popconfirm, Select, Space, Typography } from "antd";
import { useMemo, useState } from "react";

import { SyncBadge } from "@/components/SyncBadge";

import type { Site } from "../types";

export type SitesListPanelProps = {
  sites: Site[];
  selectedSiteId: string | null;
  searchKeyword: string;
  projectFilterId: string | "all";
  projectOptions: { value: string; label: string }[];
  onSearch: (keyword: string) => void;
  onProjectFilterChange: (projectId: string | "all") => void;
  onSelectSite: (siteId: string) => void;
  onCreateSite: (payload: { name: string; address: string; projectId?: string | null }) => Promise<void>;
  onDeleteSite: (siteId: string) => Promise<void>;
  onPullFromCloud: () => Promise<void>;
  onPushToCloud: () => Promise<void>;
  onExportBackup: () => void | Promise<void>;
  onImportBackup: () => void;
};

export function SitesListPanel(props: SitesListPanelProps) {
  const {
    sites,
    selectedSiteId,
    searchKeyword,
    projectFilterId,
    projectOptions,
    onSearch,
    onProjectFilterChange,
    onSelectSite,
    onCreateSite,
    onDeleteSite,
    onPullFromCloud,
    onPushToCloud,
    onExportBackup,
    onImportBackup,
  } = props;
  const [searchInput, setSearchInput] = useState(searchKeyword);
  const [createOpen, setCreateOpen] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteProjectId, setNewSiteProjectId] = useState<string | null>(null);

  const selectedSiteName = useMemo(
    () => sites.find((site) => site.id === selectedSiteId)?.name ?? "",
    [selectedSiteId, sites],
  );

  const projectLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of projectOptions) m.set(o.value, o.label);
    return m;
  }, [projectOptions]);

  const handleCreate = async () => {
    if (!newSiteName.trim()) return;
    await onCreateSite({
      name: newSiteName,
      address: newSiteAddress,
      projectId: newSiteProjectId,
    });
    setCreateOpen(false);
    setNewSiteName("");
    setNewSiteAddress("");
    setNewSiteProjectId(null);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <Typography.Title level={5} style={{ margin: 0 }}>
          站点列表
        </Typography.Title>
        <Space size={4}>
          <Button type="text" icon={<CloudDownloadOutlined />} onClick={() => void onPullFromCloud()} />
          <Button type="text" icon={<CloudUploadOutlined />} onClick={() => void onPushToCloud()} />
          <Button type="text" icon={<ExportOutlined />} title="导出站点与项目 JSON" onClick={() => void onExportBackup()} />
          <Button type="text" icon={<ImportOutlined />} title="导入站点与项目 JSON" onClick={onImportBackup} />
          <Button type="text" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} />
        </Space>
      </div>

      <Select
        className="w-full"
        value={projectFilterId}
        onChange={(v) => onProjectFilterChange(v)}
        options={[
          { value: "all", label: "全部项目" },
          ...projectOptions.map((o) => ({ value: o.value, label: o.label })),
        ]}
      />

      <Space.Compact className="w-full">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onPressEnter={() => onSearch(searchInput)}
          placeholder="输入站点名称"
        />
        <Button icon={<SearchOutlined />} onClick={() => onSearch(searchInput)}>
          搜索
        </Button>
      </Space.Compact>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-solid border-gray-200">
        <List
          size="small"
          dataSource={sites}
          locale={{ emptyText: "暂无站点" }}
          renderItem={(site) => {
            const active = site.id === selectedSiteId;
            const pLabel = site.projectId ? projectLabelMap.get(site.projectId) : null;
            return (
              <List.Item
                style={{
                  cursor: "pointer",
                  padding: "10px 12px",
                  background: active ? "#e6f4ff" : "transparent",
                }}
                onClick={() => onSelectSite(site.id)}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Typography.Text strong={active}>{site.name}</Typography.Text>
                    {pLabel ? (
                      <Typography.Text type="secondary" className="ml-1">
                        · {pLabel}
                      </Typography.Text>
                    ) : null}
                    <div>
                      <SyncBadge status={site.syncStatus} />
                    </div>
                  </div>
                  <Popconfirm
                    title="确认删除站点？"
                    description="站点和其条目将被删除"
                    okText="确认"
                    cancelText="取消"
                    onConfirm={() => onDeleteSite(site.id)}
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

      <Typography.Text type="secondary">当前选中：{selectedSiteName || "无"}</Typography.Text>

      <Modal
        title="新增站点"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newSiteName.trim() }}
      >
        <Space direction="vertical" className="w-full">
          <Input
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            placeholder="站点名称（必填）"
          />
          <Input
            value={newSiteAddress}
            onChange={(e) => setNewSiteAddress(e.target.value)}
            placeholder="站点地址（选填）"
          />
          <Select
            className="w-full"
            allowClear
            placeholder="绑定项目（选填）"
            value={newSiteProjectId}
            onChange={(v) => setNewSiteProjectId(v ?? null)}
            options={projectOptions}
          />
        </Space>
      </Modal>
    </div>
  );
}
