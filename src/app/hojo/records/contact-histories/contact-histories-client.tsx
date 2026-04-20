"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, Eye, ExternalLink, Video } from "lucide-react";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import { ActivityContactFormModal } from "./activity-contact-form-modal";
import { ContactHistoryDetailDialog } from "./detail-dialog";
import { deleteHojoContactHistory } from "@/app/hojo/contact-histories/actions";

type HistoryRow = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactMethodName: string | null;
  contactCategoryId: number | null;
  contactCategoryName: string | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  targetType: "vendor" | "bbs" | "lender" | "other";
  vendorId: number | null;
  vendorName: string | null;
  customerTypeIds: number[];
  customerTypes: {
    id: number;
    name: string;
    projectName: string | null;
  }[];
  zoomRecordingCount: number;
};

type TargetFilter = "all" | "vendor" | "bbs" | "lender" | "other";

type Props = {
  histories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  vendorOptions: { value: string; label: string }[];
  hojoVendorCustomerTypeId: number;
  hojoBbsCustomerTypeId: number;
  hojoLenderCustomerTypeId: number;
  hojoOtherCustomerTypeId: number;
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

function targetLabel(t: TargetFilter | "all"): string {
  switch (t) {
    case "vendor": return "ベンダー";
    case "bbs": return "BBS";
    case "lender": return "貸金業社";
    case "other": return "その他";
    default: return "すべて";
  }
}

function targetBadgeClass(t: string): string {
  switch (t) {
    case "vendor": return "bg-blue-100 text-blue-900";
    case "bbs": return "bg-purple-100 text-purple-900";
    case "lender": return "bg-amber-100 text-amber-900";
    case "other": return "bg-gray-100 text-gray-900";
    default: return "";
  }
}

function targetEntityLink(row: HistoryRow): { label: string; href: string | null } {
  if (row.targetType === "vendor" && row.vendorId) {
    return {
      label: row.vendorName ?? `#${row.vendorId}`,
      href: `/hojo/settings/vendors/${row.vendorId}`,
    };
  }
  return { label: "(対象なし)", href: null };
}

export function ContactHistoriesClient({
  histories,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  contactCategories,
  vendorOptions,
  hojoVendorCustomerTypeId,
  hojoBbsCustomerTypeId,
  hojoLenderCustomerTypeId,
  hojoOtherCustomerTypeId,
}: Props) {
  const router = useRouter();
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HistoryRow | null>(null);
  const [viewTarget, setViewTarget] = useState<HistoryRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const rows = histories as unknown as HistoryRow[];

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (targetFilter !== "all" && r.targetType !== targetFilter) return false;
      if (dateFrom && r.contactDate < dateFrom) return false;
      if (dateTo && r.contactDate > `${dateTo}T23:59:59.999`) return false;
      if (methodFilter !== "all") {
        if (String(r.contactMethodId ?? "") !== methodFilter) return false;
      }
      if (categoryFilter !== "all") {
        if (String(r.contactCategoryId ?? "") !== categoryFilter) return false;
      }
      if (staffFilter !== "all") {
        const ids = r.assignedTo?.split(",").map((s) => s.trim()) ?? [];
        if (!ids.includes(staffFilter)) return false;
      }
      if (customerTypeFilter !== "all") {
        const ctId = parseInt(customerTypeFilter, 10);
        if (!r.customerTypeIds.includes(ctId)) return false;
      }
      return true;
    });
  }, [rows, targetFilter, dateFrom, dateTo, methodFilter, categoryFilter, staffFilter, customerTypeFilter]);

  const handleDelete = async (id: number) => {
    if (!confirm("この接触履歴を削除しますか？")) return;
    setDeleting(id);
    try {
      await deleteHojoContactHistory(id);
      toast.success("削除しました");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (row: HistoryRow) => {
    setEditTarget(row);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* フィルタ */}
      <div className="rounded-lg border bg-white p-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">相手種別</Label>
            <Select value={targetFilter} onValueChange={(v) => setTargetFilter(v as TargetFilter)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="vendor">ベンダー</SelectItem>
                <SelectItem value="bbs">BBS</SelectItem>
                <SelectItem value="lender">貸金業社</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">接触方法</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {contactMethodOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">接触種別</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {contactCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">担当者</Label>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {staffOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">顧客種別タグ</Label>
            <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                {customerTypes.map((ct) => (
                  <SelectItem key={ct.id} value={String(ct.id)}>{ct.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">日付From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">日付To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {filtered.length} 件 / 全 {rows.length} 件
        </span>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          接触履歴を追加
        </Button>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">日時</TableHead>
              <TableHead className="w-[80px]">種別</TableHead>
              <TableHead>相手先</TableHead>
              <TableHead className="w-[90px]">接触方法</TableHead>
              <TableHead className="w-[90px]">接触種別</TableHead>
              <TableHead>議事録/メモ</TableHead>
              <TableHead className="w-[60px]">Zoom</TableHead>
              <TableHead className="w-[140px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  接触履歴はありません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const entity = targetEntityLink(r);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatJstDate(r.contactDate)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${targetBadgeClass(r.targetType)}`}>
                      {targetLabel(r.targetType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {entity.href ? (
                      <Link
                        href={entity.href}
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {entity.label}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.customerParticipants || entity.label}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.contactMethodName ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.contactCategoryName ?? "-"}</TableCell>
                  <TableCell className="text-xs max-w-[300px] truncate">
                    {r.meetingMinutes || r.note || "-"}
                  </TableCell>
                  <TableCell>
                    {r.zoomRecordingCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        <Video className="h-3 w-3 mr-0.5" />
                        {r.zoomRecordingCount}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5"
                        onClick={() => setViewTarget(r)}
                        title="詳細"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5"
                        onClick={() => handleEdit(r)}
                        title="編集"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-red-600"
                        onClick={() => handleDelete(r.id)}
                        disabled={deleting === r.id}
                        title="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ActivityContactFormModal
        open={isModalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditTarget(null);
        }}
        editTarget={
          editTarget
            ? {
                id: editTarget.id,
                contactDate: editTarget.contactDate,
                contactMethodId: editTarget.contactMethodId,
                contactCategoryId: editTarget.contactCategoryId,
                assignedTo: editTarget.assignedTo,
                customerParticipants: editTarget.customerParticipants,
                meetingMinutes: editTarget.meetingMinutes,
                note: editTarget.note,
                targetType: editTarget.targetType,
                vendorId: editTarget.vendorId,
                customerTypeIds: editTarget.customerTypeIds,
              }
            : null
        }
        contactMethodOptions={contactMethodOptions}
        staffOptions={staffOptions}
        customerTypes={customerTypes}
        contactCategories={contactCategories}
        vendorOptions={vendorOptions}
        hojoVendorCustomerTypeId={hojoVendorCustomerTypeId}
        hojoBbsCustomerTypeId={hojoBbsCustomerTypeId}
        hojoLenderCustomerTypeId={hojoLenderCustomerTypeId}
        hojoOtherCustomerTypeId={hojoOtherCustomerTypeId}
        onSaved={() => router.refresh()}
      />

      <ContactHistoryDetailDialog
        open={!!viewTarget}
        onOpenChange={(o) => {
          if (!o) setViewTarget(null);
        }}
        row={viewTarget}
        staffOptions={staffOptions}
      />
    </div>
  );
}
