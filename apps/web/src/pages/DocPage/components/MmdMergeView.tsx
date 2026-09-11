import {
  type DiffLine,
  DiffLineType,
  MERGE_STRATEGY_LABELS,
  MergeStrategy,
  isSelectableLine,
  matchStrategy,
} from "@my-notes/shared";
import { Button, Checkbox, Empty, Space, Tag } from "antd";
import { memo } from "react";

import type { MergeHunkState } from "../hooks/useMmdMerge";
import { Gutter, LINE_BG } from "./MmdDiffView";

export type MmdMergeViewProps = {
  hunkStates: MergeHunkState[];
  selection: ReadonlySet<number>;
  /** 待处理块导航定位用 */
  focusedHunkIndex: number | null;
  onToggleLine: (lineIndex: number, hunkIndex: number) => void;
  onApplyHunkStrategy: (hunkIndex: number, strategy: MergeStrategy) => void;
};

const SIGN: Record<DiffLineType, string> = {
  [DiffLineType.ADD]: "+",
  [DiffLineType.REMOVE]: "-",
  [DiffLineType.CONTEXT]: " ",
};

const HUNK_STRATEGIES: MergeStrategy[] = [
  MergeStrategy.SERVER,
  MergeStrategy.LOCAL,
  MergeStrategy.BOTH,
];

const MergeLineRow = memo(function MergeLineRow({
  line,
  hunkIndex,
  accepted,
  onToggleLine,
}: {
  line: DiffLine;
  hunkIndex: number;
  accepted: boolean;
  onToggleLine: (lineIndex: number, hunkIndex: number) => void;
}) {
  const selectable = isSelectableLine(line);

  return (
    <div className={`flex items-center ${LINE_BG[line.type]} ${selectable && !accepted ? "opacity-45" : ""}`}>
      <span className="flex w-8 shrink-0 justify-center">
        <Checkbox
          checked={selectable ? accepted : true}
          disabled={!selectable}
          onChange={() => onToggleLine(line.index, hunkIndex)}
        />
      </span>
      <Gutter value={line.oldNumber} />
      <Gutter value={line.newNumber} />
      <span className="w-4 shrink-0 select-none text-center text-gray-500">{SIGN[line.type]}</span>
      <span className="whitespace-pre pr-4">{line.text || " "}</span>
    </div>
  );
});

/** 合并态：逐块处理，块内逐行勾选；上下文行恒进入结果且不可取消。 */
export const MmdMergeView = memo(function MmdMergeView({
  hunkStates,
  selection,
  focusedHunkIndex,
  onToggleLine,
  onApplyHunkStrategy,
}: MmdMergeViewProps) {
  if (hunkStates.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有需要处理的变更块" />;
  }

  return (
    <div className="overflow-auto rounded border border-solid border-gray-200 font-mono text-xs leading-6">
      {hunkStates.map(({ hunk, index, resolved }) => {
        const active = matchStrategy(hunk.lines, selection);
        return (
          <div
            key={`${hunk.header}-${index}`}
            id={`merge-hunk-${index}`}
            className={focusedHunkIndex === index ? "ring-2 ring-[#1677ff]" : undefined}
          >
            <div className="flex flex-wrap items-center gap-2 bg-[#f6f8fa] px-3 py-2">
              <span className="text-[#57606a]">{hunk.header}</span>
              <Tag color={resolved ? "success" : "warning"}>{resolved ? "已处理" : "待处理"}</Tag>
              <Space className="ml-auto" size={4}>
                {HUNK_STRATEGIES.map((strategy) => (
                  <Button
                    key={strategy}
                    size="small"
                    type={active === strategy ? "primary" : "default"}
                    onClick={() => onApplyHunkStrategy(index, strategy)}
                  >
                    {MERGE_STRATEGY_LABELS[strategy]}
                  </Button>
                ))}
              </Space>
            </div>
            {hunk.lines.map((line) => (
              <MergeLineRow
                key={line.index}
                line={line}
                hunkIndex={index}
                accepted={selection.has(line.index)}
                onToggleLine={onToggleLine}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});
