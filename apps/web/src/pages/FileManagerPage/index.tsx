/**
 * 文件管理页入口：左侧树 + 右侧编辑；组装区域组件，不含业务写入细节。
 */
import { Splitter } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { FilesSearchNavigationState } from "@/types/globalSearchNavigation";

import { FileEditorPanel } from "./components/FileEditorPanel";
import { FileTreePanel } from "./components/FileTreePanel";
import type { FsTreeSelection } from "./types";

export function FileManagerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selection, setSelection] = useState<FsTreeSelection | null>(null);

  const focusFileId = useMemo(
    () => (location.state as FilesSearchNavigationState | undefined)?.focusFileId,
    [location.state],
  );

  const handleFocusFileConsumed = useCallback(() => {
    navigate(".", { replace: true, state: {} });
  }, [navigate]);

  const handleSelectionChange = useCallback((next: FsTreeSelection) => {
    setSelection(next);
  }, []);

  return (
    <Splitter className="h-[calc(100vh-3.5rem)] overflow-hidden rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.08)]">
      <Splitter.Panel defaultSize={300} min={240} max={480}>
        <FileTreePanel
          onSelectionChange={handleSelectionChange}
          focusFileId={focusFileId}
          onFocusFileConsumed={focusFileId ? handleFocusFileConsumed : undefined}
        />
      </Splitter.Panel>
      <Splitter.Panel>
        <FileEditorPanel selection={selection} />
      </Splitter.Panel>
    </Splitter>
  );
}

export default FileManagerPage;
