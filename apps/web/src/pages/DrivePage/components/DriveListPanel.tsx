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
import { useCallback, useMemo, useState } from "react";

import { isNodeDrag, readDraggedNodeIds, writeDraggedNodeIds } from "@/lib/dragNodes";

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
  onDropNodes: (nodeIds: string[], targetFolderId: string) => void;
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
  onDropNodes,
}: DriveListPanelProps) {
  /** Shift 连选的锚点 */
  const [anchorId, setAnchorId] = useState<string | null>(null);

  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      // 内部拖拽由行级 drop 处理，这里只接「从桌面拖进来的文件」
      if (isNodeDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (isSearchMode) return;
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) onDropFiles(files);
    },
    [isSearchMode, onDropFiles],
  );

  const handleRowDragStart = useCallback(
    (record: DriveListRow, event: React.DragEvent<HTMLElement>) => {
      const ids = selectedIds.includes(record.id) ? selectedIds : [record.id];
      writeDraggedNodeIds(event.dataTransfer, ids);
    },
    [selectedIds],
  );

  const handleRowDrop = useCallback(
    (record: DriveListRow, event: React.DragEvent<HTMLElement>) => {
      setDropTargetId(null);
      if (record.kind !== NodeKind.FOLDER || !isNodeDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      const ids = readDraggedNodeIds(event.dataTransfer).filter((id) => id !== record.id);
      if (ids.length > 0) onDropNodes(ids, record.id);
    },
    [onDropNodes],
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
    }),
    [onSelectedIdsChange, selectedIds],
  );

  /** 普通点击单选，Ctrl/Cmd 点击增删，Shift 从锚点连选；点复选框列时交给 antd。 */
  const handleRowClick = useCallback(
    (record: DriveListRow, event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest(".ant-table-selection-column")) return;

      if (event.shiftKey && anchorId) {
        const from = rows.findIndex((row) => row.id === anchorId);
        const to = rows.findIndex((row) => row.id === record.id);
        if (from !== -1 && to !== -1) {
          const [start, end] = from <= to ? [from, to] : [to, from];
          onSelectedIdsChange(rows.slice(start, end + 1).map((row) => row.id));
          return;
        }
      }

      if (event.metaKey || event.ctrlKey) {
        const next = selectedIds.includes(record.id)
          ? selectedIds.filter((id) => id !== record.id)
          : [...selectedIds, record.id];
        onSelectedIdsChange(next);
        setAnchorId(record.id);
        return;
      }

      onSelectedIdsChange([record.id]);
      setAnchorId(record.id);
    },
    [anchorId, onSelectedIdsChange, rows, selectedIds],
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
        title="加载失败"
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
        rowClassName={(record) => (dropTargetId === record.id ? "bg-[#e6f4ff]" : "")}
        onRow={(record) => ({
          draggable: !isSearchMode,
          onDragStart: (event: React.DragEvent<HTMLElement>) => handleRowDragStart(record, event),
          onDragOver: (event: React.DragEvent<HTMLElement>) => {
            if (record.kind !== NodeKind.FOLDER || !isNodeDrag(event.dataTransfer)) return;
            event.preventDefault();
            setDropTargetId(record.id);
          },
          onDragLeave: () => setDropTargetId((prev) => (prev === record.id ? null : prev)),
          onDrop: (event: React.DragEvent<HTMLElement>) => handleRowDrop(record, event),
          onClick: (event) => handleRowClick(record, event),
          onDoubleClick: () => onOpen(record),
        })}
      />
    </div>
  );
}
