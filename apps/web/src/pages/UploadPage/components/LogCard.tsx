import { Card } from "antd";
import { memo } from "react";

export type LogCardProps = {
  log: string[];
};

export const LogCard = memo(function LogCard({ log }: LogCardProps) {
  return (
    <Card size="small" className="mt-4" title="日志">
      <ul className="max-h-64 overflow-auto rounded border border-[#f0f0f0] bg-[#fafafa] p-2 font-mono text-xs">
        {log.length === 0 ? <li className="text-[#9ca3af]">暂无</li> : null}
        {log.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </Card>
  );
});
