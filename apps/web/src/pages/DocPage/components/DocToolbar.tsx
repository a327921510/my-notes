import { ArrowLeftOutlined, DiffOutlined, SaveOutlined, TableOutlined } from "@ant-design/icons";
import { Button, Segmented, Space, Tag, Typography } from "antd";
import { memo, useMemo } from "react";

export type DocMode = "read" | "edit";

export type DocToolbarProps = {
  name: string;
  mode: DocMode;
  dirty: boolean;
  saving: boolean;
  comparing: boolean;
  onModeChange: (mode: DocMode) => void;
  onBack: () => void;
  onSave: () => void;
  onCompare: () => void;
  onInsertCredentialTable: () => void;
};

export const DocToolbar = memo(function DocToolbar({
  name,
  mode,
  dirty,
  saving,
  comparing,
  onModeChange,
  onBack,
  onSave,
  onCompare,
  onInsertCredentialTable,
}: DocToolbarProps) {
  const modeOptions = useMemo(
    () => [
      { label: "预览", value: "read" as DocMode },
      { label: "编辑", value: "edit" as DocMode },
    ],
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>
        返回云盘
      </Button>
      <Typography.Text strong className="max-w-[320px] truncate">
        {name}
      </Typography.Text>
      {dirty ? <Tag color="orange">未保存</Tag> : null}

      <Space className="ml-auto">
        {mode === "edit" ? (
          <Button icon={<TableOutlined />} onClick={onInsertCredentialTable}>
            插入凭据表
          </Button>
        ) : null}
        <Button
          data-testid="doc.compare"
          icon={<DiffOutlined />}
          loading={comparing}
          onClick={onCompare}
        >
          与服务端对比
        </Button>
        <Button
          data-testid="doc.save"
          icon={<SaveOutlined />}
          type="primary"
          loading={saving}
          disabled={!dirty}
          onClick={onSave}
        >
          保存
        </Button>
        <Segmented<DocMode> options={modeOptions} value={mode} onChange={onModeChange} />
      </Space>
    </div>
  );
});
