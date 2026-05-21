import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { ProjectsSearchNavigationState } from "@/types/globalSearchNavigation";

import { ProjectDetailPanel } from "./components/ProjectDetailPanel";
import { ProjectsListPanel } from "./components/ProjectsListPanel";
import { useProjectsState } from "./hooks/useProjectsState";

export function ProjectsPage() {
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const { focusProjectId, focusItemId } = useMemo(() => {
    const s = location.state as ProjectsSearchNavigationState | undefined;
    return { focusProjectId: s?.focusProjectId, focusItemId: s?.focusItemId };
  }, [location.state]);

  const {
    isLocalDbReady,
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
  } = useProjectsState();

  useEffect(() => {
    if (focusProjectId) setSelectedProjectId(focusProjectId);
  }, [focusProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (focusItemId) return;
    if (!focusProjectId) return;
    navigate(".", { replace: true, state: {} });
  }, [navigate, focusItemId, focusProjectId]);

  const clearProjectsNavState = useCallback(() => {
    navigate(".", { replace: true, state: {} });
  }, [navigate]);

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

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      try {
        await removeProject(projectId);
      } catch (e) {
        message.error((e as Error).message);
      }
    },
    [message, removeProject],
  );

  const handleDeleteItem = useCallback(
    async (projectId: string, itemId: string) => {
      try {
        await removeItem(projectId, itemId);
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
          <ProjectsListPanel
            projects={filteredProjects}
            selectedProjectId={selectedProjectId}
            searchKeyword={searchKeyword}
            onSearch={setSearchKeyword}
            onSelectProject={setSelectedProjectId}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
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
            focusItemId={focusItemId}
            onFocusItemConsumed={focusItemId ? clearProjectsNavState : undefined}
          />
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}

export default ProjectsPage;
