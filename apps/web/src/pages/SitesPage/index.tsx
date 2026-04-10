import { App, Splitter } from "antd";
import { useCallback } from "react";
import { useAuth } from "@/auth/AuthContext";
import { SiteDetailPanel } from "./components/SiteDetailPanel";
import { SitesListPanel } from "./components/SitesListPanel";
import { useSitesState } from "./hooks/useSitesState";

export function SitesPage() {
  const { message } = App.useApp();
  const { token } = useAuth();
  const {
    filteredSites,
    selectedSite,
    selectedSiteId,
    searchKeyword,
    setSearchKeyword,
    setSelectedSiteId,
    addSite,
    cloneSite,
    removeSite,
    addItem,
    updateItem,
    removeItem,
    syncSiteData,
    pullSiteData,
    syncAllWithConflict,
  } = useSitesState();

  const handleCreateSite = useCallback(
    async (payload: { name: string; address: string }) => {
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
      const { sitesApplied, itemsApplied } = await pullSiteData(token);
      message.success(`拉取完成：站点 ${sitesApplied}，条目 ${itemsApplied}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, pullSiteData, token]);

  return (
    <Splitter style={{ borderRadius: 8, boxShadow: "0 0 10px rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
      <Splitter.Panel defaultSize={320} min={260} max={480}>
        <div className="h-full p-3">
          <SitesListPanel
            sites={filteredSites}
            selectedSiteId={selectedSiteId}
            searchKeyword={searchKeyword}
            onSearch={setSearchKeyword}
            onSelectSite={setSelectedSiteId}
            onCreateSite={handleCreateSite}
            onDeleteSite={removeSite}
            onPullFromCloud={handlePullFromCloud}
            onPushToCloud={handlePushToCloud}
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="h-full p-3">
          <SiteDetailPanel
            site={selectedSite}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={removeItem}
            onSync={handleSync}
            onPull={handlePull}
            onCloneSite={cloneSite}
          />
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}
