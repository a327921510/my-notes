import { App, Splitter } from "antd";
import { useCallback } from "react";

import { useSiteProjectBackup } from "@/hooks/useSiteProjectBackup";
import { useAuthStore } from "@/stores/useAuthStore";

import { ProjectDetailPanel } from "./components/ProjectDetailPanel";
import { ProjectsListPanel } from "./components/ProjectsListPanel";
import { useProjectsState } from "./hooks/useProjectsState";

export function ProjectsPage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const backup = useSiteProjectBackup();
  const {
    filteredProjects,
    selectedProject,
    selectedProjectId,
    searchKeyword,
    setSearchKeyword,
    setSelectedProjectId,
    addProject,
    updateProjectName,
    removeProject,
    addItem,
    updateItem,
    removeItem,
    syncProjectData,
    pullProjectData,
    syncAllWithConflict,
  } = useProjectsState();

  const handleCreateProject = useCallback(
    async (payload: { name: string }) => {
      await addProject(payload);
    },
    [addProject],
  );

  const handleRenameProject = useCallback(
    async (projectId: string, name: string) => {
      await updateProjectName(projectId, name);
    },
    [updateProjectName],
  );

  const handleSync = useCallback(async () => {
    try {
      await syncProjectData(token);
      message.success("项目与站点数据同步完成");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, syncProjectData, token]);

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
      await syncProjectData(token);
      message.success("已同步全部本地数据到云端");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, syncProjectData, token]);

  const handlePull = useCallback(async () => {
    try {
      const res = await pullProjectData(token);
      message.success(`拉取完成：项目 ${res.projectsApplied}，站点 ${res.sitesApplied}，条目 ${res.itemsApplied}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, pullProjectData, token]);

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      try {
        await removeProject(projectId, { authToken: token });
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeProject, token],
  );

  const handleDeleteItem = useCallback(
    async (projectId: string, itemId: string) => {
      try {
        await removeItem(projectId, itemId, { authToken: token });
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeItem, token],
  );

  return (
    <>
      <input {...backup.importInputProps} />
      <Splitter style={{ borderRadius: 8, boxShadow: "0 0 10px rgba(0, 0, 0, 0.08)", overflow: "hidden" }}>
      <Splitter.Panel defaultSize={320} min={260} max={480}>
        <div className="h-full p-3">
          <ProjectsListPanel
            projects={filteredProjects}
            selectedProjectId={selectedProjectId}
            searchKeyword={searchKeyword}
            onSearch={setSearchKeyword}
            onSelectProject={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
            onPullFromCloud={handlePullFromCloud}
            onPushToCloud={handlePushToCloud}
            onExportBackup={backup.exportBackup}
            onImportBackup={backup.openImportPicker}
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="h-full p-3">
          <ProjectDetailPanel
            project={selectedProject}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={handleDeleteItem}
            onSync={handleSync}
            onPull={handlePull}
          />
        </div>
      </Splitter.Panel>
    </Splitter>
    </>
  );
}

export default ProjectsPage;
