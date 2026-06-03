import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import clsx from "clsx";
import { memo, useCallback, useMemo, type ReactNode } from "react";

import { markdownCellToPlain } from "../utils/markdownCellToPlain";
import { normalizeTableHeaderCell } from "../utils/splitMarkdownTableRow";

import styles from "./ProjectMarkdownAntTable.module.less";

const INTERACTIVE_CELL_SELECTOR = "a, button, [role='button']";

export type ProjectMarkdownAntTableProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
  renderCell: (raw: string, colIndex: number) => ReactNode;
};

type MarkdownTableRow = {
  key: string;
  cells: string[];
};

export const ProjectMarkdownAntTable = memo(function ProjectMarkdownAntTable({
  header,
  body,
  onCopyCell,
  renderCell,
}: ProjectMarkdownAntTableProps) {
  const dataSource = useMemo<MarkdownTableRow[]>(
    () =>
      body.map((row, rowIndex) => ({
        key: String(rowIndex),
        cells: header.map((_, colIndex) => row[colIndex] ?? ""),
      })),
    [body, header],
  );

  const handleCellClick = useCallback(
    (raw: string, event: React.MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(INTERACTIVE_CELL_SELECTOR)) return;
      onCopyCell(markdownCellToPlain(raw));
    },
    [onCopyCell],
  );

  const columns = useMemo<ColumnsType<MarkdownTableRow>>(
    () =>
      header.map((title, colIndex) => ({
        title: normalizeTableHeaderCell(title),
        key: String(colIndex),
        render: (_value: unknown, record: MarkdownTableRow) =>
          renderCell(record.cells[colIndex] ?? "", colIndex),
        onCell: (record: MarkdownTableRow) => ({
          className: styles.clickableCell,
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            handleCellClick(record.cells[colIndex] ?? "", event);
          },
        }),
      })),
    [header, renderCell, handleCellClick],
  );

  return (
    <div className={clsx(styles.wrapper)}>
      <Table<MarkdownTableRow>
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: "max-content" }}
      />
    </div>
  );
});
