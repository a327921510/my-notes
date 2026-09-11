import { DownOutlined, UpOutlined } from "@ant-design/icons";
import {
  MERGE_STRATEGY_LABELS,
  MergeStrategy,
  type TextDiffResult,
} from "@my-notes/shared";
import { Alert, Button, Drawer, Empty, Segmented, Space, Splitter, Tag, Tooltip, Typography } from "antd";
import { useCallback, useMemo, useState } from "react";

import type { MergeHunkState } from "../hooks/useMmdMerge";
import { type DiffViewMode, MmdDiffView } from "./MmdDiffView";
import { MmdMergeResultPanel } from "./MmdMergeResultPanel";
import { MmdMergeView } from "./MmdMergeView";

export type DocDiffDrawerProps = {
  open: boolean;
  loading: boolean;
  diff: TextDiffResult | null;
  hunkStates: MergeHunkState[];
  selection: ReadonlySet<number>;
  pendingCount: number;
  mergedText: string;
  isManuallyEdited: boolean;
  canSave: boolean;
  saving: boolean;
  onToggleLine: (lineIndex: number, hunkIndex: number) => void;
  onApplyHunkStrategy: (hunkIndex: number, strategy: MergeStrategy) => void;
  onApplyGlobalStrategy: (strategy: MergeStrategy) => void;
  onMergedTextChange: (text: string) => void;
  onSaveMerged: () => void;
  onOverwriteWithLocal: () => void;
  onAdoptServer: () => void;
  onClose: () => void;
};

type Stage = "review" | "merge";

const GLOBAL_STRATEGIES: MergeStrategy[] = [
  MergeStrategy.SERVER,
  MergeStrategy.LOCAL,
  MergeStrategy.BOTH,
];

