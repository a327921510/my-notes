import { Splitter } from "antd";
import { useCallback, useRef, useState } from "react";
import { DemoDetailView } from "./components/DemoDetailView";
import { DemoListPanel, type DemoTreeSelection } from "./components/DemoListPanel";
import { DemoStatBar } from "./components/DemoStatBar";

/**
 * 页面入口：跨区状态（选中摘要）、路由/权限（若需要）、把区域暴露的操作交给展示层回调。
 */
export function PageLayeringDemo() {
  const [selection, setSelection] = useState<DemoTreeSelection | null>(null);
  const listActionsRef = useRef<{ removeSelected: () => void }>({
    removeSelected: () => {},
  });

  const handleSelectionChange = useCallback((s: DemoTreeSelection) => {
    setSelection(s);
  }, []);

  const handleRegisterActions = useCallback((a: { removeSelected: () => void }) => {
    listActionsRef.current = a;
  }, []);

  const selectedLabel = selection?.selectedLabel ?? null;
  const itemCount = selection?.itemCount ?? 0;

  return (
    <Splitter style={{ borderRadius: 8, overflow: "hidden" }}>
      <Splitter.Panel defaultSize={300} min={220} max={440}>
        <div className="h-full p-3">
          <DemoListPanel onSelectionChange={handleSelectionChange} onRegisterActions={handleRegisterActions} />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="flex h-full flex-col gap-3 p-3">
          <DemoStatBar itemCount={itemCount} selectedLabel={selectedLabel} />
          <DemoDetailView
            selectedLabel={selectedLabel}
            onDeleteSelected={() => listActionsRef.current.removeSelected()}
          />
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
