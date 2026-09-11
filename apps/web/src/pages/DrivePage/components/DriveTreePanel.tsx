import { FolderFilled, FolderOpenFilled } from "@ant-design/icons";
import { Empty, Spin, Tree } from "antd";
import type { DataNode } from "antd/es/tree";
import { useCallback, useMemo, useState } from "react";

import { isNodeDrag, readDraggedNodeIds } from "@/lib/dragNodes";

import type { FolderTreeNode } from "../hooks/useDriveTree";

export type DriveTreePanelProps = {
  treeData: FolderTreeNode[];
  expandedKeys: string[];
  selectedKey: string | null;
  loading: boolean;
  onExpandedKeysChange: (keys: string[]) => void;
  onSelect: (folderId: string, isRoot: boolean) => void;
  onLoadChildren: (folderId: string) => Promise<void>;
  onDropNodes: (nodeIds: string[], targetFolderId: string) => void;
};

export function DriveTreePanel({
  treeData,
  expandedKeys,
  selectedKey,
  loading,
  onExpandedKeysChange,
  onSelect,
  onLoadChildren,
  onDropNodes,
}: DriveTreePanelProps) {
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const rootKey = treeData[0]?.key ?? null;

  const handleSelect = useCallback(
    (keys: React.Key[]) => {
      const key = keys[0];
      if (typeof key !== "string") return;
      onSelect(key, key === rootKey);
    },
    [onSelect, rootKey],
  );

  const handleLoadData = useCallback(
    async (node: DataNode) => {
      await onLoadChildren(String(node.key));
    },
    [onLoadChildren],
  );

  const data = useMemo(() => treeData as unknown as DataNode[], [treeData]);

  /** 列表里拖出来的节点可以直接落到目录树上完成移动。 */
  const renderTitle = useCallback(
    (node: DataNode) => {
      const key = String(node.key);
      return (
        <span
          className={`block rounded px-1 ${dropTargetKey === key ? "bg-[#bae0ff]" : ""}`}
          onDragOver={(event) => {
            if (!isNodeDrag(event.dataTransfer)) return;
            event.preventDefault();
            setDropTargetKey(key);
          }}
          onDragLeave={() => setDropTargetKey((prev) => (prev === key ? null : prev))}
          onDrop={(event) => {
            setDropTargetKey(null);
            if (!isNodeDrag(event.dataTransfer)) return;
            event.preventDefault();
            const ids = readDraggedNodeIds(event.dataTransfer).filter((id) => id !== key);
            if (ids.length > 0) onDropNodes(ids, key);
          }}
        >
          {String(node.title)}
        </span>
      );
    },
    [dropTargetKey, onDropNodes],
  );

  if (loading && treeData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (treeData.length === 0) {
    return <Empty className="pt-8" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无目录" />;
  }

  return (
    <Tree
      blockNode
      showIcon
      className="h-full overflow-auto"
      icon={({ expanded }: { expanded?: boolean }) =>
        expanded ? <FolderOpenFilled className="text-[#f7c04a]" /> : <FolderFilled className="text-[#f7c04a]" />
      }
      treeData={data}
      expandedKeys={expandedKeys}
      selectedKeys={selectedKey ? [selectedKey] : []}
      loadData={handleLoadData}
      titleRender={renderTitle}
      onExpand={(keys) => onExpandedKeysChange(keys.map(String))}
      onSelect={handleSelect}
    />
  );
}
