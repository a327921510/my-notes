import { Empty, Typography } from "antd";
import { memo } from "react";

import { type DiffHunk, type DiffLine, DiffLineType, type TextDiffResult } from "@my-notes/shared";

export type DiffViewMode = "unified" | "split";

export type UnifiedDiffViewProps = {
  diff: TextDiffResult;
  mode: DiffViewMode;
};

const LINE_BG: Record<DiffLineType, string> = {
  [DiffLineType.ADD]: "bg-[#e6ffec]",
  [DiffLineType.REMOVE]: "bg-[#ffebe9]",
  [DiffLineType.CONTEXT]: "bg-white",
};

const SIGN: Record<DiffLineType, string> = {
  [DiffLineType.ADD]: "+",
  [DiffLineType.REMOVE]: "-",
  [DiffLineType.CONTEXT]: " ",
};

function Gutter({ value }: { value: number | null }) {
  return <span className="w-12 shrink-0 select-none pr-2 text-right text-gray-400">{value ?? ""}</span>;
}

const UnifiedRow = memo(function UnifiedRow({ line }: { line: DiffLine }) {
  return (
    <div className={`flex ${LINE_BG[line.type]}`}>
      <Gutter value={line.oldNumber} />
      <Gutter value={line.newNumber} />
      <span className="w-4 shrink-0 select-none text-center text-gray-500">{SIGN[line.type]}</span>
      <span className="whitespace-pre pr-4">{line.text || " "}</span>
    </div>
  );
});

type SplitRow = { left: DiffLine | null; right: DiffLine | null };

function buildSplitRows(hunk: DiffHunk): SplitRow[] {
  const rows: SplitRow[] = [];
  let pendingRemoves: DiffLine[] = [];
  let pendingAdds: DiffLine[] = [];

  const flush = () => {
    const max = Math.max(pendingRemoves.length, pendingAdds.length);
    for (let i = 0; i < max; i += 1) {
      rows.push({ left: pendingRemoves[i] ?? null, right: pendingAdds[i] ?? null });
    }
    pendingRemoves = [];
    pendingAdds = [];
  };

  for (const line of hunk.lines) {
    if (line.type === DiffLineType.CONTEXT) {
      flush();
      rows.push({ left: line, right: line });
    } else if (line.type === DiffLineType.REMOVE) {
      pendingRemoves.push(line);
    } else {
      pendingAdds.push(line);
    }
  }
  flush();
  return rows;
}

function SplitCell({ line, side }: { line: DiffLine | null; side: "old" | "new" }) {
  if (!line) {
    return <div className="flex flex-1 bg-gray-50/60" />;
  }
  const number = side === "old" ? line.oldNumber : line.newNumber;
  return (
    <div className={`flex min-w-0 flex-1 ${LINE_BG[line.type]}`}>
      <Gutter value={number} />
      <span className="whitespace-pre pr-4">{line.text || " "}</span>
    </div>
  );
}

const SplitRowView = memo(function SplitRowView({ row }: { row: SplitRow }) {
  return (
    <div className="flex">
      <SplitCell line={row.left} side="old" />
      <div className="w-px shrink-0 bg-gray-200" />
      <SplitCell line={row.right} side="new" />
    </div>
  );
});

export const UnifiedDiffView = memo(function UnifiedDiffView({ diff, mode }: UnifiedDiffViewProps) {
  if (diff.truncated) {
    return <Empty description="文件过大，已跳过逐行对比" />;
  }
  if (diff.identical || diff.hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Typography.Text type="secondary">两端内容一致，无差异</Typography.Text>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded border border-solid border-gray-200 font-mono text-xs leading-5">
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={`${hunk.header}-${hunkIndex}`}>
          <div className="bg-[#f6f8fa] px-3 py-1 text-[#57606a]">{hunk.header}</div>
          {mode === "unified"
            ? hunk.lines.map((line, index) => <UnifiedRow key={index} line={line} />)
            : buildSplitRows(hunk).map((row, index) => <SplitRowView key={index} row={row} />)}
        </div>
      ))}
    </div>
  );
});
