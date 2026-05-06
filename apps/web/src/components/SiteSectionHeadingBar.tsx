import { memo } from "react";

export type SiteSectionHeadingBarProps = {
  text: string;
  /** 与上方其它来源数据区分（列表非首条时出现顶部分割） */
  showTopDivider: boolean;
};

/** 站点分组标题：独立于条目行，贴在分组首条上方 */
export const SiteSectionHeadingBar = memo(function SiteSectionHeadingBar({
  text,
  showTopDivider,
}: SiteSectionHeadingBarProps) {
  return (
    <div
      className={
        showTopDivider
          ? "border-t border-gray-100 px-2 pb-1 pt-3 text-sm leading-snug text-gray-600"
          : "px-2 pb-1 pt-2 text-sm leading-snug text-gray-600"
      }
    >
      {text}
    </div>
  );
});
