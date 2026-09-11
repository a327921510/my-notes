/** 云盘内部拖拽的自定义 MIME，用来和「从桌面拖文件进来上传」区分开。 */
export const DRAG_NODES_MIME = "application/x-mydrive-nodes";

export function writeDraggedNodeIds(dataTransfer: DataTransfer, ids: string[]): void {
  dataTransfer.setData(DRAG_NODES_MIME, JSON.stringify(ids));
  dataTransfer.effectAllowed = "move";
}

export function readDraggedNodeIds(dataTransfer: DataTransfer): string[] {
  try {
    const raw = dataTransfer.getData(DRAG_NODES_MIME);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function isNodeDrag(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer !== null && Array.from(dataTransfer.types).includes(DRAG_NODES_MIME);
}
