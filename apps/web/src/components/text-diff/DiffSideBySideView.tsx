import { Typography } from "antd";
import { memo, useMemo } from "react";

import type { DiffHunk, DiffLine } from "@my-notes/shared";

function leftCellClass(kind: DiffLine["kind"]): string {
  if (kind === "delete") return "bg-[#fff1f0]";
  if (kind === "add") return "bg-[#fafafa]";
  return "";
}

function rightCellClass(kind: DiffLine["kind"]): string {
  if (kind === "add") return "bg-[#f6ffed]";
  if (kind === "delete") return "bg-[#fafafa]";
  return "";
}

type PairRow = {
  left?: DiffLine;
  right?: DiffLine;
};

/** 将 unified hunk 行配对成并排左右列（delete/add 对齐，context 同行） */
function pairHunkLines(lines: DiffLine[]): PairRow[] {
  const rows: PairRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.kind === "context") {
      rows.push({ left: line, right: line });
      i += 1;
      continue;
    }
    if (line.kind === "delete") {
      const deletes: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === "delete") {
        deletes.push(lines[i]);
        i += 1;
      }
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === "add") {
        adds.push(lines[i]);
        i += 1;
      }
      const max = Math.max(deletes.length, adds.length);
      for (let k = 0; k < max; k += 1) {
        rows.push({ left: deletes[k], right: adds[k] });
      }
      continue;
    }
    // 纯 add（前面没有同组 delete）
    rows.push({ right: line });
    i += 1;
  }
  return rows;
}

export type DiffSideBySideViewProps = {
  hunks: DiffHunk[];
};

export const DiffSideBySideView = memo(function DiffSideBySideView({
  hunks,
}: DiffSideBySideViewProps) {
  const sections = useMemo(
    () =>
      hunks.map((hunk, index) => ({
        index,
        header: `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`,
        rows: pairHunkLines(hunk.lines),
      })),
    [hunks],
  );

  if (hunks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d9d9d9] p-6 text-center text-[#8c8c8c]">
        无差异
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div
          key={section.header + String(section.index)}
          className="overflow-hidden rounded-lg border border-[#f0f0f0] bg-white"
        >
          <div className="border-b border-[#f0f0f0] bg-[#fafafa] px-3 py-2">
            <Typography.Text code className="text-xs">
              {section.header}
            </Typography.Text>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[#f0f0f0] font-mono text-xs leading-5">
            <div className="min-w-0">
              {section.rows.map((row, idx) => (
                <div
                  key={`l-${idx}`}
                  className={`flex min-h-5 whitespace-pre-wrap break-all px-2 ${leftCellClass(row.left?.kind ?? "add")}`}
                >
                  <span className="w-8 shrink-0 select-none text-right text-[10px] text-[#8c8c8c]">
                    {row.left?.oldLine ?? ""}
                  </span>
                  <span className="pl-2 text-[#262626]">{row.left?.text ?? ""}</span>
                </div>
              ))}
            </div>
            <div className="min-w-0">
              {section.rows.map((row, idx) => (
                <div
                  key={`r-${idx}`}
                  className={`flex min-h-5 whitespace-pre-wrap break-all px-2 ${rightCellClass(row.right?.kind ?? "delete")}`}
                >
                  <span className="w-8 shrink-0 select-none text-right text-[10px] text-[#8c8c8c]">
                    {row.right?.newLine ?? ""}
                  </span>
                  <span className="pl-2 text-[#262626]">{row.right?.text ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});
