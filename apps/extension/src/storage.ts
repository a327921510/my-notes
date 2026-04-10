import type { SnippetRecord } from "@my-notes/shared";

const KEY = "my_notes_snippets_v1";

export async function loadSnippets(): Promise<SnippetRecord[]> {
  const raw = await chrome.storage.local.get(KEY);
  const v = raw[KEY];
  if (!Array.isArray(v)) return [];
  return v as SnippetRecord[];
}

export async function saveSnippets(items: SnippetRecord[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: items });
}
