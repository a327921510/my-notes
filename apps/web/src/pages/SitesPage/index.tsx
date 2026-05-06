import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { SitesSearchNavigationState } from "@/types/globalSearchNavigation";
import { useAuthStore } from "@/stores/useAuthStore";

import { SiteDetailPanel } from "./components/SiteDetailPanel";
import { SitesListPanel } from "./components/SitesListPanel";
import { useSitesState } from "./hooks/useSitesState";

export function SitesPage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const navigate = useNavigate();
  const { focusSiteId, focusItemId } = useMemo(() => {
    const s = location.state as SitesSearchNavigationState | undefined;
    return { focusSiteId: s?.focusSiteId, focusItemId: s?.focusItemId };
  }, [location.state]);
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
    cloneSite,
    removeSite,
    setSiteProjectId,
    addItem,
    updateItem,
    removeItem,
    syncSiteData,
    pullSiteData,
    syncAllWithConflict,
  } = useSitesState();

  useEffect(() => {
    if (focusSiteId) setSelectedSiteId(focusSiteId);
  }, [focusSiteId, setSelectedSiteId]);

  useEffect(() => {
    if (focusItemId) return;
    if (!focusSiteId) return;
    navigate(".", { replace: true, state: {} });
  }, [navigate, focusItemId, focusSiteId]);

  const clearSitesNavState = useCallback(() => {
    navigate(".", { replace: true, state: {} });
  }, [navigate]);

  const handleCreateSite = useCallback(
    async (payload: { name: string; address: string; projectId?: string | null }) => {
      await addSite(payload);
    },
    [addSite],
  );

  const handleSync = useCallback(async () => {
    try {
      await syncSiteData(token, selectedSite?.id ?? null);
      message.success("站点数据同步完成");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, selectedSite?.id, syncSiteData, token]);

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

  const handlePull = useCallback(async () => {
    try {
      const res = await pullSiteData(token);
      message.success(`拉取完成：项目 ${res.projectsApplied}，站点 ${res.sitesApplied}，条目 ${res.itemsApplied}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, pullSiteData, token]);

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

  const handleDeleteItem = useCallback(
    async (siteId: string, itemId: string) => {
      try {
        await removeItem(siteId, itemId, { authToken: token });
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeItem, token],
  );

  if (!isLocalDbReady) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  console.log(33333, focusSiteId, focusItemId);
  return (
    <>
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
            <SiteDetailPanel
              site={selectedSite}
              projectOptions={projectOptions}
              onAddItem={addItem}
              onUpdateItem={updateItem}
              onDeleteItem={handleDeleteItem}
              onSync={handleSync}
              onPull={handlePull}
              onCloneSite={cloneSite}
              onSiteProjectChange={setSiteProjectId}
              focusItemId={focusItemId}
              onFocusItemConsumed={focusItemId ? clearSitesNavState : undefined}
            />
          </div>
        </Splitter.Panel>
      </Splitter>
    </>
  );
}

export default SitesPage;
