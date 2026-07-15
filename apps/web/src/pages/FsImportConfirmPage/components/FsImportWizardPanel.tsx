import { Button, Collapse, Empty, Radio, Segmented, Space, Typography } from "antd";
import { memo, useMemo, useState, type ReactNode } from "react";

import { DiffHunkList, DiffSideBySideView } from "@/components/text-diff";
import type { ImportWizardState } from "@/services/fsBackup";
import { computeTextDiff, type HunkResolution } from "@my-notes/shared";

export type FsImportWizardPanelProps = {
  wizard: ImportWizardState;
  applying: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  onConflictResolve: (path: string, hunkIndex: number, resolution: HunkResolution) => void;
  onAllConflictsKeepLeft: () => void;
  onAllConflictsKeepRight: () => void;
  onLocalOnlyAction: (path: string, action: "keep" | "delete") => void;
  onAllLocalOnly: (action: "keep" | "delete") => void;
};

type ConflictViewMode = "unified" | "side-by-side";

export const FsImportWizardPanel = memo(function FsImportWizardPanel({
  wizard,
  applying,
  onCancel,
  onConfirm,
  onConflictResolve,
  onAllConflictsKeepLeft,
  onAllConflictsKeepRight,
  onLocalOnlyAction,
  onAllLocalOnly,
}: FsImportWizardPanelProps) {
  const { plan, conflictResolutions, localOnlyActions } = wizard;
  /** 三大块默认全部收缩 */
  const [sectionKeys, setSectionKeys] = useState<string[]>([]);
  /** 各冲突文件内的对比模式 */
  const [conflictViewByPath, setConflictViewByPath] = useState<Record<string, ConflictViewMode>>(
    {},
  );

  const conflictItems = useMemo(
    () =>
      plan.conflicts.map((c) => {
        const diff = computeTextDiff(c.localContent, c.incomingContent);
        return { conflict: c, diff };
      }),
    [plan.conflicts],
  );

  const summary = [
    `新增 ${plan.toCreate.length}`,
    `冲突 ${plan.conflicts.length}`,
    `仅本地 ${plan.localOnly.length}`,
    `相同跳过 ${plan.unchangedCount}`,
  ].join(" · ");

  const sectionItems = useMemo(() => {
    const items: {
      key: string;
      label: ReactNode;
      children: ReactNode;
      extra?: ReactNode;
    }[] = [];

    items.push({
      key: "added",
      label: `新增（${plan.toCreate.length}）`,
      children:
        plan.toCreate.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无新增文件" />
        ) : (
          <ul className="m-0 max-h-[min(360px,40vh)] list-disc overflow-auto pl-5 text-sm text-[#595959]">
            {plan.toCreate.map((f) => (
              <li key={f.path} className="font-mono text-xs">
                {f.path}
                <Typography.Text type="secondary" className="ml-2 text-xs">
                  ({f.kind})
                </Typography.Text>
              </li>
            ))}
          </ul>
        ),
    });

    items.push({
      key: "conflicts",
      label: `冲突（${plan.conflicts.length}）`,
      extra: plan.conflicts.length > 0 ? (
        <Space
          wrap
          size={8}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button size="small" onClick={onAllConflictsKeepLeft}>
            全部保留本地
          </Button>
          <Button size="small" onClick={onAllConflictsKeepRight}>
            全部保留导入
          </Button>
        </Space>
      ) : undefined,
      children:
        plan.conflicts.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无内容冲突" />
        ) : (
          <Collapse
            ghost
            defaultActiveKey={[]}
            items={conflictItems.map(({ conflict, diff }) => {
              const viewMode = conflictViewByPath[conflict.path] ?? "side-by-side";
              return {
                key: conflict.path,
                label: (
                  <span className="font-mono text-xs">
                    {conflict.path}
                    {diff.identical
                      ? "（规范化后无差异）"
                      : ` · ${diff.hunks.length} hunk`}
                  </span>
                ),
                children: diff.identical ? (
                  <Empty description="内容在规范化换行后一致，确认导入时将写入导入侧" />
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Typography.Text type="secondary" className="text-xs">
                        左 = 本地（base），右 = 导入（incoming）
                      </Typography.Text>
                      <Segmented<ConflictViewMode>
                        size="small"
                        value={viewMode}
                        onChange={(v) =>
                          setConflictViewByPath((prev) => ({
                            ...prev,
                            [conflict.path]: v,
                          }))
                        }
                        options={[
                          { label: "左右对比", value: "side-by-side" },
                          { label: "Unified 裁决", value: "unified" },
                        ]}
                      />
                    </div>
                    {viewMode === "side-by-side" ? (
                      <>
                        <DiffSideBySideView hunks={diff.hunks} />
                        <Typography.Text type="secondary" className="text-xs">
                          按 hunk 裁决请切换到「Unified 裁决」；未操作的 hunk 默认保留导入侧。
                        </Typography.Text>
                      </>
                    ) : (
                      <DiffHunkList
                        hunks={diff.hunks}
                        resolutions={conflictResolutions[conflict.path] ?? {}}
                        onResolve={(hunkIndex, resolution) => {
                          onConflictResolve(conflict.path, hunkIndex, resolution);
                        }}
                      />
                    )}
                  </div>
                ),
              };
            })}
          />
        ),
    });

    items.push({
      key: "localOnly",
      label: `仅本地（${plan.localOnly.length}）`,
      extra: plan.localOnly.length > 0 ? (
        <Space
          wrap
          size={8}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Button size="small" onClick={() => onAllLocalOnly("keep")}>
            全部保留
          </Button>
          <Button size="small" danger onClick={() => onAllLocalOnly("delete")}>
            全部标记删除
          </Button>
        </Space>
      ) : undefined,
      children:
        plan.localOnly.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无仅本地文件" />
        ) : (
          <div className="max-h-[min(360px,40vh)] overflow-auto rounded border border-[#f0f0f0]">
            {plan.localOnly.map((item) => (
              <div
                key={item.path}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f5f5f5] px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1 font-mono text-xs">{item.path}</span>
                <Radio.Group
                  size="small"
                  optionType="button"
                  value={localOnlyActions[item.path] ?? "keep"}
                  onChange={(e) =>
                    onLocalOnlyAction(item.path, e.target.value as "keep" | "delete")
                  }
                  options={[
                    { label: "保留", value: "keep" },
                    { label: "删除", value: "delete" },
                  ]}
                />
              </div>
            ))}
          </div>
        ),
    });

    return items;
  }, [
    plan,
    conflictItems,
    conflictResolutions,
    conflictViewByPath,
    localOnlyActions,
    onAllConflictsKeepLeft,
    onAllConflictsKeepRight,
    onAllLocalOnly,
    onConflictResolve,
    onLocalOnlyAction,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 rounded-lg border border-[#f0f0f0] bg-white p-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2">
        <Typography.Text type="secondary">{summary}</Typography.Text>
        <Space wrap>
          <Button onClick={onCancel} disabled={applying}>
            取消
          </Button>
          <Button type="primary" loading={applying} onClick={() => void onConfirm()}>
            确认导入
          </Button>
        </Space>
      </div>

      {plan.toCreate.length === 0 &&
      plan.conflicts.length === 0 &&
      plan.localOnly.length === 0 ? (
        <Empty description="没有需要写入的变更" />
      ) : (
        <Collapse
          className="min-h-0 flex-1 overflow-auto"
          activeKey={sectionKeys}
          onChange={(keys) => setSectionKeys(keys as string[])}
          items={sectionItems}
        />
      )}
    </div>
  );
});
