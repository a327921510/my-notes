import { request } from "../request";

export const noteApi = {
  delete: (clientNoteId: string) =>
    request.delete(`/notes/${encodeURIComponent(clientNoteId)}`),
};
