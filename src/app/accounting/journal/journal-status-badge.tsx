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

const realizationStatusLabel: Record<string, string> = {
  realized: "実現",
  unrealized: "未実現",
};

const realizationStatusColor: Record<string, string> = {
  realized: "bg-blue-100 text-blue-800 border-blue-200",
  unrealized: "bg-orange-100 text-orange-800 border-orange-200",
};

export function RealizationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={realizationStatusColor[status] ?? ""}
    >
      {realizationStatusLabel[status] ?? status}
    </Badge>
  );
}

export { journalStatusLabel };
