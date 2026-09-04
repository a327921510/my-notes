import { FileOutlined, FolderOutlined } from "@ant-design/icons";
import { Empty } from "antd";
import { memo } from "react";

import { type DriveDiffEntry, DriveEntryKind } from "@my-notes/shared";

import { DIFF_STATUS_META, splitPath } from "./diffStatusMeta";

export type DiffFileRowProps = {
  entry: DriveDiffEntry;
  active: boolean;
  onSelect: (key: string) => void;
};

export const DiffFileRow = memo(function DiffFileRow({ entry, active, onSelect }: DiffFileRowProps) {
  const meta = DIFF_STATUS_META[entry.status];
  const { dir, name } = splitPath(entry.path);
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.key)}
      className={`flex w-full items-center gap-2 border-0 border-b border-solid border-gray-100 px-3 py-2 text-left ${
        active ? "bg-[#ddf4ff]" : "bg-transparent hover:bg-gray-50"
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold ${meta.chipClass}`}
      >
        {meta.letter}
      </span>
      {entry.kind === DriveEntryKind.FOLDER ? (
        <FolderOutlined className="shrink-0 text-gray-400" />
      ) : (
        <FileOutlined className="shrink-0 text-gray-400" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">
        {dir ? <span className="text-gray-400">{dir}</span> : null}
        <span className="text-gray-800">{name}</span>
      </span>
    </button>
  );
});

export type DiffFileListProps = {
  entries: DriveDiffEntry[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
};

export const DiffFileList = memo(function DiffFileList({ entries, selectedKey, onSelect }: DiffFileListProps) {
  if (entries.length === 0) {
    return <Empty className="mt-10" description="没有需要对比的条目" />;
  }
  return (
    <div className="h-full overflow-auto">
      {entries.map((entry) => (
        <DiffFileRow key={entry.key} entry={entry} active={entry.key === selectedKey} onSelect={onSelect} />
      ))}
    </div>
  );
});
