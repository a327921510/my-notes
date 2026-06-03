import { memo, useMemo } from "react";

import { segmentProjectMarkdownWithCredentialTables } from "../utils/segmentProjectMarkdown";

import { CodeRepoMarkdownTableView } from "./CodeRepoMarkdownTableView";
import { CredentialMarkdownTableView } from "./CredentialMarkdownTableView";
import { GenericMarkdownTableView } from "./GenericMarkdownTableView";
import { ProjectMarkdownHtmlChunk } from "./ProjectMarkdownHtmlChunk";

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
    <div className="project-md-read-view h-full min-h-0 overflow-auto pr-1">
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
