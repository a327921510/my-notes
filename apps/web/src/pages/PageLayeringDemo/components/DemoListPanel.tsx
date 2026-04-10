import { Button, Input, List, Space, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoItems } from "../hooks/useDemoItems";

export type DemoTreeSelection = {
  selectedId: string | null;
  selectedLabel: string | null;
  itemCount: number;
};

export type DemoListPanelProps = {
  /** 请用 `useCallback` 保持引用稳定，避免多余通知。 */
  onSelectionChange: (selection: DemoTreeSelection) => void;
  /** 供页面入口把「删除当前选中」交给右侧等区块编排。 */
  onRegisterActions?: (actions: { removeSelected: () => void }) => void;
};

/**
 * 区域组件：内部使用页面 hooks 管理列表；与右侧仅通过 onSelectionChange / 注册操作耦合。
 */
export function DemoListPanel({ onSelectionChange, onRegisterActions }: DemoListPanelProps) {
  const { items, selectedId, selectedItem, addItem, removeItem, selectById } = useDemoItems();
  const [draft, setDraft] = useState("");

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const notify = useCallback(() => {
    onSelectionChangeRef.current({
      selectedId,
      selectedLabel: selectedItem?.label ?? null,
      itemCount: items.length,
    });
  }, [items.length, selectedId, selectedItem?.label]);

  useEffect(() => {
    notify();
  }, [notify]);

  useEffect(() => {
    onRegisterActions?.({
      removeSelected: () => {
        if (selectedId) removeItem(selectedId);
      },
    });
  }, [onRegisterActions, removeItem, selectedId]);

  const handleAdd = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    addItem(t);
    setDraft("");
  }, [addItem, draft]);

  return (
    <Space direction="vertical" className="w-full" size="middle">
      <Typography.Text strong>列表面板（区域组件）</Typography.Text>
      <Space.Compact className="w-full">
        <Input
          placeholder="新条目标题"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPressEnter={() => void handleAdd()}
        />
        <Button type="primary" onClick={() => void handleAdd()}>
          添加
        </Button>
      </Space.Compact>
      <List
        size="small"
        bordered
        dataSource={items}
        renderItem={(item) => (
          <List.Item
            className={selectedId === item.id ? "bg-blue-50" : undefined}
            style={{ cursor: "pointer" }}
            onClick={() => selectById(item.id)}
            actions={[
              <Button
                key="del"
                type="link"
                danger
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
              >
                删
              </Button>,
            ]}
          >
            {item.label}
          </List.Item>
        )}
      />
    </Space>
  );
}
