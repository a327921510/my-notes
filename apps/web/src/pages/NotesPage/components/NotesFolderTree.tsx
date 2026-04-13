import { Space, Tree, Typography, type TreeProps } from "antd";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteRecord } from "@my-notes/shared";
import { ensureDefaultFolder } from "@my-notes/local-db";
import useFolderState from "../hooks/useFolderState";
import { useNoteCommands } from "../hooks/useNoteCommands";
import { useNotesList } from "../hooks/useNotesList";
import { BookTitle } from "./BookTitle";
import { TitleRender } from "./TitleRender";

export type FolderOption = { id: string; name: string };

type TreeNode = {
  key: string;
  title: string;
  children?: { key: string; title: string; note: NoteRecord }[];
};

const EMPTY_FOLDERS: FolderOption[] = [];
const EMPTY_NOTES: NoteRecord[] = [];

function noop() {}

function expandedKeysPruned(prev: string[], validFolderKeys: readonly string[]): string[] {
  return prev.filter((k) => validFolderKeys.includes(k));
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export type NotesTreeSelection = {
  folderId: string | null;
  selectedNoteId: string | null;
  selectedNote: NoteRecord | null;
  selectedFolder: FolderOption | null;
};

export type NotesFolderTreeProps = {
  /** 请用 `useCallback` 保持引用稳定，避免多余通知。 */
  onSelectionChange: (selection: NotesTreeSelection) => void;
};

function NotesFolderTreeInner({ onSelectionChange }: NotesFolderTreeProps) {
  const { folders, addFolder, renameFolder, deleteFolder } = useFolderState();
  const { notes } = useNotesList();
  const { createNote } = useNoteCommands();

  const [folderId, setFolderId] = useState<string | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const lastPushedSelection = useRef<NotesTreeSelection | null>(null);

  useEffect(() => {
    void (async () => {
      const def = await ensureDefaultFolder();
      setFolderId((cur) => cur ?? def);
    })();
  }, []);

  const safeFolders = (folders ?? EMPTY_FOLDERS) as FolderOption[];
  const allNotes = notes ?? EMPTY_NOTES;
  const filteredIds = useMemo(() => new Set(notes?.map((n) => n.id)), [notes]);

  const treeData = useMemo(
    () =>
      safeFolders.map((folder) => ({
        key: `folder:${folder.id}`,
        title: folder.name,
        children: allNotes
          .filter((note) => note.folderId === folder.id && filteredIds.has(note.id))
          .map((note) => ({ key: `note:${note.id}`, title: note.title || "无标题", note })),
      })),
    [safeFolders, allNotes, filteredIds],
  );

  const folderKeys = useMemo(() => treeData.map((n) => String(n.key)), [treeData]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const didInitExpandRef = useRef(false);

  useEffect(() => {
    setExpandedKeys((prev) => {
      const pruned = expandedKeysPruned(prev, folderKeys);
      if (!didInitExpandRef.current && folderKeys.length > 0) {
        didInitExpandRef.current = true;
        return [...folderKeys];
      }
      if (sameStringArray(pruned, prev)) return prev;
      return pruned;
    });
  }, [folderKeys]);

  const onExpand = useCallback<NonNullable<TreeProps["onExpand"]>>((keys) => {
    setExpandedKeys(keys.map(String));
  }, []);

  const expandAllFolders = useCallback(() => {
    setExpandedKeys([...folderKeys]);
  }, [folderKeys]);

  const collapseAllFolders = useCallback(() => {
    setExpandedKeys([]);
  }, []);

  useEffect(() => {
    const list = notes ?? [];
    if (list.length === 0) {
      setSelectedNoteId(null);
      return;
    }
    const exists = selectedNoteId != null && list.some((n) => n.id === selectedNoteId);
    if (!exists) {
      setSelectedNoteId(list[0].id);
    }
  }, [notes, selectedNoteId]);

  const selectedNote = useMemo(() => {
    if (!selectedNoteId || !notes?.length) return null;
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  const selectedFolder = useMemo(() => {
    const fid = selectedNote?.folderId ?? folderId;
    if (!fid) return null;
    return safeFolders.find((f) => f.id === fid) ?? null;
  }, [safeFolders, selectedNote?.folderId, folderId]);

  useEffect(() => {
    const payload: NotesTreeSelection = {
      folderId,
      selectedNoteId,
      selectedNote,
      selectedFolder,
    };
    const prev = lastPushedSelection.current;
    if (
      prev &&
      prev.folderId === payload.folderId &&
      prev.selectedNoteId === payload.selectedNoteId &&
      prev.selectedNote === payload.selectedNote &&
      prev.selectedFolder === payload.selectedFolder
    ) {
      return;
    }
    lastPushedSelection.current = payload;
    onSelectionChangeRef.current(payload);
  }, [folderId, selectedNoteId, selectedNote, selectedFolder]);

  const selectedFolderId = folderId ?? "";
  const selectedKeys = selectedNoteId
    ? [`note:${selectedNoteId}`]
    : selectedFolderId
      ? [`folder:${selectedFolderId}`]
      : [];

  const handleTreeSelect = useCallback<NonNullable<TreeProps["onSelect"]>>((keys, info) => {
    if (!keys.length) return;
    const key = String(keys[0]);
    if (key.startsWith("folder:")) {
      setFolderId(key.slice(7));
      return;
    }
    if (key.startsWith("note:")) {
      const note = (info.node as { note?: NoteRecord }).note;
      if (note?.folderId) setFolderId(note.folderId);
      setSelectedNoteId(key.slice(5));
    }
  }, []);

  const handleAddFolder = useCallback(() => void addFolder(), [addFolder]);

  const folderActionByKey = useMemo(() => {
    const map = new Map<
      string,
      {
        onRenameFolder: () => void;
        onDeleteFolder: () => void;
        onCreateNote: () => void;
      }
    >();
    for (const f of safeFolders) {
      const id = f.id;
      map.set(`folder:${id}`, {
        onRenameFolder: () => void renameFolder(id),
        onDeleteFolder: () => void deleteFolder(id),
        onCreateNote: () => {
          void (async () => {
            const nid = await createNote(id);
            setSelectedNoteId(nid);
          })();
        },
      });
    }
    return map;
  }, [safeFolders, renameFolder, deleteFolder, createNote]);

  const renderTreeTitle = useCallback<NonNullable<TreeProps["titleRender"]>>(
    (node) => {
      const keyStr = String(node.key);
      const actions = folderActionByKey.get(keyStr);
      if (actions) {
        return <TitleRender node={node} {...actions} />;
      }
      return (
        <TitleRender
          node={node}
          onRenameFolder={noop}
          onDeleteFolder={noop}
          onCreateNote={noop}
        />
      );
    },
    [folderActionByKey],
  );

  return (
    <Space direction="vertical" className="w-full" size={6}>
      <BookTitle onAddFolder={handleAddFolder} />
      <Space size="middle" wrap className="text-xs">
        <Typography.Link type="secondary" onClick={expandAllFolders}>
          展开全部
        </Typography.Link>
        <Typography.Link type="secondary" onClick={collapseAllFolders}>
          收起全部
        </Typography.Link>
      </Space>
      <Tree
        blockNode
        motion={false}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        treeData={treeData}
        onSelect={handleTreeSelect}
        titleRender={renderTreeTitle}
      />
    </Space>
  );
}

/** 树内维护文件夹/笔记数据与选中项；展开状态在内部，避免展开时整页重渲染。 */
export const NotesFolderTree = memo(NotesFolderTreeInner);
