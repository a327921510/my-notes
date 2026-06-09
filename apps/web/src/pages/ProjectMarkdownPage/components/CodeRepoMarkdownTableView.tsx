import { memo, useCallback, useMemo } from "react";

import { markdownCellToPlain } from "../utils/markdownCellToPlain";
import { parseMarkdownCellLink } from "../utils/parseMarkdownCellLink";
import { CODE_REPO_TABLE_HEADERS } from "../utils/projectMarkdownTableHeaders";
import { normalizeTableHeaderCell } from "../utils/splitMarkdownTableRow";
import { isLocalAbsolutePath, normalizeLocalPath } from "../utils/windowsPath";

import { MarkdownTableLinkCell } from "./MarkdownTableLinkCell";
import { MarkdownTablePlainCell } from "./MarkdownTablePlainCell";
import { ProjectMarkdownAntTable } from "./ProjectMarkdownAntTable";
import { WindowsPathLink } from "./WindowsPathLink";

export type CodeRepoMarkdownTableViewProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
};

type CodeRepoColumnKind = "domain" | "repo" | "localPath" | "remark" | "extra";

function resolveColumnKind(header: string[], colIndex: number): CodeRepoColumnKind {
  const name = normalizeTableHeaderCell(header[colIndex] ?? "");
  if (name === CODE_REPO_TABLE_HEADERS[0]) return "domain";
  if (name === CODE_REPO_TABLE_HEADERS[1]) return "repo";
  if (name === CODE_REPO_TABLE_HEADERS[2]) return "localPath";
  if (name === CODE_REPO_TABLE_HEADERS[3]) return "remark";
  return "extra";
}

function resolvePathFromCell(raw: string): string | null {
  const link = parseMarkdownCellLink(raw);
  const candidate = link?.href ?? markdownCellToPlain(raw);
  if (!candidate || !isLocalAbsolutePath(candidate)) return null;
  return normalizeLocalPath(candidate);
}

type CodeRepoTableCellProps = {
  raw: string;
  kind: CodeRepoColumnKind;
};

const CodeRepoTableCell = memo(function CodeRepoTableCell({ raw, kind }: CodeRepoTableCellProps) {
  if (kind === "domain" || kind === "repo") {
    return <MarkdownTableLinkCell raw={raw} />;
  }

  if (kind === "localPath") {
    const winPath = resolvePathFromCell(raw);
    if (winPath) {
      const display = markdownCellToPlain(raw);
      return <WindowsPathLink path={winPath}>{display || winPath}</WindowsPathLink>;
    }
    return <MarkdownTablePlainCell text={markdownCellToPlain(raw)} />;
  }

  const plain = markdownCellToPlain(raw);
  return <MarkdownTablePlainCell text={plain || "—"} />;
});

export const CodeRepoMarkdownTableView = memo(function CodeRepoMarkdownTableView({
  header,
  body,
  onCopyCell,
}: CodeRepoMarkdownTableViewProps) {
  const columnKinds = useMemo(
    () => header.map((_, idx) => resolveColumnKind(header, idx)),
    [header],
  );

  const renderCell = useCallback(
    (raw: string, colIndex: number) => (
      <CodeRepoTableCell raw={raw} kind={columnKinds[colIndex] ?? "extra"} />
    ),
    [columnKinds],
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
