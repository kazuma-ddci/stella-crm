"use client";

import { Badge } from "@/components/ui/badge";

const journalStatusLabel: Record<string, string> = {
  draft: "下書き",
  confirmed: "確定",
};

const journalStatusColor: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
};

export function JournalStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={journalStatusColor[status] ?? ""}
    >
      {journalStatusLabel[status] ?? status}
    </Badge>
  );
}

export { journalStatusLabel };
