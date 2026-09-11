import { type DiffHunk, type DiffLine, DiffLineType, type TextDiffResult } from "@my-notes/shared";
import { Empty, Typography } from "antd";
import { memo } from "react";

export type DiffViewMode = "unified" | "split";

export type MmdDiffViewProps = {
  diff: TextDiffResult;
  mode: DiffViewMode;
  selectedLineIndexes: number[];
  onSelectLine: (index: number, withShift: boolean) => void;
};

export const LINE_BG: Record<DiffLineType, string> = {
  [DiffLineType.ADD]: "bg-[#e6ffec]",
  [DiffLineType.REMOVE]: "bg-[#ffebe9]",
  [DiffLineType.CONTEXT]: "bg-white",
};

const SIGN: Record<DiffLineType, string> = {
  [DiffLineType.ADD]: "+",
  [DiffLineType.REMOVE]: "-",
  [DiffLineType.CONTEXT]: " ",
};

export const Gutter = memo(function Gutter({
  value,
  onClick,
}: {
  value: number | null;
  onClick?: (event: React.MouseEvent) => void;
}) {
  return (
    <span
      className={`w-12 shrink-0 select-none pr-2 text-right text-gray-400 ${onClick ? "cursor-pointer hover:bg-[#dbeafe]" : ""}`}
      onClick={onClick}
    >
      {value ?? ""}
    </span>
  );
});

const UnifiedRow = memo(function UnifiedRow({
  line,
  selected,
  onSelectLine,
}: {
  line: DiffLine;
  selected: boolean;
  onSelectLine: (index: number, withShift: boolean) => void;
}) {
  const handleGutterClick = (event: React.MouseEvent) => onSelectLine(line.index, event.shiftKey);

  return (
    <div className={`flex ${selected ? "bg-[#fff8c5]" : LINE_BG[line.type]}`}>
      <Gutter value={line.oldNumber} onClick={handleGutterClick} />
      <Gutter value={line.newNumber} onClick={handleGutterClick} />
      <span className="w-4 shrink-0 select-none text-center text-gray-500">{SIGN[line.type]}</span>
      <span className="whitespace-pre pr-4">{line.text || " "}</span>
    </div>
  );
});

type SplitRow = { left: DiffLine | null; right: DiffLine | null };

/** 删行与增行左右配对；上下文行两侧同行。 */
export function buildSplitRows(hunk: DiffHunk): SplitRow[] {
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

const SplitCell = memo(function SplitCell({
  line,
  side,
  selected,
  onSelectLine,
}: {
  line: DiffLine | null;
  side: "old" | "new";
  selected: boolean;
  onSelectLine: (index: number, withShift: boolean) => void;
}) {
  if (!line) return <div className="flex flex-1 bg-gray-50/60" />;

  const number = side === "old" ? line.oldNumber : line.newNumber;
  return (
    <div className={`flex min-w-0 flex-1 ${selected ? "bg-[#fff8c5]" : LINE_BG[line.type]}`}>
      <Gutter value={number} onClick={(event) => onSelectLine(line.index, event.shiftKey)} />
      <span className="whitespace-pre pr-4">{line.text || " "}</span>
    </div>
  );
});

/** 只读逐行 diff：左 / 上为服务端版本，右 / 下为本机版本。 */
export const MmdDiffView = memo(function MmdDiffView({
  diff,
  mode,
  selectedLineIndexes,
  onSelectLine,
}: MmdDiffViewProps) {
  if (diff.truncated) {
    return <Empty description="文档过大，已跳过逐行对比" />;
  }
  if (diff.identical || diff.hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Typography.Text type="secondary">两侧内容一致，无差异</Typography.Text>
      </div>
    );
  }

  const selected = new Set(selectedLineIndexes);

  return (
    <div className="overflow-auto rounded border border-solid border-gray-200 font-mono text-xs leading-5">
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={`${hunk.header}-${hunkIndex}`}>
          <div className="bg-[#f6f8fa] px-3 py-1 text-[#57606a]">{hunk.header}</div>
          {mode === "unified"
            ? hunk.lines.map((line) => (
                <UnifiedRow
                  key={line.index}
                  line={line}
                  selected={selected.has(line.index)}
                  onSelectLine={onSelectLine}
                />
              ))
            : buildSplitRows(hunk).map((row, index) => (
                <div className="flex" key={index}>
                  <SplitCell
                    line={row.left}
                    side="old"
                    selected={row.left !== null && selected.has(row.left.index)}
                    onSelectLine={onSelectLine}
                  />
                  <div className="w-px shrink-0 bg-gray-200" />
                  <SplitCell
                    line={row.right}
                    side="new"
                    selected={row.right !== null && selected.has(row.right.index)}
                    onSelectLine={onSelectLine}
                  />
                </div>
              ))}
        </div>
      ))}
    </div>
  );
});
