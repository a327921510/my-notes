import { memo } from "react";

export type SiteMarkdownEntryLineProps = {
  name: string;
  value: string;
  onCopyValue: (text: string) => void;
};

export const SiteMarkdownEntryLine = memo(function SiteMarkdownEntryLine({
  name,
  value,
  onCopyValue,
}: SiteMarkdownEntryLineProps) {
  const hasValue = value.length > 0;
  return (
    <div className="my-3 flex flex-wrap items-baseline gap-2 border-b border-[#f0f0f0] pb-2 last:mb-0">
      <span className="shrink-0 font-semibold text-[#262626]">{name}</span>
      <span
        role="button"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-pointer rounded px-1.5 py-0.5 text-[#595959] transition-colors hover:bg-black/6"
        onClick={() => {
          onCopyValue(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCopyValue(value);
          }
        }}
      >
        {hasValue ? value : <span className="text-[#bfbfbf]">（空，点击仍复制）</span>}
      </span>
    </div>
  );
});
