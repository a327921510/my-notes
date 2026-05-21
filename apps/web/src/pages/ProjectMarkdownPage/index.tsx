import { App, Spin, Splitter } from "antd";
import { useCallback, useEffect, useState } from "react";

import { ProjectMarkdownDocPanel, type ProjectDocPanelMode } from "./components/ProjectMarkdownDocPanel";
import { ProjectsListPanel } from "../ProjectsPage/components/ProjectsListPanel";
import { useProjectsState } from "../ProjectsPage/hooks/useProjectsState";
import { useProjectMarkdownDocument } from "./hooks/useProjectMarkdownDocument";

export function ProjectMarkdownPage() {
  const { message } = App.useApp();
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
