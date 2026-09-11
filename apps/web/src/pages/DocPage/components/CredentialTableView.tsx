import { CREDENTIAL_TABLE_HEADER, mapCredentialCellToPlain } from "@my-notes/shared";
import { memo, useCallback } from "react";

export type CredentialTableViewProps = {
  header: string[];
  body: string[][];
  onCopyCell: (text: string) => void;
};

/** 账号与密码列强制纯文本，避免链接语法被渲染后误点。 */
const PLAIN_ONLY_COLUMNS = new Set([1, 2]);

const CopyableCell = memo(function CopyableCell({
  text,
  asLink,
  onCopy,
}: {
  text: string;
  asLink: boolean;
  onCopy: (text: string) => void;
}) {
  const handleClick = useCallback(() => onCopy(text), [onCopy, text]);

  return (
    <td
      className="cursor-pointer border border-solid border-[#f0f0f0] px-3 py-2 align-top transition-colors hover:bg-[#e6f4ff]"
      title="点击复制"
      onClick={handleClick}
    >
      {asLink && /^https?:\/\//i.test(text) ? (
        <a href={text} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {text}
        </a>
      ) : (
        <span className="whitespace-pre-wrap break-all">{text || " "}</span>
      )}
    </td>
  );
});

export const CredentialTableView = memo(function CredentialTableView({
  header,
  body,
  onCopyCell,
}: CredentialTableViewProps) {
  return (
    <div className="my-3 overflow-auto rounded-lg border border-solid border-[#91caff]">
      <div className="bg-[#e6f4ff] px-3 py-1 text-xs text-[#0958d9]">凭据表 · 单元格点击即复制</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#fafafa]">
            {header.map((cell, index) => (
              <th key={`${cell}-${index}`} className="border border-solid border-[#f0f0f0] px-3 py-2 text-left">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {header.map((_column, columnIndex) => {
                const raw = row[columnIndex] ?? "";
                const plain = mapCredentialCellToPlain(raw);
                return (
                  <CopyableCell
                    key={columnIndex}
                    text={plain}
                    asLink={!PLAIN_ONLY_COLUMNS.has(columnIndex) && columnIndex === 0}
                    onCopy={onCopyCell}
                  />
                );
              })}
            </tr>
          ))}
          {body.length === 0 ? (
            <tr>
              <td
                className="border border-solid border-[#f0f0f0] px-3 py-4 text-center text-[#8c8c8c]"
                colSpan={CREDENTIAL_TABLE_HEADER.length}
              >
                暂无记录
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
});
