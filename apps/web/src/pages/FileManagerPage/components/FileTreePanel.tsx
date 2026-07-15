/**
 * 左侧文件树区域：工具栏 + Ant Tree；选中文件夹或文件后回传给页面入口。
 */
import { App, Button, Empty, Input, Modal, Space, Tree, type TreeDataNode, type TreeProps } from "antd";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { FsFileKind, FsFileRow, FsFolderRow } from "@my-notes/local-db";

import { useFsMutations } from "../hooks/useFsMutations";
import { useFsTree } from "../hooks/useFsTree";
import {
  fileTreeKey,
  folderTreeKey,
  parseTreeKey,
  type FsTreeSelection,
} from "../types";
import { TreeNodeTitle } from "./TreeNodeTitle";

export type FileTreePanelProps = {
  onSelectionChange: (selection: FsTreeSelection) => void;
  /** 全局搜索等外部定位：选中并展开该文件 */
  focusFileId?: string | null;
  onFocusFileConsumed?: () => void;
};

type PromptKind =
  | { type: "folder"; parentId: string | null }
  | { type: "file"; folderId: string | null; kind: FsFileKind }
  | { type: "rename-folder"; folderId: string; currentName: string }
  | { type: "rename-file"; fileId: string; currentName: string };

function sortByName<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

function buildTreeNodes(
  folders: FsFolderRow[],
  files: FsFileRow[],
  parentId: string | null,
  handlers: {
    onRenameFolder: (id: string, name: string) => void;
    onDeleteFolder: (id: string) => void;
    onRenameFile: (id: string, name: string) => void;
    onDeleteFile: (id: string) => void;
    onCreateSubFolder: (parentId: string) => void;
    onCreateFile: (folderId: string | null, kind: FsFileKind) => void;
  },
): TreeDataNode[] {
  const childFolders = sortByName(folders.filter((f) => f.parentId === parentId));
  const childFiles = sortByName(files.filter((f) => f.folderId === parentId));

  const folderNodes: TreeDataNode[] = childFolders.map((folder) => ({
    key: folderTreeKey(folder.id),
    title: (
      <TreeNodeTitle
        title={folder.name}
        isFolder
        onRename={() => handlers.onRenameFolder(folder.id, folder.name)}
        onDelete={() => handlers.onDeleteFolder(folder.id)}
        onCreateSubFolder={() => handlers.onCreateSubFolder(folder.id)}
        onCreateMd={() => handlers.onCreateFile(folder.id, "md")}
        onCreateRm={() => handlers.onCreateFile(folder.id, "rm")}
      />
    ),
    children: buildTreeNodes(folders, files, folder.id, handlers),
  }));

  const fileNodes: TreeDataNode[] = childFiles.map((file) => ({
    key: fileTreeKey(file.id),
    isLeaf: true,
    title: (
      <TreeNodeTitle
        title={file.name}
        isFolder={false}
        kind={file.kind}
        onRename={() => handlers.onRenameFile(file.id, file.name)}
        onDelete={() => handlers.onDeleteFile(file.id)}
      />
    ),
  }));

  return [...folderNodes, ...fileNodes];
}

function sameSelection(a: FsTreeSelection, b: FsTreeSelection): boolean {
  return (
    a.folderId === b.folderId &&
    a.selectedFileId === b.selectedFileId &&
    a.selectedFile?.id === b.selectedFile?.id
  );
}

