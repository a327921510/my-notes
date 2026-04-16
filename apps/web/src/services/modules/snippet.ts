import { request } from "../request";

export const snippetApi = {
  delete: (clientSnippetId: string) =>
    request.delete(`/snippets/${encodeURIComponent(clientSnippetId)}`),
};
