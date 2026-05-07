import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";

import { SiteMarkdownDocPanel, type DocPanelMode } from "./components/SiteMarkdownDocPanel";
import { SitesListPanel } from "../SitesPage/components/SitesListPanel";
import { useSitesState } from "../SitesPage/hooks/useSitesState";
import { useSiteMarkdownDocument } from "./hooks/useSiteMarkdownDocument";

export function SiteMarkdownPage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const [mode, setMode] = useState<DocPanelMode>("read");
  const {
    isLocalDbReady,
    filteredSites,
    selectedSite,
    selectedSiteId,
    searchKeyword,
    setSearchKeyword,
    projectFilterId,
    setProjectFilterId,
    projectOptions,
    setSelectedSiteId,
    addSite,
    removeSite,
    syncSiteData,
    syncAllWithConflict,
  } = useSitesState();

  const { draft, setDraftAndPersist, isLoading } = useSiteMarkdownDocument(selectedSiteId);

  useEffect(() => {
    setMode("read");
  }, [selectedSiteId]);

  const handleCreateSite = useCallback(
    async (payload: { name: string; address: string; projectId?: string | null }) => {
      await addSite(payload);
    },
    [addSite],
  );

  const handlePullFromCloud = useCallback(async () => {
    try {
      const res = await syncAllWithConflict(token);
      message.success(`拉取完成：站点 ${res.pulledSites}、条目 ${res.pulledItems}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, syncAllWithConflict, token]);

  const handlePushToCloud = useCallback(async () => {
    try {
      await syncSiteData(token);
      message.success("已同步全部本地站点数据到云端");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, syncSiteData, token]);

  const handleDeleteSite = useCallback(
    async (siteId: string) => {
      try {
        await removeSite(siteId, { authToken: token });
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeSite, token],
  );

  const handleCopyEntryValue = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        message.success("已复制到剪贴板");
      } catch {
        message.error("复制失败，请检查浏览器权限");
      }
    },
    [message],
  );

  if (!isLocalDbReady) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Splitter style={{ borderRadius: 8, boxShadow: "0 0 10px rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
      <Splitter.Panel defaultSize={320} min={260} max={480}>
        <div className="h-full p-3">
          <SitesListPanel
            sites={filteredSites}
            selectedSiteId={selectedSiteId}
            searchKeyword={searchKeyword}
            projectFilterId={projectFilterId}
            projectOptions={projectOptions}
            onSearch={setSearchKeyword}
            onProjectFilterChange={setProjectFilterId}
            onSelectSite={setSelectedSiteId}
            onCreateSite={handleCreateSite}
            onDeleteSite={handleDeleteSite}
            onPullFromCloud={handlePullFromCloud}
            onPushToCloud={handlePushToCloud}
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="h-full p-3">
          {selectedSite ? (
            <SiteMarkdownDocPanel
              siteName={selectedSite.name}
              draft={draft}
              mode={mode}
              onModeChange={setMode}
              onDraftChange={setDraftAndPersist}
              onCopyEntryValue={handleCopyEntryValue}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-[#bfbfbf]">
              请先创建或选择一个站点
            </div>
          )}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}

export default SiteMarkdownPage;
