import { FileOutlined, FileTextOutlined, FolderFilled } from "@ant-design/icons";
import { type DriveNode, NodeKind } from "@my-notes/shared";
import { Input, Tag } from "antd";
import { memo, useCallback, useEffect, useState } from "react";

export type NodeNameCellProps = {
  node: DriveNode;
  isRenaming: boolean;
  onRenameSubmit: (node: DriveNode, name: string) => void;
  onRenameCancel: () => void;
};

/** 名称列：类型图标 + 名称；重命名时就地变成输入框。打开动作由行的双击处理。 */
export const NodeNameCell = memo(function NodeNameCell({
  node,
  isRenaming,
  onRenameSubmit,
  onRenameCancel,
}: NodeNameCellProps) {
  const [draft, setDraft] = useState(node.name);

  useEffect(() => {
    if (isRenaming) setDraft(node.name);
  }, [isRenaming, node.name]);

  const handleSubmit = useCallback(() => onRenameSubmit(node, draft), [draft, node, onRenameSubmit]);

  const icon =
    node.kind === NodeKind.FOLDER ? (
      <FolderFilled className="text-[#f7c04a]" />
    ) : node.docKind === "mmd" ? (
      <FileTextOutlined className="text-[#1677ff]" />
    ) : (
      <FileOutlined className="text-[#8c8c8c]" />
    );

  if (isRenaming) {
    return (
      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
        {icon}
        <Input
          autoFocus
          size="small"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPressEnter={handleSubmit}
          onBlur={handleSubmit}
          onKeyDown={(event) => {
            if (event.key === "Escape") onRenameCancel();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {node.docKind === "mmd" ? <Tag color="blue">可编辑</Tag> : null}
    </div>
  );
});
