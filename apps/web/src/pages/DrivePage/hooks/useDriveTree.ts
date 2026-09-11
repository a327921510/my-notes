import { type DriveNode, NodeKind } from "@my-notes/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { driveApi } from "@/services/modules/drive";

export type FolderTreeNode = {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: FolderTreeNode[];
};

function mapFolderToTreeNode(folder: DriveNode): FolderTreeNode {
  return { key: folder.id, title: folder.name, isLeaf: false };
}

function replaceChildren(
  nodes: FolderTreeNode[],
  key: string,
  children: FolderTreeNode[],
): FolderTreeNode[] {
  return nodes.map((node) => {
    if (node.key === key) return { ...node, children, isLeaf: children.length === 0 };
    if (!node.children) return node;
    return { ...node, children: replaceChildren(node.children, key, children) };
  });
}

function collectLoadedKeys(nodes: FolderTreeNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children) {
      acc.push(node.key);
      collectLoadedKeys(node.children, acc);
    }
  }
  return acc;
}

/** 左侧目录树：根节点常驻，子层级按展开懒加载。 */
export function useDriveTree() {
  const [rootId, setRootId] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<FolderTreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const treeRef = useRef<FolderTreeNode[]>([]);

  treeRef.current = treeData;

  const loadChildren = useCallback(async (folderId: string) => {
    const result = await driveApi.listNodes({ parentId: folderId });
    const children = result.nodes.filter((node) => node.kind === NodeKind.FOLDER).map(mapFolderToTreeNode);
    setTreeData((prev) => replaceChildren(prev, folderId, children));
  }, []);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    try {
      const result = await driveApi.listNodes({ parentId: null });
      const children = result.nodes
        .filter((node) => node.kind === NodeKind.FOLDER)
        .map(mapFolderToTreeNode);
      setRootId(result.parent.id);
      setTreeData([
        { key: result.parent.id, title: result.parent.name, isLeaf: false, children },
      ]);
      setExpandedKeys((prev) => (prev.includes(result.parent.id) ? prev : [result.parent.id]));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoot();
  }, [loadRoot]);

  /** 结构变化后重新拉取所有已展开过的层级，保持树与列表一致。 */
  const reload = useCallback(async () => {
    const loadedKeys = collectLoadedKeys(treeRef.current);
    await loadRoot();
    for (const key of loadedKeys) {
      if (key === treeRef.current[0]?.key) continue;
      await loadChildren(key).catch(() => undefined);
    }
  }, [loadChildren, loadRoot]);

  return { rootId, treeData, expandedKeys, loading, setExpandedKeys, loadChildren, reload };
}
