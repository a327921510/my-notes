import { useCallback, useMemo, useState } from "react";
import { createId } from "@/lib/id";

export type DemoItem = { id: string; label: string };

/** 页面域：示例列表的内存状态与操作（与具体布局无关）。 */
export function useDemoItems() {
  const [items, setItems] = useState<DemoItem[]>(() => [
    { id: createId("demo"), label: "示例条目 1" },
    { id: createId("demo"), label: "示例条目 2" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const addItem = useCallback((label: string) => {
    const id = createId("demo");
    setItems((prev) => [...prev, { id, label }]);
    setSelectedId(id);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const selectById = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  return {
    items,
    selectedId,
    selectedItem,
    addItem,
    removeItem,
    selectById,
  };
}