export const FileTreePanel = memo(function FileTreePanel({
  onSelectionChange,
  focusFileId,
  onFocusFileConsumed,
}: FileTreePanelProps) {
  const { message, modal } = App.useApp();
  const { folders, files } = useFsTree();
  const {
    createFolder,
    renameFolder,
    removeFolder,
    createFile,
    renameFile,
    removeFile,
  } = useFsMutations();

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<PromptKind | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const didInitExpand = useRef(false);
  const focusConsumedRef = useRef(false);
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const lastSelectionRef = useRef<FsTreeSelection | null>(null);

  useEffect(() => {
    focusConsumedRef.current = false;
  }, [focusFileId]);

  const folderKeyList = useMemo(
    () => folders.map((f) => folderTreeKey(f.id)),
    [folders],
  );

  useEffect(() => {
    setExpandedKeys((prev) => {
      const pruned = prev.filter((k) => folderKeyList.includes(k));
      if (!didInitExpand.current && folderKeyList.length > 0) {
        didInitExpand.current = true;
        return [...folderKeyList];
      }
      return pruned;
    });
  }, [folderKeyList]);

  const pushSelection = useCallback((next: FsTreeSelection) => {
    if (lastSelectionRef.current && sameSelection(lastSelectionRef.current, next)) {
      return;
    }
    lastSelectionRef.current = next;
    onSelectionChangeRef.current(next);
  }, []);

  useEffect(() => {
    const key = selectedKeys[0];
    if (!key) {
      pushSelection({ folderId: null, selectedFileId: null, selectedFile: null });
      return;
    }
    const parsed = parseTreeKey(key);
    if (!parsed) return;
    if (parsed.type === "folder") {
      pushSelection({
        folderId: parsed.id,
        selectedFileId: null,
        selectedFile: null,
      });
      return;
    }
    const file = files.find((f) => f.id === parsed.id) ?? null;
    pushSelection({
      folderId: file?.folderId ?? null,
      selectedFileId: file?.id ?? null,
      selectedFile: file,
    });
  }, [selectedKeys, files, pushSelection]);

  useEffect(() => {
    if (!focusFileId || focusConsumedRef.current || files.length === 0) return;
    const file = files.find((f) => f.id === focusFileId);
    if (!file) {
      focusConsumedRef.current = true;
      onFocusFileConsumed?.();
      return;
    }
    if (file.folderId) {
      setExpandedKeys((prev) => {
        const fk = folderTreeKey(file.folderId!);
        return prev.includes(fk) ? prev : [...prev, fk];
      });
    }
    setSelectedKeys([fileTreeKey(file.id)]);
    focusConsumedRef.current = true;
    onFocusFileConsumed?.();
  }, [focusFileId, files, onFocusFileConsumed]);

  const openCreateFolder = useCallback((parentId: string | null) => {
    setPrompt({ type: "folder", parentId });
    setPromptValue("新建文件夹");
  }, []);

  const openCreateFile = useCallback((folderId: string | null, kind: FsFileKind) => {
    setPrompt({ type: "file", folderId, kind });
    setPromptValue(kind === "md" ? "未命名.md" : "未命名.rm");
  }, []);

  const openRenameFolder = useCallback((folderId: string, currentName: string) => {
    setPrompt({ type: "rename-folder", folderId, currentName });
    setPromptValue(currentName);
  }, []);

  const openRenameFile = useCallback((fileId: string, currentName: string) => {
    setPrompt({ type: "rename-file", fileId, currentName });
    setPromptValue(currentName);
  }, []);

  const handleDeleteFolder = useCallback(
    (folderId: string) => {
      modal.confirm({
        title: "删除文件夹",
        content: "仅空文件夹可删除。确认删除？",
        okType: "danger",
        onOk: async () => {
          try {
            await removeFolder(folderId);
            setSelectedKeys((prev) =>
              prev.filter((k) => k !== folderTreeKey(folderId)),
            );
            message.success("已删除文件夹");
          } catch (err) {
            message.error(err instanceof Error ? err.message : "删除失败");
            throw err;
          }
        },
      });
    },
    [message, modal, removeFolder],
  );

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      modal.confirm({
        title: "删除文件",
        content: "删除后无法恢复，确认删除？",
        okType: "danger",
        onOk: async () => {
          try {
            await removeFile(fileId);
            setSelectedKeys((prev) => prev.filter((k) => k !== fileTreeKey(fileId)));
            message.success("已删除文件");
          } catch (err) {
            message.error(err instanceof Error ? err.message : "删除失败");
            throw err;
          }
        },
      });
    },
    [message, modal, removeFile],
  );

  const treeHandlers = useMemo(
    () => ({
      onRenameFolder: openRenameFolder,
      onDeleteFolder: handleDeleteFolder,
      onRenameFile: openRenameFile,
      onDeleteFile: handleDeleteFile,
      onCreateSubFolder: (parentId: string) => openCreateFolder(parentId),
      onCreateFile: openCreateFile,
    }),
    [
      openRenameFolder,
      handleDeleteFolder,
      openRenameFile,
      handleDeleteFile,
      openCreateFolder,
      openCreateFile,
    ],
  );

  const treeData = useMemo(
    () => buildTreeNodes(folders, files, null, treeHandlers),
    [folders, files, treeHandlers],
  );

  const onSelect = useCallback<NonNullable<TreeProps["onSelect"]>>((keys) => {
    setSelectedKeys(keys.map(String));
  }, []);

  const onExpand = useCallback<NonNullable<TreeProps["onExpand"]>>((keys) => {
    setExpandedKeys(keys.map(String));
  }, []);

  const closePrompt = useCallback(() => {
    setPrompt(null);
    setPromptValue("");
  }, []);

  const submitPrompt = useCallback(async () => {
    if (!prompt) return;
    try {
      if (prompt.type === "folder") {
        const id = await createFolder(promptValue, prompt.parentId);
        if (prompt.parentId) {
          setExpandedKeys((prev) => {
            const pk = folderTreeKey(prompt.parentId!);
            return prev.includes(pk) ? prev : [...prev, pk];
          });
        }
        setSelectedKeys([folderTreeKey(id)]);
        message.success("已创建文件夹");
      } else if (prompt.type === "file") {
        const id = await createFile({
          folderId: prompt.folderId,
          name: promptValue,
          kind: prompt.kind,
        });
        if (prompt.folderId) {
          setExpandedKeys((prev) => {
            const pk = folderTreeKey(prompt.folderId!);
            return prev.includes(pk) ? prev : [...prev, pk];
          });
        }
        setSelectedKeys([fileTreeKey(id)]);
        message.success("已创建文件");
      } else if (prompt.type === "rename-folder") {
        await renameFolder(prompt.folderId, promptValue);
        message.success("已重命名");
      } else {
        await renameFile(prompt.fileId, promptValue);
        message.success("已重命名");
      }
      closePrompt();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "操作失败");
    }
  }, [
    prompt,
    promptValue,
    createFolder,
    createFile,
    renameFolder,
    renameFile,
    message,
    closePrompt,
  ]);

  const promptTitle = useMemo(() => {
    if (!prompt) return "";
    if (prompt.type === "folder") return "新建文件夹";
    if (prompt.type === "file") return prompt.kind === "md" ? "新建 Markdown" : "新建 .rm 文档";
    if (prompt.type === "rename-folder") return "重命名文件夹";
    return "重命名文件";
  }, [prompt]);

  const currentFolderId = useMemo(() => {
    const key = selectedKeys[0];
    if (!key) return null;
    const parsed = parseTreeKey(key);
    if (!parsed) return null;
    if (parsed.type === "folder") return parsed.id;
    const file = files.find((f) => f.id === parsed.id);
    return file?.folderId ?? null;
  }, [selectedKeys, files]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <Space wrap size={8}>
        <Button size="small" onClick={() => openCreateFolder(currentFolderId)}>
          新建文件夹
        </Button>
        <Button size="small" onClick={() => openCreateFile(currentFolderId, "md")}>
          新建 .md
        </Button>
        <Button size="small" onClick={() => openCreateFile(currentFolderId, "rm")}>
          新建 .rm
        </Button>
      </Space>
      <div className="min-h-0 flex-1 overflow-auto">
        {treeData.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无文件，可在上方新建"
            className="mt-8"
          />
        ) : (
          <Tree
            showLine
            blockNode
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            onSelect={onSelect}
            onExpand={onExpand}
            treeData={treeData}
            className="bg-transparent"
          />
        )}
      </div>
      <Modal
        title={promptTitle}
        open={prompt !== null}
        onCancel={closePrompt}
        onOk={() => void submitPrompt()}
        destroyOnClose
      >
        <Input
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          onPressEnter={() => void submitPrompt()}
          autoFocus
        />
      </Modal>
    </div>
  );
});
