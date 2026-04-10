import { PlusOutlined, EllipsisOutlined, FileTextOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, Dropdown, Space, Typography } from "antd";
import { memo } from "react";

export type TitleRenderProps = {
  node: any;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;
  onCreateNote: () => void;
};

function TitleRenderInner({
  node,
  onRenameFolder,
  onDeleteFolder,
  onCreateNote,
}: TitleRenderProps) {
  const isFolder = String(node.key).startsWith("folder:");
  return (
    <div className="flex w-full items-center justify-between gap-2">
      <Space size={6}>
        {isFolder ? <FolderOpenOutlined /> : <FileTextOutlined />}
        <Typography.Text ellipsis>{String(node.title)}</Typography.Text>
      </Space>
      {isFolder ? (
        <Space>
          <Button
            size="small"
            type="text"
            icon={<PlusOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onCreateNote();
            }}
          />
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "rename-folder", label: "重命名文件夹" },
                { key: "delete-folder", label: "删除文件夹", danger: true },
              ],
              onClick: ({ key }) => {
                if (key === "rename-folder") onRenameFolder();
                if (key === "delete-folder") onDeleteFolder();
              },
            }}
          >
            <Button
              size="small"
              type="text"
              icon={<EllipsisOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Dropdown>
        </Space>
      ) : null}
    </div>
  );
}

export const TitleRender = memo(TitleRenderInner);