/** 删除云端笔记 */
export async function deleteCloudNote(token: string, clientNoteId: string): Promise<void> {
  const res = await fetch(`/api/notes/${encodeURIComponent(clientNoteId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "删除云端笔记失败");
  }
}

/** 删除云端短文本 */
export async function deleteCloudSnippet(token: string, clientSnippetId: string): Promise<void> {
  const res = await fetch(`/api/snippets/${encodeURIComponent(clientSnippetId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "删除云端短文本失败");
  }
}
