import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { parseSiteMarkdownToBlocks } from "../utils/parseSiteMarkdownBlocks";
import { SiteMarkdownEntryLine } from "./SiteMarkdownEntryLine";

export type SiteMarkdownReadViewProps = {
  source: string;
  onCopyEntryValue: (text: string) => void;
};

export const SiteMarkdownReadView = memo(function SiteMarkdownReadView({
  source,
  onCopyEntryValue,
}: SiteMarkdownReadViewProps) {
  const blocks = useMemo(() => parseSiteMarkdownToBlocks(source), [source]);

  if (!source.trim()) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-[#bfbfbf]">
        暂无文档内容，请切换到「编辑」撰写 Markdown。
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto pr-1">
      {blocks.map((block, idx) => {
        if (block.type === "entry") {
          return (
            <SiteMarkdownEntryLine
              key={`e-${idx}-${block.name}`}
              name={block.name}
              value={block.value}
              onCopyValue={onCopyEntryValue}
            />
          );
        }
        if (!block.text.trim()) return null;
        return (
          <div
            key={`m-${idx}`}
            className="site-md-read text-[#262626] [&_a]:text-[#1677ff] [&_a]:underline [&_code]:rounded [&_code]:bg-[#f5f5f5] [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[#f5f5f5] [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.text}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
});