export function DocDiffDrawer({
  open,
  loading,
  diff,
  hunkStates,
  selection,
  pendingCount,
  mergedText,
  isManuallyEdited,
  canSave,
  saving,
  onToggleLine,
  onApplyHunkStrategy,
  onApplyGlobalStrategy,
  onMergedTextChange,
  onSaveMerged,
  onOverwriteWithLocal,
  onAdoptServer,
  onClose,
}: DocDiffDrawerProps) {
  const [stage, setStage] = useState<Stage>("review");
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [selectedLines, setSelectedLines] = useState<number[]>([]);
  const [focusedHunkIndex, setFocusedHunkIndex] = useState<number | null>(null);

  const stageOptions = useMemo(
    () => [
      { label: "查看差异", value: "review" as Stage },
      { label: `逐行合并${pendingCount > 0 ? `（${pendingCount} 处待处理）` : ""}`, value: "merge" as Stage },
    ],
    [pendingCount],
  );

  const viewOptions = useMemo(
    () => [
      { label: "统一视图", value: "unified" as DiffViewMode },
      { label: "分栏视图", value: "split" as DiffViewMode },
    ],
    [],
  );

  const handleSelectLine = useCallback((index: number, withShift: boolean) => {
    setSelectedLines((prev) => {
      if (!withShift || prev.length === 0) return [index];
      const anchor = prev[0];
      const [start, end] = anchor <= index ? [anchor, index] : [index, anchor];
      return Array.from({ length: end - start + 1 }, (_value, offset) => start + offset);
    });
  }, []);

  const jumpToPending = useCallback(
    (direction: 1 | -1) => {
      const pending = hunkStates.filter((item) => !item.resolved);
      if (pending.length === 0) return;
      const currentPosition = pending.findIndex((item) => item.index === focusedHunkIndex);
      const nextPosition =
        currentPosition === -1
          ? 0
          : (currentPosition + direction + pending.length) % pending.length;
      const target = pending[nextPosition];
      setFocusedHunkIndex(target.index);
      setStage("merge");
      document.getElementById(`merge-hunk-${target.index}`)?.scrollIntoView({ block: "center" });
    },
    [focusedHunkIndex, hunkStates],
  );

  const identical = diff !== null && diff.identical;
  const truncated = diff !== null && diff.truncated;
  const canMerge = diff !== null && !identical && !truncated;

  return (
    <Drawer
      open={open}
      width="92vw"
      title="与服务端对比"
      destroyOnHidden
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onAdoptServer} disabled={!diff}>
            采用服务端版本
          </Button>
          <Button onClick={onOverwriteWithLocal} disabled={!diff} loading={saving}>
            用本机版本覆盖
          </Button>
          <Tooltip title={pendingCount > 0 ? `还有 ${pendingCount} 处变更块待处理` : undefined}>
            <Button
              type="primary"
              data-testid="doc.applySave"
              disabled={!canMerge || !canSave}
              loading={saving}
              onClick={onSaveMerged}
            >
              保存合并结果
            </Button>
          </Tooltip>
        </Space>
      }
    >
      {loading ? (
        <Empty description="正在读取服务端版本…" />
      ) : !diff ? (
        <Empty description="暂无对比结果" />
      ) : identical ? (
        <Alert type="success" showIcon title="两侧内容一致，无差异" />
      ) : truncated ? (
        <Alert
          type="warning"
          showIcon
          title="文档过大，已跳过逐行对比"
          description="两侧内容不一致，请直接选择「用本机版本覆盖」或「采用服务端版本」。"
        />
      ) : (
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented<Stage> options={stageOptions} value={stage} onChange={setStage} />
            <Tag color="green">+{diff.stat.additions}</Tag>
            <Tag color="red">-{diff.stat.deletions}</Tag>
            <Typography.Text type="secondary">
              左 / 上为服务端版本，右 / 下为本机版本
            </Typography.Text>

            {stage === "review" ? (
              <Segmented<DiffViewMode>
                className="ml-auto"
                options={viewOptions}
                value={viewMode}
                onChange={setViewMode}
              />
            ) : (
              <Space className="ml-auto" size={4}>
                {GLOBAL_STRATEGIES.map((strategy) => (
                  <Button key={strategy} size="small" onClick={() => onApplyGlobalStrategy(strategy)}>
                    全部{MERGE_STRATEGY_LABELS[strategy]}
                  </Button>
                ))}
                <Button
                  size="small"
                  icon={<UpOutlined />}
                  disabled={pendingCount === 0}
                  onClick={() => jumpToPending(-1)}
                >
                  上一处
                </Button>
                <Button
                  size="small"
                  icon={<DownOutlined />}
                  disabled={pendingCount === 0}
                  onClick={() => jumpToPending(1)}
                >
                  下一处
                </Button>
              </Space>
            )}
          </div>

          {stage === "review" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <MmdDiffView
                diff={diff}
                mode={viewMode}
                selectedLineIndexes={selectedLines}
                onSelectLine={handleSelectLine}
              />
            </div>
          ) : (
            <>
              {pendingCount > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  title={`还有 ${pendingCount} 处变更块待处理，处理完才能保存合并结果`}
                />
              ) : null}
              <Splitter className="min-h-0 flex-1">
                <Splitter.Panel defaultSize="58%" min="30%">
                  <div className="h-full min-h-0 overflow-auto pr-2">
                    <MmdMergeView
                      hunkStates={hunkStates}
                      selection={selection}
                      focusedHunkIndex={focusedHunkIndex}
                      onToggleLine={onToggleLine}
                      onApplyHunkStrategy={onApplyHunkStrategy}
                    />
                  </div>
                </Splitter.Panel>
                <Splitter.Panel>
                  <div className="h-full min-h-0 pl-2">
                    <MmdMergeResultPanel
                      text={mergedText}
                      isManuallyEdited={isManuallyEdited}
                      onChange={onMergedTextChange}
                    />
                  </div>
                </Splitter.Panel>
              </Splitter>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
