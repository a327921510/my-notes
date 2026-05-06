/** `navigate(..., { state })` payloads used by全局条目搜索跳转 */

export type NotesSearchNavigationState = {
  focusNoteId?: string;
};

export type SitesSearchNavigationState = {
  focusSiteId?: string;
  focusItemId?: string;
};

export type ProjectsSearchNavigationState = {
  focusProjectId?: string;
  focusItemId?: string;
};
