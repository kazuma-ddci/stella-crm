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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Eye, ExternalLink, Video } from "lucide-react";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import type { FileInfo } from "@/components/multi-file-upload";
import { ActivityContactForm, type HojoEditTarget } from "./activity-contact-form-modal";
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
  files?: FileInfo[];
  zoomRecordingCount: number;
};

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

export function ContactHistoriesClient({
  histories,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
  contactCategories,
  vendorOptions,
  hojoVendorCustomerTypeId,
  hojoBbsCustomerTypeId,
  hojoLenderCustomerTypeId,
  hojoOtherCustomerTypeId,
}: Props) {
  const router = useRouter();
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [isFormOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HistoryRow | null>(null);
  const [viewTarget, setViewTarget] = useState<HistoryRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const rows = histories as unknown as HistoryRow[];

  // HOJOの顧客種別のみフィルタ選択肢に
  const hojoCustomerTypes = useMemo(() => {
    const hojoProjectId = customerTypes.find((c) => c.id === hojoVendorCustomerTypeId)?.projectId;
    return hojoProjectId ? customerTypes.filter((c) => c.projectId === hojoProjectId) : [];
  }, [customerTypes, hojoVendorCustomerTypeId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (customerTypeFilter !== "all") {
        const ctId = parseInt(customerTypeFilter, 10);
        if (!r.customerTypeIds.includes(ctId)) return false;
      }
      if (dateFrom && r.contactDate < dateFrom) return false;
      if (dateTo && r.contactDate > `${dateTo}T23:59:59.999`) return false;
      if (methodFilter !== "all" && String(r.contactMethodId ?? "") !== methodFilter) return false;
      if (categoryFilter !== "all" && String(r.contactCategoryId ?? "") !== categoryFilter) return false;
      if (staffFilter !== "all") {
        const ids = r.assignedTo?.split(",").map((s) => s.trim()) ?? [];
        if (!ids.includes(staffFilter)) return false;
      }
      return true;
    });
  }, [rows, customerTypeFilter, dateFrom, dateTo, methodFilter, categoryFilter, staffFilter]);

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffOptions) m.set(s.value, s.label);
    return m;
  }, [staffOptions]);

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

  const toEditTarget = (h: HistoryRow): HojoEditTarget => ({
    id: h.id,
    contactDate: h.contactDate,
    contactMethodId: h.contactMethodId,
    contactCategoryId: h.contactCategoryId,
    assignedTo: h.assignedTo,
    customerParticipants: h.customerParticipants,
    meetingMinutes: h.meetingMinutes,
    note: h.note,
    targetType: h.targetType,
    vendorId: h.vendorId,
    customerTypeIds: h.customerTypeIds,
    files: h.files,
  });

  return (
    <div className="space-y-3">
      {/* フィルタ */}
      <div className="rounded-lg border bg-white p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs">顧客種別</Label>
          <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {hojoCustomerTypes.map((ct) => (
                <SelectItem key={ct.id} value={String(ct.id)}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">接触方法</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {contactMethodOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">接触種別</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {contactCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">担当者</Label>
          <Select value={staffFilter} onValueChange={setStaffFilter}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {staffOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">期間From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">期間To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {filtered.length} 件 / 全 {rows.length} 件
        </span>
        {!isFormOpen && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            接触履歴を追加
          </Button>
        )}
      </div>

      {/* インラインフォーム（ベンダー詳細タブと同じUI） */}
      <ActivityContactForm
        open={isFormOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editTarget={editTarget ? toEditTarget(editTarget) : null}
        contactMethodOptions={contactMethodOptions}
        staffOptions={staffOptions}
        customerTypes={customerTypes}
        staffByProject={staffByProject}
        contactCategories={contactCategories}
        vendorOptions={vendorOptions}
        hojoVendorCustomerTypeId={hojoVendorCustomerTypeId}
        hojoBbsCustomerTypeId={hojoBbsCustomerTypeId}
        hojoLenderCustomerTypeId={hojoLenderCustomerTypeId}
        hojoOtherCustomerTypeId={hojoOtherCustomerTypeId}
        onSaved={() => router.refresh()}
      />

      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>相手</TableHead>
              <TableHead>接触方法</TableHead>
              <TableHead>接触種別</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>顧客種別タグ</TableHead>
              <TableHead>Zoom</TableHead>
              <TableHead>備考</TableHead>
              <TableHead className="w-[120px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  接触履歴はありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const assignees = (r.assignedTo ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((id) => staffMap.get(id) ?? id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatJstDate(r.contactDate)}
                    </TableCell>
                    <TableCell>
                      {r.vendorId ? (
                        <Link
                          href={`/hojo/settings/vendors/${r.vendorId}`}
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
                        >
                          {r.vendorName ?? `ベンダー#${r.vendorId}`}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {r.customerParticipants || "-"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.contactMethodName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{r.contactCategoryName ?? "-"}</TableCell>
                    <TableCell className="text-xs">{assignees.join(", ") || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.customerTypes.map((ct) => (
                          <Badge key={ct.id} variant="outline" className="text-[10px]">
                            {ct.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.zoomRecordingCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <Video className="h-3 w-3 mr-0.5" />
                          {r.zoomRecordingCount}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[300px] truncate">
                      {r.note || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5 justify-center">
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
                          onClick={() => { setEditTarget(r); setFormOpen(true); }}
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 詳細表示ダイアログ */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>接触履歴の詳細</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">日時</div>
                  <div>{formatJstDate(viewTarget.contactDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">相手</div>
                  <div>
                    {viewTarget.vendorId ? (
                      <Link
                        href={`/hojo/settings/vendors/${viewTarget.vendorId}`}
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        {viewTarget.vendorName ?? `#${viewTarget.vendorId}`}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span>{viewTarget.customerParticipants || "-"}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-muted-foreground">接触方法</div>
                  <div>{viewTarget.contactMethodName ?? "-"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">接触種別</div>
                  <div>{viewTarget.contactCategoryName ?? "-"}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">担当者</div>
                <div>
                  {(() => {
                    const names = (viewTarget.assignedTo ?? "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((id) => staffMap.get(id) ?? id);
                    return names.length > 0 ? names.join(", ") : "-";
                  })()}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">顧客種別タグ</div>
                <div className="flex flex-wrap gap-1">
                  {viewTarget.customerTypes.length === 0 && <span>-</span>}
                  {viewTarget.customerTypes.map((ct) => (
                    <Badge key={ct.id} variant="secondary" className="text-[10px]">
                      {ct.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">先方参加者</div>
                <div>{viewTarget.customerParticipants || "-"}</div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">議事録</div>
                <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
                  {viewTarget.meetingMinutes || "-"}
                </pre>
              </div>

              <div>
                <div className="text-xs text-muted-foreground">備考</div>
                <pre className="whitespace-pre-wrap rounded bg-muted/30 p-2 text-xs">
                  {viewTarget.note || "-"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
