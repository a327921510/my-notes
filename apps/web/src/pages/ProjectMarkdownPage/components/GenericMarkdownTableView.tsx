import { memo, useCallback } from "react";

import { MarkdownTableLinkCell } from "./MarkdownTableLinkCell";
import { ProjectMarkdownAntTable } from "./ProjectMarkdownAntTable";

export type GenericMarkdownTableViewProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
};

/** 无特殊表头规则的 GFM 管道表 → Ant Design Table */
export const GenericMarkdownTableView = memo(function GenericMarkdownTableView({
  header,
  body,
  onCopyCell,
}: GenericMarkdownTableViewProps) {
  const renderCell = useCallback(
    (raw: string) => <MarkdownTableLinkCell raw={raw} />,
    [],
  );

  return (
    <ProjectMarkdownAntTable
      header={header}
      body={body}
      onCopyCell={onCopyCell}
      renderCell={renderCell}
    />
  );
});
