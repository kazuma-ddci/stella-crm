"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type HistoryRow = {
  id: number;
  contactDate: string;
  contactMethodName: string | null;
  contactCategoryName: string | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  targetType: "vendor" | "bbs" | "lender" | "other";
  vendorId: number | null;
  vendorName: string | null;
  customerTypes: { id: number; name: string; projectName: string | null }[];
};

function formatJstDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(d);
}

function targetLabel(t: string): string {
  switch (t) {
    case "vendor": return "ベンダー";
    case "bbs": return "BBS";
    case "lender": return "貸金業社";
    case "other": return "その他";
    default: return t;
  }
}

export function ContactHistoryDetailDialog({
  open,
  onOpenChange,
  row,
  staffOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: HistoryRow | null;
  staffOptions: { value: string; label: string }[];
}) {
  if (!row) return null;
  const staffLabels = (row.assignedTo ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => staffOptions.find((o) => o.value === id)?.label ?? `#${id}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>接触履歴の詳細</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">日時</div>
              <div>{formatJstDate(row.contactDate)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">相手種別</div>
              <div>
                <Badge variant="outline">{targetLabel(row.targetType)}</Badge>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">相手先</div>
            <div>
              {row.targetType === "vendor" && row.vendorId ? (
                <Link
                  href={`/hojo/settings/vendors/${row.vendorId}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {row.vendorName ?? `#${row.vendorId}`}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span>{row.customerParticipants || "-"}</span>
              )}
            </div>
          </div>

          {row.customerParticipants && row.targetType === "vendor" && (
            <div>
              <div className="text-xs text-muted-foreground">先方参加者</div>
              <div>{row.customerParticipants}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-muted-foreground">接触方法</div>
              <div>{row.contactMethodName ?? "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">接触種別</div>
              <div>{row.contactCategoryName ?? "-"}</div>
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">担当者</div>
            <div>{staffLabels.length > 0 ? staffLabels.join(", ") : "-"}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">顧客種別タグ</div>
            <div className="flex flex-wrap gap-1">
              {row.customerTypes.length === 0 && <span>-</span>}
              {row.customerTypes.map((ct) => (
                <Badge key={ct.id} variant="secondary" className="text-[10px]">
                  {ct.name}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">議事録</div>
            <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
              {row.meetingMinutes || "-"}
            </pre>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">メモ</div>
            <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
              {row.note || "-"}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
