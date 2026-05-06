import { SearchOutlined } from "@ant-design/icons";
import { Empty, Input, List, Modal, Typography } from "antd";
import type { InputRef } from "antd/es/input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  type GlobalSearchHit,
  useGlobalEntrySearch,
} from "@/hooks/useGlobalEntrySearch";

const TRIGGER_PLACEHOLDER = "输入 / 进行搜索";

function isEditableDocumentTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    if (target instanceof HTMLInputElement && target.readOnly) return false;
    return true;
  }
  if (target.isContentEditable) return true;
  return false;
}

function hitSecondaryLabel(hit: GlobalSearchHit): string {
  if (hit.kind === "note") return "笔记区";
  if (hit.kind === "siteItem") return `站点信息区 · ${hit.siteName}`;
  return `项目信息区 · ${hit.projectName}`;
}

export function GlobalEntrySearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<InputRef>(null);
  const { hits } = useGlobalEntrySearch(query);

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery("");
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableDocumentTarget(e.target)) return;
      e.preventDefault();
      openModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openModal]);

  const handleSelectHit = useCallback(
    (hit: GlobalSearchHit) => {
      closeModal();
      if (hit.kind === "note") {
        navigate("/notes", { state: { focusNoteId: hit.id } });
        return;
      }
      if (hit.kind === "siteItem") {
        navigate("/sites", { state: { focusSiteId: hit.siteId, focusItemId: hit.itemId } });
        return;
      }
      navigate("/projects", {
        state: { focusProjectId: hit.projectId, focusItemId: hit.itemId },
      });
    },
    [closeModal, navigate],
  );

  const afterOpenChange = useCallback((nextOpen: boolean) => {
    if (nextOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, []);

  const listData = useMemo(
    () =>
      hits.map((h) => ({
        hit: h,
        primary: h.kind === "note" ? h.title : h.name,
        secondary: hitSecondaryLabel(h),
      })),
    [hits],
  );

  return (
    <>
      <Input
        readOnly
        className="w-36 min-w-0 cursor-pointer sm:w-44 lg:w-52"
        placeholder={TRIGGER_PLACEHOLDER}
        prefix={<SearchOutlined className="text-[#bfbfbf]" />}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === "/") {
            e.preventDefault();
            openModal();
          }
        }}
      />
      <Modal
        title="搜索条目"
        open={open}
        onCancel={closeModal}
        footer={null}
        width={560}
        destroyOnClose
        afterOpenChange={afterOpenChange}
      >
        <div className="flex flex-col gap-3">
          <Input
            ref={inputRef}
            allowClear
            placeholder={TRIGGER_PLACEHOLDER}
            prefix={<SearchOutlined className="text-[#bfbfbf]" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {!query.trim() ? (
            <Typography.Text type="secondary">输入关键词，在笔记与站点/项目条目中匹配名称与正文</Typography.Text>
          ) : hits.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配结果" />
          ) : (
            <List
              className="max-h-[min(420px,50vh)] overflow-auto rounded-md border border-solid border-[#f0f0f0]"
              size="small"
              dataSource={listData}
              renderItem={({ hit, primary, secondary }) => (
                <List.Item
                  className="!cursor-pointer px-3 hover:bg-[#fafafa]"
                  onClick={() => handleSelectHit(hit)}
                >
                  <List.Item.Meta
                    title={
                      <Typography.Text strong ellipsis>
                        {primary}
                      </Typography.Text>
                    }
                    description={
                      <div className="flex flex-col gap-1">
                        <Typography.Text type="secondary" className="text-xs">
                          {secondary}
                        </Typography.Text>
                        <Typography.Text type="secondary" ellipsis className="text-xs">
                          {hit.snippet}
                        </Typography.Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </div>
      </Modal>
    </>
  );
}
