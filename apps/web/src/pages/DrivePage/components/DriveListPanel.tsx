import { DeleteOutlined, DownloadOutlined, EditOutlined, SwapOutlined } from "@ant-design/icons";
import {
  type DriveNode,
  type NodeBrief,
  NodeKind,
  NodeSortField,
  SortOrder,
  formatBytes,
} from "@my-notes/shared";
import { Alert, Button, Empty, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { useCallback, useMemo } from "react";

import { NodeNameCell } from "./NodeNameCell";

export type DriveListRow = DriveNode & { path?: NodeBrief[] };

export type DriveListPanelProps = {
  rows: DriveListRow[];
  loading: boolean;
  error: string | null;
  /** 搜索结果模式下展示所在路径列，并禁用拖拽上传提示 */
  isSearchMode: boolean;
  sort: NodeSortField;
  order: SortOrder;
  onSortChange: (field: NodeSortField, order: SortOrder) => void;
  selectedIds: string[];
  renamingId: string | null;
  onSelectedIdsChange: (ids: string[]) => void;
  onOpen: (node: DriveNode) => void;
  onRenameStart: (node: DriveNode) => void;
  onRenameSubmit: (node: DriveNode, name: string) => void;
  onRenameCancel: () => void;
  onDownload: (node: DriveNode) => void;
  onMove: (node: DriveNode) => void;
  onDelete: (node: DriveNode) => void;
  onRetry: () => void;
  onDropFiles: (files: File[]) => void;
};

function formatTime(value: number): string {
  return new Date(value).toLocaleString();
}

/** antd 的 `ascend`/`descend` 与接口的 `asc`/`desc` 互转。 */
function mapSortStateToColumnOrder(
  field: NodeSortField,
  activeField: NodeSortField,
  order: SortOrder,
): "ascend" | "descend" | null {
  if (field !== activeField) return null;
  return order === SortOrder.ASC ? "ascend" : "descend";
}

export function DriveListPanel({
  rows,
  loading,
  error,
  isSearchMode,
  sort,
  order,
  onSortChange,
  selectedIds,
  renamingId,
  onSelectedIdsChange,
  onOpen,
  onRenameStart,
  onRenameSubmit,
  onRenameCancel,
  onDownload,
  onMove,
  onDelete,
  onRetry,
  onDropFiles,
}: DriveListPanelProps) {
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (isSearchMode) return;
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) onDropFiles(files);
    },
    [isSearchMode, onDropFiles],
  );

  const columns = useMemo<ColumnsType<DriveListRow>>(() => {
    const base: ColumnsType<DriveListRow> = [
      {
        title: "名称",
        dataIndex: "name",
        ellipsis: true,
        sorter: !isSearchMode,
        sortOrder: mapSortStateToColumnOrder(NodeSortField.NAME, sort, order),
        render: (_value, record) => (
          <NodeNameCell
            node={record}
            isRenaming={renamingId === record.id}
            onRenameSubmit={onRenameSubmit}
            onRenameCancel={onRenameCancel}
          />
        ),
      },
    ];

    if (isSearchMode) {
      base.push({
        title: "所在位置",
        dataIndex: "path",
        width: 260,
        ellipsis: true,
        render: (_value, record) => (
          <Typography.Text type="secondary">
            {(record.path ?? []).slice(0, -1).map((item) => item.name).join(" / ") || "-"}
          </Typography.Text>
        ),
      });
    }

    base.push(
      {
        title: "大小",
        dataIndex: "sizeBytes",
        width: 110,
        sorter: !isSearchMode,
        sortOrder: mapSortStateToColumnOrder(NodeSortField.SIZE, sort, order),
        render: (_value, record) =>
          record.kind === NodeKind.FOLDER ? "-" : formatBytes(record.sizeBytes),
      },
      {
        title: "类型",
        dataIndex: "kind",
        width: 110,
        render: (_value, record) =>
          record.kind === NodeKind.FOLDER ? "文件夹" : record.docKind === "mmd" ? "MMD 文档" : "文件",
      },
      {
        title: "修改时间",
        dataIndex: "updatedAt",
        width: 180,
        sorter: !isSearchMode,
        sortOrder: mapSortStateToColumnOrder(NodeSortField.UPDATED_AT, sort, order),
        render: (value: number) => formatTime(value),
      },
      {
        title: "操作",
        key: "actions",
        width: 150,
        render: (_value, record) => (
          <Space size={0} onClick={(event) => event.stopPropagation()}>
            <Tooltip title="重命名">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onRenameStart(record)} />
            </Tooltip>
            {record.kind === NodeKind.FILE ? (
              <Tooltip title="下载">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => onDownload(record)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title="移动到">
              <Button type="text" size="small" icon={<SwapOutlined />} onClick={() => onMove(record)} />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                danger
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => onDelete(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    );

    return base;
  }, [
    isSearchMode,
    order,
    sort,
    onDelete,
    onDownload,
    onMove,
    onRenameCancel,
    onRenameStart,
    onRenameSubmit,
    renamingId,
  ]);

  const rowSelection = useMemo<TableProps<DriveListRow>["rowSelection"]>(
    () => ({
      selectedRowKeys: selectedIds,
      onChange: (keys) => onSelectedIdsChange(keys.map(String)),
      /** Shift 连选由 antd 的 checkbox 区间选择提供 */
      checkStrictly: true,
    }),
    [onSelectedIdsChange, selectedIds],
  );

  const handleTableChange = useCallback<NonNullable<TableProps<DriveListRow>["onChange"]>>(
    (_pagination, _filters, sorter) => {
      const active = Array.isArray(sorter) ? sorter[0] : sorter;
      const field = active?.columnKey ?? active?.field;
      const nextField =
        field === "sizeBytes"
          ? NodeSortField.SIZE
          : field === "updatedAt"
            ? NodeSortField.UPDATED_AT
            : NodeSortField.NAME;
      onSortChange(nextField, active?.order === "descend" ? SortOrder.DESC : SortOrder.ASC);
    },
    [onSortChange],
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="加载失败"
        description={error}
        action={
          <Button size="small" onClick={onRetry}>
            重试
          </Button>
        }
      />
    );
  }

  return (
    <div
      className="h-full min-h-0 overflow-auto"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      data-testid="drive.uploadQueue"
    >
      <Table<DriveListRow>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        rowSelection={rowSelection}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={isSearchMode ? "没有匹配的文件夹或文件" : "这个文件夹是空的，可拖拽文件到此处上传"}
            />
          ),
        }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => onSelectedIdsChange([record.id]),
          onDoubleClick: () => onOpen(record),
        })}
      />
    </div>
  );
}
