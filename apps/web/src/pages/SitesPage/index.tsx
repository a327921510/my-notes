import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { SitesSearchNavigationState } from "@/types/globalSearchNavigation";

import { SiteDetailPanel } from "./components/SiteDetailPanel";
import { SitesListPanel } from "./components/SitesListPanel";
import { useSitesState } from "./hooks/useSitesState";

export function SitesPage() {
  const { message } = App.useApp();
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

  const handleDeleteSite = useCallback(
    async (siteId: string) => {
      try {
        await removeSite(siteId);
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeSite],
  );

  const handleDeleteItem = useCallback(
    async (siteId: string, itemId: string) => {
      try {
        await removeItem(siteId, itemId);
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeItem],
  );

  if (!isLocalDbReady) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  return (
    <Splitter className="overflow-hidden rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.08)]">
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
            onCloneSite={cloneSite}
            onSiteProjectChange={setSiteProjectId}
            focusItemId={focusItemId}
            onFocusItemConsumed={focusItemId ? clearSitesNavState : undefined}
          />
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}

export default SitesPage;
