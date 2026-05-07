import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { segmentProjectMarkdownWithCredentialTables } from "../utils/segmentProjectMarkdown";
import { CredentialMarkdownTableView } from "./CredentialMarkdownTableView";

const MD_CHUNK_CLASS =
  "project-md-read text-[#262626] [&_a]:text-[#1677ff] [&_a]:underline [&_code]:rounded [&_code]:bg-[#f5f5f5] [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-[#f5f5f5] [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#f0f0f0] [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-[#f0f0f0] [&_th]:bg-[#fafafa] [&_th]:px-2 [&_th]:py-1.5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5";

export type ProjectMarkdownReadViewProps = {
  source: string;
  onCopyCell: (text: string) => void;
};

export const ProjectMarkdownReadView = memo(function ProjectMarkdownReadView({
  source,
  onCopyCell,
}: ProjectMarkdownReadViewProps) {
  const segments = useMemo(
    () => segmentProjectMarkdownWithCredentialTables(source),
    [source],
  );

  if (!source.trim()) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-[#bfbfbf]">
        暂无文档内容，请切换到「编辑」撰写 Markdown。
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto pr-1">
      {segments.map((seg, idx) => {
        if (seg.type === "credentialTable") {
          return (
            <CredentialMarkdownTableView
              key={`ct-${idx}`}
              header={seg.header}
              body={seg.body}
              onCopyCell={onCopyCell}
            />
          );
        }
        if (!seg.text.trim()) return null;
        return (
          <div key={`md-${idx}`} className={MD_CHUNK_CLASS}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
});
