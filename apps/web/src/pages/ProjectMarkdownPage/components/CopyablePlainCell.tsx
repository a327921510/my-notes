import { memo } from "react";

export type CopyablePlainCellProps = {
  displayText: string;
  copyText: string;
  onCopy: (text: string) => void;
};

export const CopyablePlainCell = memo(function CopyablePlainCell({
  displayText,
  copyText,
  onCopy,
}: CopyablePlainCellProps) {
  const showEmptyHint = displayText.length === 0;
  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded px-1.5 py-0.5 transition-colors hover:bg-black/6"
      onClick={() => {
        onCopy(copyText);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCopy(copyText);
        }
      }}
    >
      {showEmptyHint ? (
        <span className="text-[#bfbfbf]">（空）</span>
      ) : (
        <span className="break-all">{displayText}</span>
      )}
    </span>
  );
});
