import "quill/dist/quill.snow.css";
import Quill from "quill";
import Image from "quill/formats/image.js";
import { useEffect, useRef } from "react";
import { hydrateNoteContentHtml } from "@/lib/noteContentImages";

let mnImageFormatRegistered = false;

function ensureMnImageFormat() {
  if (mnImageFormatRegistered) return;
  class MnImage extends Image {
    static sanitize(url: string) {
      if (typeof url === "string" && (url.startsWith("blob:") || url.startsWith("mnimg:"))) {
        return url;
      }
      return super.sanitize(url);
    }
    static match(url: string) {
      if (typeof url === "string" && (url.startsWith("mnimg:") || url.startsWith("blob:"))) return true;
      return super.match(url);
    }
  }
  Quill.register(MnImage, true);
  mnImageFormatRegistered = true;
}

function dehydrateEditorHtml(html: string, blobUrlToImageId: Map<string, string>): string {
  let result = html;
  for (const [blobUrl, imageId] of blobUrlToImageId) {
    result = result.split(blobUrl).join(`mnimg:${imageId}`);
  }
  return result;
}

export function RichTextEditor({
  value,
  onChange,
  noteId,
  persistNoteImages,
  placeholder,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Used to resolve mnimg: refs when loading note content. */
  noteId: string;
  persistNoteImages?: (files: File[]) => Promise<{ id: string; objectUrl: string }[]>;
  placeholder?: string;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const onChangeRef = useRef(onChange);
  const persistNoteImagesRef = useRef(persistNoteImages);
  const blobUrlToImageIdRef = useRef(new Map<string, string>());
  const lastEmittedRef = useRef<string | undefined>(undefined);
  const hydratedUrlsRef = useRef<string[]>([]);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    persistNoteImagesRef.current = persistNoteImages;
  }, [persistNoteImages]);

  const revokeHydratedUrls = () => {
    for (const u of hydratedUrlsRef.current) {
      URL.revokeObjectURL(u);
    }
    hydratedUrlsRef.current = [];
  };

  useEffect(() => {
    ensureMnImageFormat();
    if (!hostRef.current || quillRef.current) return;
    hostRef.current.innerHTML = "";

    const quill = new Quill(hostRef.current, {
      theme: "snow",
      placeholder,
      modules: {
        toolbar: {
          container: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            ["blockquote", "code-block"],
            ["link", "image"],
            ["clean"],
          ],
          handlers: {
            image() {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.multiple = true;
              input.onchange = () => {
                const files = input.files;
                if (!files?.length) return;
                void insertImagesFromFiles(quill, Array.from(files));
              };
              input.click();
            },
          },
        },
      },
    });
    quillRef.current = quill;

    async function insertImagesFromFiles(editor: Quill, files: File[]) {
      const persist = persistNoteImagesRef.current;
      if (!persist) return;
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (!imageFiles.length) return;
      const inserted = await persist(imageFiles);
      const range = editor.getSelection(true);
      let index = range ? range.index : editor.getLength();
      for (const { id, objectUrl } of inserted) {
        blobUrlToImageIdRef.current.set(objectUrl, id);
        editor.insertEmbed(index, "image", objectUrl, Quill.sources.USER);
        index += 1;
      }
      editor.setSelection(index, Quill.sources.SILENT);
    }

    const pasteHandler = (e: ClipboardEvent) => {
      const persist = persistNoteImagesRef.current;
      if (!persist) return;
      const files = e.clipboardData?.files;
      if (!files?.length) return;
      const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      e.preventDefault();
      void insertImagesFromFiles(quill, imgs);
    };

    const dropHandler = (e: DragEvent) => {
      const persist = persistNoteImagesRef.current;
      if (!persist) return;
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      const imgs = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!imgs.length) return;
      e.preventDefault();
      void insertImagesFromFiles(quill, imgs);
    };

    quill.root.addEventListener("paste", pasteHandler);
    quill.root.addEventListener("drop", dropHandler);

    quill.on(Quill.events.TEXT_CHANGE, () => {
      if (applyingRemoteRef.current) return;
      const raw = quill.root.innerHTML;
      const dehydrated = dehydrateEditorHtml(raw, blobUrlToImageIdRef.current);
      const out = dehydrated === "<p><br></p>" ? "" : dehydrated;
      lastEmittedRef.current = out;
      onChangeRef.current(out);
    });

    return () => {
      quill.root.removeEventListener("paste", pasteHandler);
      quill.root.removeEventListener("drop", dropHandler);
      quillRef.current = null;
      revokeHydratedUrls();
      blobUrlToImageIdRef.current.clear();
    };
  }, [placeholder]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;

    if (value === lastEmittedRef.current) return;

    let cancelled = false;
    void (async () => {
      revokeHydratedUrls();
      blobUrlToImageIdRef.current.clear();

      const { html: hydrated, blobUrlByImageId } = await hydrateNoteContentHtml(value || "", noteId);
      if (cancelled) {
        for (const url of blobUrlByImageId.values()) URL.revokeObjectURL(url);
        return;
      }

      hydratedUrlsRef.current = [...blobUrlByImageId.values()];
      blobUrlToImageIdRef.current = new Map([...blobUrlByImageId.entries()].map(([id, url]) => [url, id]));

      const sel = quill.getSelection();
      applyingRemoteRef.current = true;
      quill.clipboard.dangerouslyPasteHTML(hydrated || "");
      applyingRemoteRef.current = false;
      lastEmittedRef.current = value || "";
      if (sel) {
        try {
          quill.setSelection(sel);
        } catch {
          /* selection may be invalid after HTML replace */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [value, noteId]);

  useEffect(
    () => () => {
      revokeHydratedUrls();
    },
    [],
  );

  return (
    <div className={className}>
      <div className="rich-quill bg-white">
        <div ref={hostRef} />
      </div>
      <style>{`
        .rich-quill .ql-container { min-height: 240px; font-size: 14px; }
        .rich-quill .ql-editor { min-height: 240px; }
      `}</style>
    </div>
  );
}
