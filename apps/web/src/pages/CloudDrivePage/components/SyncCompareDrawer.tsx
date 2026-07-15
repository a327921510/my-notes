import { CloudDownloadOutlined, CloudUploadOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Empty, Segmented, Space, Spin, Splitter, Tag, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  type DriveDiffResult,
  DriveChangeStatus,
  DriveEntryKind,
  SyncDirection,
} from "@my-notes/shared";

import type { EntryCompareContent } from "../hooks/useDriveSyncCompare";
import { BinaryDiffView } from "./BinaryDiffView";
import { DiffFileList } from "./DiffFileList";
import { DiffStatBar } from "./DiffStatBar";
import { type DiffViewMode, UnifiedDiffView } from "./UnifiedDiffView";
import { DIFF_STATUS_META } from "./diffStatusMeta";

export type SyncCompareDrawerProps = {
  open: boolean;
  direction: SyncDirection;
  loading: boolean;
  applying: boolean;
  error: string | null;
  diff: DriveDiffResult | null;
  selectedKey: string | null;
  onClose: () => void;
  onChangeDirection: (direction: SyncDirection) => void;
  onSelectEntry: (key: string) => void;
  onApply: () => void;
  onRefresh: (direction: SyncDirection) => void;
  loadEntryContent: (
    entry: NonNullable<DriveDiffResult["entries"][number]>,
    direction: SyncDirection,
  ) => Promise<EntryCompareContent>;
};

const DIRECTION_OPTIONS = [
  { label: "上行 · 本地 → 远端", value: SyncDirection.PUSH },
  { label: "下行 · 远端 → 本地", value: SyncDirection.PULL },
];

const VIEW_MODE_OPTIONS = [
  { label: "统一视图", value: "unified" as DiffViewMode },
  { label: "分栏视图", value: "split" as DiffViewMode },
];

export function SyncCompareDrawer({
  open,
  direction,
  loading,
  applying,
  error,
  diff,
  selectedKey,
  onClose,
  onChangeDirection,
  onSelectEntry,
  onApply,
  onRefresh,
  loadEntryContent,
}: SyncCompareDrawerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [content, setContent] = useState<EntryCompareContent | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const requestRef = useRef(0);

  const selectedEntry = useMemo(
    () => diff?.entries.find((entry) => entry.key === selectedKey) ?? null,
    [diff, selectedKey],
  );

  useEffect(() => {
    if (!selectedEntry) {
      setContent(null);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setContentLoading(true);
    void loadEntryContent(selectedEntry, direction)
      .then((result) => {
        if (requestRef.current === requestId) setContent(result);
      })
      .finally(() => {
        if (requestRef.current === requestId) setContentLoading(false);
      });
  }, [selectedEntry, direction, loadEntryContent]);

  const applyLabel = direction === SyncDirection.PUSH ? "执行上行" : "执行下行";
  const applyIcon = direction === SyncDirection.PUSH ? <CloudUploadOutlined /> : <CloudDownloadOutlined />;
  const hasChanges = diff ? diff.summary.added + diff.summary.modified + diff.summary.removed > 0 : false;

  return (
    <Drawer
      title="同步对比"
      placement="right"
      width="92%"
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => onRefresh(direction)} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={applyIcon}
            loading={applying}
            disabled={!hasChanges}
            onClick={onApply}
          >
            {applyLabel}
          </Button>
        </Space>
      }
    >
      <div className="flex flex-col gap-3 border-0 border-b border-solid border-gray-200 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented options={DIRECTION_OPTIONS} value={direction} onChange={(v) => onChangeDirection(v as SyncDirection)} />
          {diff ? <DiffStatBar summary={diff.summary} /> : null}
        </div>
        {error ? <Alert type="error" showIcon message={error} /> : null}
      </div>

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spin tip="正在计算差异…" />
          </div>
        ) : !diff ? (
          <Empty className="mt-16" description="暂无对比数据" />
        ) : (
          <Splitter className="h-full">
            <Splitter.Panel defaultSize={340} min={260} max={520}>
              <DiffFileList entries={diff.entries} selectedKey={selectedKey} onSelect={onSelectEntry} />
            </Splitter.Panel>
            <Splitter.Panel>
              <div className="flex h-full flex-col gap-3 p-3">
                {!selectedEntry ? (
                  <Empty className="mt-16" description="请选择左侧文件查看差异" />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Space size={8}>
                        <Tag className={DIFF_STATUS_META[selectedEntry.status].chipClass}>
                          {DIFF_STATUS_META[selectedEntry.status].label}
                        </Tag>
                        <Typography.Text strong className="break-all">
                          {selectedEntry.path}
                        </Typography.Text>
                      </Space>
                      {content?.kind === "text" ? (
                        <Segmented
                          size="small"
                          options={VIEW_MODE_OPTIONS}
                          value={viewMode}
                          onChange={(v) => setViewMode(v as DiffViewMode)}
                        />
                      ) : null}
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto">
                      {contentLoading ? (
                        <div className="flex h-full items-center justify-center">
                          <Spin />
                        </div>
                      ) : selectedEntry.kind === DriveEntryKind.FOLDER ? (
                        <Typography.Paragraph type="secondary">
                          目录变更（{DIFF_STATUS_META[selectedEntry.status].label}）：{selectedEntry.path}
                        </Typography.Paragraph>
                      ) : content?.error ? (
                        <Alert type="warning" showIcon message={content.error} />
                      ) : content?.kind === "text" && content.diff ? (
                        <UnifiedDiffView diff={content.diff} mode={viewMode} />
                      ) : content?.kind === "binary" ? (
                        <BinaryDiffView entry={selectedEntry} direction={direction} />
                      ) : selectedEntry.status === DriveChangeStatus.UNCHANGED ? (
                        <Typography.Text type="secondary">该文件两端一致，无差异。</Typography.Text>
                      ) : (
                        <Spin />
                      )}
                    </div>
                  </>
                )}
              </div>
            </Splitter.Panel>
          </Splitter>
        )}
      </div>
    </Drawer>
  );
}
