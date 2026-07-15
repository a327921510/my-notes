import {
  EllipsisOutlined,
  FileMarkdownOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Dropdown, Space, Typography } from "antd";
import { memo } from "react";

import type { FsFileKind } from "../types";

export type TreeNodeTitleProps = {
  title: string;
  isFolder: boolean;
  kind?: FsFileKind;
  onRename: () => void;
  onDelete: () => void;
  onCreateSubFolder?: () => void;
  onCreateMd?: () => void;
  onCreateRm?: () => void;
};

export const TreeNodeTitle = memo(function TreeNodeTitle({
  title,
  isFolder,
  kind,
  onRename,
  onDelete,
  onCreateSubFolder,
  onCreateMd,
  onCreateRm,
}: TreeNodeTitleProps) {
  const icon = isFolder ? (
    <FolderOpenOutlined />
  ) : kind === "rm" ? (
    <FileTextOutlined />
  ) : (
    <FileMarkdownOutlined />
  );

  const menuItems = isFolder
    ? [
        { key: "new-subfolder", label: "新建子文件夹" },
        { key: "new-md", label: "新建 .md" },
        { key: "new-rm", label: "新建 .rm" },
        { type: "divider" as const },
        { key: "rename", label: "重命名" },
        { key: "delete", label: "删除", danger: true },
      ]
    : [
        { key: "rename", label: "重命名" },
        { key: "delete", label: "删除", danger: true },
      ];

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-1 pr-1">
      <Space size={6} className="min-w-0">
        {icon}
        <Typography.Text ellipsis className="max-w-[140px]">
          {title}
        </Typography.Text>
      </Space>
      <Space size={0}>
        {isFolder ? (
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            aria-label="在此新建 .md"
            onClick={(e) => {
              e.stopPropagation();
              onCreateMd?.();
            }}
          />
        ) : null}
        <Dropdown
          trigger={["click"]}
          menu={{
            items: menuItems,
            onClick: ({ key, domEvent }) => {
              domEvent.stopPropagation();
              if (key === "rename") onRename();
              if (key === "delete") onDelete();
              if (key === "new-subfolder") onCreateSubFolder?.();
              if (key === "new-md") onCreateMd?.();
              if (key === "new-rm") onCreateRm?.();
            },
          }}
        >
          <Button
            size="small"
            type="text"
            icon={<EllipsisOutlined />}
            aria-label="更多操作"
            onClick={(e) => e.stopPropagation()}
          />
        </Dropdown>
      </Space>
    </div>
  );
});
