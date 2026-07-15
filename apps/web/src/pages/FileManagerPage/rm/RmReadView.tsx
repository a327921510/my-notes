import { memo, useMemo } from "react";

import { CodeRepoMarkdownTableView } from "./components/CodeRepoMarkdownTableView";
import { CredentialMarkdownTableView } from "./components/CredentialMarkdownTableView";
import { GenericMarkdownTableView } from "./components/GenericMarkdownTableView";
import { ProjectMarkdownHtmlChunk } from "./components/ProjectMarkdownHtmlChunk";
import { segmentRmMarkdown } from "./utils/segmentRmMarkdown";

export type RmReadViewProps = {
  source: string;
  onCopyCell: (text: string) => void;
};

/** .rm 定制阅读：特殊表格渲染 + 一键复制，不做站点镜像 */
export const RmReadView = memo(function RmReadView({
  source,
  onCopyCell,
}: RmReadViewProps) {
  const segments = useMemo(() => segmentRmMarkdown(source), [source]);

  if (!source.trim()) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-[#bfbfbf]">
        暂无内容，请切换到「编辑」撰写 Markdown。
      </div>
    );
  }

  return (
    <div className="rm-read-view h-full min-h-0 overflow-auto pr-1">
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
        if (seg.type === "codeRepoTable") {
          return (
            <CodeRepoMarkdownTableView
              key={`cr-${idx}`}
              header={seg.header}
              body={seg.body}
              onCopyCell={onCopyCell}
            />
          );
        }
        if (seg.type === "genericTable") {
          return (
            <GenericMarkdownTableView
              key={`gt-${idx}`}
              header={seg.header}
              body={seg.body}
              onCopyCell={onCopyCell}
            />
          );
        }
        if (!seg.text.trim()) return null;
        return <ProjectMarkdownHtmlChunk key={`md-${idx}`} source={seg.text} />;
      })}
    </div>
  );
});
