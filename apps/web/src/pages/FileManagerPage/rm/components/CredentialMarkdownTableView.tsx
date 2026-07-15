import { memo, useCallback } from "react";

import { markdownCellToPlain } from "../utils/markdownCellToPlain";
import {
  CREDENTIAL_TABLE_HEADERS,
  findTableColumnIndex,
} from "../utils/rmTableHeaders";

import { MarkdownTablePlainCell } from "./MarkdownTablePlainCell";
import { ProjectMarkdownAntTable } from "./ProjectMarkdownAntTable";
import { ProjectMarkdownPathCell } from "./ProjectMarkdownPathCell";

export type CredentialMarkdownTableViewProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
};

export const CredentialMarkdownTableView = memo(function CredentialMarkdownTableView({
  header,
  body,
  onCopyCell,
}: CredentialMarkdownTableViewProps) {
  const addressCol = findTableColumnIndex(header, CREDENTIAL_TABLE_HEADERS[0]);
  const accountCol = findTableColumnIndex(header, CREDENTIAL_TABLE_HEADERS[1]);
  const passwordCol = findTableColumnIndex(header, CREDENTIAL_TABLE_HEADERS[2]);

  const renderCell = useCallback(
    (raw: string, colIndex: number) => {
      const plain = markdownCellToPlain(raw);
      if (colIndex === addressCol) {
        return <ProjectMarkdownPathCell text={plain} />;
      }
      if (colIndex === accountCol || colIndex === passwordCol) {
        return <MarkdownTablePlainCell text={plain} />;
      }
      return <MarkdownTablePlainCell text={plain || "—"} />;
    },
    [addressCol, accountCol, passwordCol],
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
