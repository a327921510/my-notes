import { Input, Radio, Typography } from "antd";
import { memo, useMemo } from "react";

import type { DiffHunk, DiffLine, HunkResolution } from "@my-notes/shared";

function lineClass(kind: DiffLine["kind"]): string {
  if (kind === "delete") return "bg-[#fff1f0] text-[#a8071a]";
  if (kind === "add") return "bg-[#f6ffed] text-[#237804]";
  return "bg-transparent text-[#262626]";
}

function linePrefix(kind: DiffLine["kind"]): string {
  if (kind === "delete") return "-";
  if (kind === "add") return "+";
  return " ";
}

export type DiffHunkListProps = {
  hunks: DiffHunk[];
  resolutions: Record<number, HunkResolution>;
  onResolve: (hunkIndex: number, resolution: HunkResolution) => void;
};

export const DiffHunkList = memo(function DiffHunkList({
  hunks,
  resolutions,
  onResolve,
}: DiffHunkListProps) {
  if (hunks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d9d9d9] p-6 text-center text-[#8c8c8c]">
        无差异 hunk
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hunks.map((hunk, index) => (
        <HunkCard
          key={`${hunk.oldStart}-${hunk.newStart}-${index}`}
          index={index}
          hunk={hunk}
          resolution={resolutions[index] ?? { mode: "keepRight" }}
          onResolve={onResolve}
        />
      ))}
    </div>
  );
});

type HunkCardProps = {
  index: number;
  hunk: DiffHunk;
  resolution: HunkResolution;
  onResolve: (hunkIndex: number, resolution: HunkResolution) => void;
};

const HunkCard = memo(function HunkCard({
  index,
  hunk,
  resolution,
  onResolve,
}: HunkCardProps) {
  const mode = resolution.mode;
  const editText = resolution.mode === "edit" ? resolution.text : "";

  const defaultEditSeed = useMemo(() => {
    // 编辑默认种子：右侧（incoming）块内容，便于在其上微调
    return hunk.lines
      .filter((l) => l.kind === "context" || l.kind === "add")
      .map((l) => l.text)
      .join("\n");
  }, [hunk.lines]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#f0f0f0] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
        <Typography.Text code className="text-xs">
          @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
        </Typography.Text>
        <Radio.Group
          size="small"
          value={mode}
          onChange={(e) => {
            const next = e.target.value as HunkResolution["mode"];
            if (next === "edit") {
              onResolve(index, {
                mode: "edit",
                text: editText || defaultEditSeed,
              });
              return;
            }
            onResolve(index, { mode: next });
          }}
          options={[
            { label: "保留左", value: "keepLeft" },
            { label: "保留右", value: "keepRight" },
            { label: "编辑", value: "edit" },
          ]}
          optionType="button"
        />
      </div>
      <pre className="m-0 max-h-64 overflow-auto p-0 font-mono text-xs leading-5">
        {hunk.lines.map((line, lineIdx) => (
          <div
            key={`${line.kind}-${line.oldLine ?? ""}-${line.newLine ?? ""}-${lineIdx}`}
            className={`flex whitespace-pre-wrap break-all px-3 ${lineClass(line.kind)}`}
          >
            <span className="w-4 shrink-0 select-none opacity-70">{linePrefix(line.kind)}</span>
            <span className="w-10 shrink-0 select-none text-right text-[10px] text-[#8c8c8c]">
              {line.oldLine ?? ""}
            </span>
            <span className="w-10 shrink-0 select-none text-right text-[10px] text-[#8c8c8c]">
              {line.newLine ?? ""}
            </span>
            <span className="pl-2">{line.text}</span>
          </div>
        ))}
      </pre>
      {mode === "edit" ? (
        <div className="border-t border-[#f0f0f0] p-3">
          <Typography.Text type="secondary" className="mb-1 block text-xs">
            手工替换本 hunk（可多行）
          </Typography.Text>
          <Input.TextArea
            value={editText}
            onChange={(e) => onResolve(index, { mode: "edit", text: e.target.value })}
            autoSize={{ minRows: 3, maxRows: 10 }}
            className="font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );
});
