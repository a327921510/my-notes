import { parseMmdSegments } from "@my-notes/shared";
import { Empty } from "antd";
import { memo, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { CredentialTableView } from "./CredentialTableView";
import styles from "./MmdReadView.module.less";

export type MmdReadViewProps = {
  source: string;
  onCopyCell: (text: string) => void;
};

/** 预览态：普通 Markdown 正常渲染，凭据表切出来交给增强表格。 */
export const MmdReadView = memo(function MmdReadView({ source, onCopyCell }: MmdReadViewProps) {
  const segments = useMemo(() => parseMmdSegments(source), [source]);

  if (source.trim() === "") {
    return <Empty className="py-10" image={Empty.PRESENTED_IMAGE_SIMPLE} description="文档还是空的，切到编辑开始写" />;
  }

  return (
    <div className={styles.readView}>
      {segments.map((segment, index) =>
        segment.type === "credentialTable" ? (
          <CredentialTableView
            key={index}
            header={segment.header}
            body={segment.body}
            onCopyCell={onCopyCell}
          />
        ) : (
          <Markdown key={index} remarkPlugins={[remarkGfm]}>
            {segment.text}
          </Markdown>
        ),
      )}
    </div>
  );
});
