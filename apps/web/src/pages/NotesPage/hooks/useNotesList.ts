import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "@/db/database";

/** 仅订阅笔记列表，供树等需要全量列表的组件使用。 */
export function useNotesList() {
  const notes = useLiveQuery(() => db.notes.filter((n) => !n.deletedAt).sortBy("updatedAt"), []);
  return useMemo(() => ({ notes }), [notes]);
}
