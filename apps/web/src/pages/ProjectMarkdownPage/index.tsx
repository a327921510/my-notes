import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useState } from "react";

import { useAuthStore } from "@/stores/useAuthStore";

import { ProjectMarkdownDocPanel, type ProjectDocPanelMode } from "./components/ProjectMarkdownDocPanel";
import { ProjectsListPanel } from "../ProjectsPage/components/ProjectsListPanel";
import { useProjectsState } from "../ProjectsPage/hooks/useProjectsState";
import { useProjectMarkdownDocument } from "./hooks/useProjectMarkdownDocument";

export function ProjectMarkdownPage() {
  const { message } = App.useApp();
  const token = useAuthStore((s) => s.token);
  const [mode, setMode] = useState<ProjectDocPanelMode>("read");
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
    syncProjectData,
    syncAllWithConflict,
  } = useProjectsState();

  const { draft, setDraftAndPersist, isLoading } = useProjectMarkdownDocument(selectedProjectId);

  useEffect(() => {
    setMode("read");
  }, [selectedProjectId]);

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
      message.success("已同步全部本地站点数据到云端");
    } catch (e) {
      message.error((e as Error).message);
    }
  }, [message, syncProjectData, token]);

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

  const handleCopyCell = useCallback(
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
          />
        </div>
      </Splitter.Panel>
      <Splitter.Panel>
        <div className="h-full p-3">
          {selectedProject ? (
            <ProjectMarkdownDocPanel
              projectName={selectedProject.name}
              draft={draft}
              mode={mode}
              onModeChange={setMode}
              onDraftChange={setDraftAndPersist}
              onCopyCell={handleCopyCell}
              isLoading={isLoading}
            />
          ) : (
            <div className="flex h-full min-h-[200px] items-center justify-center text-[#bfbfbf]">
              请先创建或选择一个项目
            </div>
          )}
        </div>
      </Splitter.Panel>
    </Splitter>
  );
}

export default ProjectMarkdownPage;
