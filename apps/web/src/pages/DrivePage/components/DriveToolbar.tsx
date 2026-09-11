import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExportOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  ImportOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import type { NodeBrief } from "@my-notes/shared";
import { Breadcrumb, Button, Divider, Space, Typography } from "antd";
import { memo } from "react";

export type DriveToolbarProps = {
  path: NodeBrief[];
  selectedCount: number;
  disabled: boolean;
  /** 超配额时禁用写入类入口 */
  quotaExhausted: boolean;
  onNavigate: (folderId: string | null) => void;
  onCreateFolder: () => void;
  onCreateDoc: () => void;
  onUpload: () => void;
  onImport: () => void;
  onExportCurrent: () => void;
  onBatchDownload: () => void;
  onBatchMove: () => void;
  onBatchDelete: () => void;
  onClearSelection: () => void;
};

export const DriveToolbar = memo(function DriveToolbar({
  path,
  selectedCount,
  disabled,
  quotaExhausted,
  onNavigate,
  onCreateFolder,
  onCreateDoc,
  onUpload,
  onImport,
  onExportCurrent,
  onBatchDownload,
  onBatchMove,
  onBatchDelete,
  onClearSelection,
}: DriveToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Breadcrumb
          className="mr-auto"
          items={path.map((item, index) => ({
            title:
              index === path.length - 1 ? (
                <span className="font-medium text-[#262626]">{item.name}</span>
              ) : (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 text-[#1677ff]"
                  onClick={() => onNavigate(index === 0 ? null : item.id)}
                >
                  {item.name}
                </button>
              ),
          }))}
        />

        <Space.Compact>
          <Button
            data-testid="drive.createFolder"
            disabled={disabled}
            icon={<FolderAddOutlined />}
            onClick={onCreateFolder}
          >
            新建文件夹
          </Button>
          <Button
            data-testid="drive.createDoc"
            disabled={disabled}
            icon={<FileAddOutlined />}
            onClick={onCreateDoc}
          >
            新建 .mmd
          </Button>
        </Space.Compact>

        <Button
          data-testid="drive.pickFiles"
          disabled={disabled || quotaExhausted}
          title={quotaExhausted ? "存储空间不足" : undefined}
          icon={<CloudUploadOutlined />}
          type="primary"
          onClick={onUpload}
        >
          上传文件
        </Button>

        <Space.Compact>
          <Button
            data-testid="drive.pickArchive"
            disabled={disabled || quotaExhausted}
            title={quotaExhausted ? "存储空间不足" : undefined}
            icon={<ImportOutlined />}
            onClick={onImport}
          >
            导入
          </Button>
          <Button
            data-testid="drive.requestArchive"
            disabled={disabled}
            icon={<ExportOutlined />}
            onClick={onExportCurrent}
          >
            导出当前目录
          </Button>
        </Space.Compact>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded bg-[#e6f4ff] px-3 py-2">
          <Typography.Text>已选 {selectedCount} 项</Typography.Text>
          <Divider type="vertical" />
          <Button size="small" icon={<DownloadOutlined />} onClick={onBatchDownload}>
            打包下载
          </Button>
          <Button size="small" icon={<SwapOutlined />} onClick={onBatchMove}>
            移动到
          </Button>
          <Button
            danger
            size="small"
            data-testid="drive.confirmDanger"
            icon={<DeleteOutlined />}
            onClick={onBatchDelete}
          >
            删除
          </Button>
          <Button size="small" type="text" onClick={onClearSelection}>
            取消选择
          </Button>
        </div>
      ) : null}
    </div>
  );
});
