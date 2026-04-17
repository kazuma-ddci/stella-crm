import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/lib/slp/session-helper";

const STATUS_STYLES: Record<SessionStatus, string> = {
  未予約: "bg-gray-100 text-gray-700 border-gray-300",
  予約中: "bg-blue-100 text-blue-800 border-blue-300",
  完了: "bg-green-100 text-green-800 border-green-300",
  キャンセル: "bg-neutral-200 text-neutral-600 border-neutral-400",
  飛び: "bg-red-100 text-red-800 border-red-300",
};

export function SessionStatusBadge({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {status}
    </span>
  );
}

export function SourceBadge({
  source,
  className,
}: {
  source: "proline" | "manual";
  className?: string;
}) {
  const label = source === "proline" ? "プロライン経由" : "手動セット";
  const color =
    source === "proline"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium",
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
