import { PlusOutlined } from "@ant-design/icons";
import { Button, Space, Typography } from "antd";
import { memo } from "react";

export type BookTitleProps = {
  onAddFolder: () => void;
};

function BookTitleInner({
  onAddFolder,
}: BookTitleProps) {
  return (
    <Space className="w-full justify-between" wrap>
      <Typography.Title level={5} type="secondary" className="text-xs">笔记本</Typography.Title>
      <Space>
        <Button type="text" icon={<PlusOutlined />} onClick={onAddFolder} />
      </Space>
    </Space>
  )
}

export const BookTitle = memo(BookTitleInner);