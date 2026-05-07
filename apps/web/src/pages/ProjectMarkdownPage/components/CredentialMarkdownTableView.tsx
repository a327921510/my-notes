import { memo } from "react";

import { markdownCellToPlain } from "../utils/markdownCellToPlain";
import { normalizeTableHeaderCell } from "../utils/splitMarkdownTableRow";
import { CopyablePlainCell } from "./CopyablePlainCell";

export type CredentialMarkdownTableViewProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
};

const ACCOUNT_COL = 1;
const PASSWORD_COL = 2;

export const CredentialMarkdownTableView = memo(function CredentialMarkdownTableView({
  header,
  body,
  onCopyCell,
}: CredentialMarkdownTableViewProps) {
  return (
    <div className="my-4 overflow-x-auto rounded border border-[#f0f0f0]">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
            {header.map((h, idx) => (
              <th key={idx} className="border-r border-[#f0f0f0] px-3 py-2 font-semibold text-[#262626] last:border-r-0">
                {normalizeTableHeaderCell(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-b border-[#f0f0f0] last:border-b-0">
              {header.map((_, ci) => {
                const raw = row[ci] ?? "";
                const plain = markdownCellToPlain(raw);
                const isCopyCol = ci === ACCOUNT_COL || ci === PASSWORD_COL;
                return (
                  <td
                    key={ci}
                    className="border-r border-[#f0f0f0] px-3 py-2 align-top text-[#595959] last:border-r-0"
                  >
                    {isCopyCol ? (
                      <CopyablePlainCell displayText={plain} copyText={plain} onCopy={onCopyCell} />
                    ) : (
                      <span className="break-all">{plain || "—"}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
