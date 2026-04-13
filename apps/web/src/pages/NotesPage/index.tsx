import { Empty, Input, Space, Splitter } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RichTextEditor } from "@/components/RichTextEditor";
import { db } from "@my-notes/local-db";
import { createId } from "@my-notes/shared";
import { pruneNoteImagesNotReferenced } from "@/lib/noteContentImages";
import { BreadcrumbBar } from "./components/BreadcrumbBar";
import { NotesFolderTree, type NotesTreeSelection } from "./components/NotesFolderTree";
import { useNoteCommands } from "./hooks/useNoteCommands";

export function NotesPage() {
  const navigate = useNavigate();
  const { saveNote, deleteNote } = useNoteCommands();
  const [selection, setSelection] = useState<NotesTreeSelection | null>(null);

  const handleSelectionChange = useCallback((s: NotesTreeSelection) => {
    setSelection(s);
  }, []);

  const selectedNote = selection?.selectedNote ?? null;
  const selectedFolder = selection?.selectedFolder ?? null;
  const selectedNoteId = selection?.selectedNoteId ?? null;
  const folderId = selection?.folderId ?? null;

  const persistNoteImages = useCallback(
    async (files: File[]) => {
      if (!selectedNote) return [];
      const existing = await db.images.where("noteId").equals(selectedNote.id).count();
      let order = existing;
      const out: { id: string; objectUrl: string }[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const key = createId("blob");
        const id = createId("img");
        await db.blobs.add({ key, blob: file });
        await db.images.add({
          id,
          noteId: selectedNote.id,
          localBlobRef: key,
          sortOrder: order++,
        });
        out.push({ id, objectUrl: URL.createObjectURL(file) });
      }
      return out;
    },
    [selectedNote],
  );

  const handleEditorChange = useCallback(
    async (html: string) => {
      if (!selectedNoteId) return;
      await saveNote(selectedNoteId, folderId, { contentText: html });
      await pruneNoteImagesNotReferenced(selectedNoteId, html);
    },
    [saveNote, selectedNoteId, folderId],
  );

  const handleDeleteNote = useCallback(async () => {
    await deleteNote(selectedNoteId, folderId);
  }, [deleteNote, selectedNoteId, folderId]);

  const editorKey = useMemo(() => selectedNote?.id ?? "no-note", [selectedNote?.id]);

  return (
    <Splitter style={{ borderRadius: 8, boxShadow: "0 0 10px rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
      <Splitter.Panel defaultSize={280} min={240} max={480}>
        <div className="h-full p-3">
          <NotesFolderTree onSelectionChange={handleSelectionChange} />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="h-full p-3">
          {!selectedNote ? (
            <Empty description="请选择或创建一条笔记" />
          ) : (
            <Space direction="vertical" className="w-full" size="middle">
              <BreadcrumbBar
                selectedFolder={selectedFolder ?? undefined}
                selectedNote={selectedNote}
                onGoToSyncedFiles={() => navigate("/synced")}
                onDeleteNote={() => void handleDeleteNote()}
              />
              <Input
                value={selectedNote.title}
                onChange={(e) => void saveNote(selectedNoteId, folderId, { title: e.target.value })}
                placeholder="标题"
              />
              <RichTextEditor
                key={editorKey}
                className="w-full"
                noteId={selectedNote.id}
                placeholder="正文…（工具栏插入图片、粘贴或拖拽图片到编辑区）"
                value={selectedNote.contentText}
                onChange={(html) => void handleEditorChange(html)}
                persistNoteImages={persistNoteImages}
              />
            </Space>
          )}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
