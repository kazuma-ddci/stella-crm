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
import { Plus, ExternalLink, Trash2, Pencil, Eye, FileText, Link as LinkIcon, Video } from "lucide-react";
import { UnifiedDetailModal } from "@/app/slp/records/zoom-recordings/unified-detail-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import type { FileInfo } from "@/components/multi-file-upload";
import { ActivityContactForm, type EditTarget } from "./activity-contact-form-modal";
import { deleteSlpContactHistory } from "@/app/slp/contact-histories/actions";

type LineFriendOption = { id: number; label: string };

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
  targetType: string;
  companyRecordId: number | null;
  companyRecordName: string | null;
  agencyId: number | null;
  agencyName: string | null;
  sessionId: number | null;
  customerTypeIds: number[];
  customerTypes: {
    id: number;
    name: string;
    code: string;
    projectId: number;
    projectName: string | null;
    projectCode: string | null;
  }[];
  lineFriends: { id: number; snsname: string | null; uid: string }[];
  files: {
    id: number;
    fileName: string;
    filePath: string | null;
    fileSize: number | null;
    mimeType: string | null;
    url: string | null;
  }[];
  zoomRecordings: {
    id: number;
    zoomMeetingId: string;
    label: string | null;
    isPrimary: boolean;
    state: string;
    downloadStatus: string;
    allFetched: boolean;
    hasAiSummary: boolean;
    hasMp4: boolean;
    hasTranscript: boolean;
    hasChat: boolean;
    hasParticipants: boolean;
  }[];
};

type Props = {
  histories: HistoryRow[];
  lineFriendOptions: LineFriendOption[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  companyRecordOptions: { value: string; label: string }[];
  agencyOptions: { value: string; label: string }[];
  sessionOptionsByCompany: Record<number, { value: string; label: string }[]>;
  slpCompanyCustomerTypeId: number;
  slpAgencyCustomerTypeId: number;
  slpLineUsersCustomerTypeId: number;
  slpOtherCustomerTypeId: number;
};

export function ContactHistoriesClient({
  histories,
  lineFriendOptions,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
  contactCategories,
  companyRecordOptions,
  agencyOptions,
  sessionOptionsByCompany,
  slpCompanyCustomerTypeId,
  slpAgencyCustomerTypeId,
  slpLineUsersCustomerTypeId,
  slpOtherCustomerTypeId,
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
  const [zoomModalTarget, setZoomModalTarget] = useState<{
    recordingId: number;
    companyName: string | null;
    hasRetryable: boolean;
  } | null>(null);

  const slpCustomerTypes = useMemo(
    () => customerTypes.filter((ct) => ct.project.name && (ct.projectId === customerTypes.find((x) => x.id === slpCompanyCustomerTypeId)?.projectId)),
    [customerTypes, slpCompanyCustomerTypeId]
  );

  const filtered = useMemo(() => {
    return histories.filter((h) => {
      if (customerTypeFilter !== "all") {
        const ctId = parseInt(customerTypeFilter, 10);
        if (!h.customerTypeIds.includes(ctId)) return false;
      }
      if (dateFrom && h.contactDate < dateFrom) return false;
      if (dateTo && h.contactDate > dateTo + "T23:59:59") return false;
      if (methodFilter !== "all" && String(h.contactMethodId) !== methodFilter) return false;
      if (categoryFilter !== "all" && String(h.contactCategoryId) !== categoryFilter) return false;
      if (staffFilter !== "all") {
        const ids = (h.assignedTo ?? "").split(",").map((s) => s.trim());
        if (!ids.includes(staffFilter)) return false;
      }
      return true;
    });
  }, [histories, customerTypeFilter, dateFrom, dateTo, methodFilter, categoryFilter, staffFilter]);

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffOptions) m.set(s.value, s.label);
    return m;
  }, [staffOptions]);

  const handleDelete = async (id: number) => {
    if (!confirm("この接触履歴を削除してよろしいですか？")) return;
    try {
      await deleteSlpContactHistory(id);
      toast.success("接触履歴を削除しました");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
    }
  };

  const toEditTarget = (h: HistoryRow): EditTarget => ({
    id: h.id,
    contactDate: h.contactDate,
    contactMethodId: h.contactMethodId,
    contactCategoryId: h.contactCategoryId,
    assignedTo: h.assignedTo,
    customerParticipants: h.customerParticipants,
    meetingMinutes: h.meetingMinutes,
    note: h.note,
    targetType: h.targetType,
    companyRecordId: h.companyRecordId,
    agencyId: h.agencyId,
    sessionId: h.sessionId,
    customerTypeIds: h.customerTypeIds,
    lineFriends: h.lineFriends,
    files: h.files as unknown as FileInfo[],
  });

  return (
    <div className="space-y-4">
      {/* フィルタ */}
      <div className="rounded-lg border bg-white p-4 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div>
          <Label className="text-xs">顧客種別</Label>
          <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {slpCustomerTypes.map((ct) => (
                <SelectItem key={ct.id} value={String(ct.id)}>{ct.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">接触方法</Label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
            <SelectTrigger><SelectValue /></SelectTrigger>
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
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">期間To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* 新規登録ボタン / インラインフォーム */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {filtered.length} 件 / 全 {histories.length} 件
        </span>
        {!isFormOpen && (
          <Button onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            接触履歴を追加
          </Button>
        )}
      </div>

      {/* インラインフォーム（事業者詳細タブと同じUI） */}
      <ActivityContactForm
        open={isFormOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        editTarget={editTarget ? toEditTarget(editTarget) : null}
        contactMethodOptions={contactMethodOptions}
        staffOptions={staffOptions}
        customerTypes={customerTypes}
        staffByProject={staffByProject}
        contactCategories={contactCategories}
        companyRecordOptions={companyRecordOptions}
        agencyOptions={agencyOptions}
        lineFriendOptions={lineFriendOptions}
        sessionOptionsByCompany={sessionOptionsByCompany}
        slpCompanyCustomerTypeId={slpCompanyCustomerTypeId}
        slpAgencyCustomerTypeId={slpAgencyCustomerTypeId}
        slpLineUsersCustomerTypeId={slpLineUsersCustomerTypeId}
        slpOtherCustomerTypeId={slpOtherCustomerTypeId}
        onSaved={() => router.refresh()}
      />

      {/* 一覧 */}
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
              <TableHead className="w-[120px] sticky right-0 z-20 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-6">
                  該当する接触履歴はありません
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((h) => {
                const assignees = (h.assignedTo ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((id) => staffMap.get(id) ?? id);
                return (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(h.contactDate).toLocaleString("ja-JP", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {h.companyRecordId && (
                          <Link
                            href={`/slp/companies/${h.companyRecordId}`}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            {h.companyRecordName ?? `事業者#${h.companyRecordId}`}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {h.agencyId && (
                          <Link
                            href={`/slp/agencies/${h.agencyId}`}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
                          >
                            {h.agencyName ?? `代理店#${h.agencyId}`}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        {h.lineFriends.length > 0 && (
                          <div className="text-sm">
                            {h.lineFriends.map((lf) => `${lf.id} ${lf.snsname ?? ""}`).join(", ")}
                          </div>
                        )}
                        {!h.companyRecordId && !h.agencyId && h.lineFriends.length === 0 && (
                          <span className="text-sm text-muted-foreground">
                            {h.customerParticipants || "-"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{h.contactMethodName ?? "-"}</TableCell>
                    <TableCell>{h.contactCategoryName ?? "-"}</TableCell>
                    <TableCell>{assignees.join(", ") || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {h.customerTypes.map((ct) => (
                          <Badge key={ct.id} variant="outline" className="text-xs">
                            {ct.projectName ? `${ct.projectName}:` : ""}{ct.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {h.zoomRecordings.length === 0 ? (
                        <span className="text-gray-400 text-xs">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {h.zoomRecordings.map((zr) => (
                            <Button
                              key={zr.id}
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setZoomModalTarget({
                                  recordingId: zr.id,
                                  companyName: h.companyRecordName,
                                  hasRetryable: !zr.allFetched,
                                })
                              }
                            >
                              <Video className="h-3 w-3 mr-1" />
                              {zr.label ?? (zr.isPrimary ? "録画" : `録画#${zr.id}`)}
                              {zr.allFetched ? (
                                <span className="ml-1 text-green-700">✓</span>
                              ) : (
                                <span className="ml-1 text-amber-700">○</span>
                              )}
                            </Button>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{h.note ?? "-"}</TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="詳細を見る"
                          onClick={() => setViewTarget(h)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="編集"
                          onClick={() => { setEditTarget(h); setFormOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="削除"
                          onClick={() => handleDelete(h.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Zoom統合モーダル（Zoom商談録画ページと同じもの） */}
      {zoomModalTarget && (
        <UnifiedDetailModal
          open={!!zoomModalTarget}
          onOpenChange={(o) => !o && setZoomModalTarget(null)}
          recordingId={zoomModalTarget.recordingId}
          hasRetryable={zoomModalTarget.hasRetryable}
          companyName={zoomModalTarget.companyName}
        />
      )}

      {/* 詳細表示ダイアログ */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent size="fullwidth" className="sm:!max-w-[880px] max-h-[74vh] h-[74vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle>接触履歴の詳細</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <DetailField label="日時">
                {new Date(viewTarget.contactDate).toLocaleString("ja-JP", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </DetailField>

              <DetailField label="相手">
                <div className="space-y-1">
                  {viewTarget.companyRecordId && (
                    <Link
                      href={`/slp/companies/${viewTarget.companyRecordId}`}
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      事業者: {viewTarget.companyRecordName ?? `#${viewTarget.companyRecordId}`}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {viewTarget.agencyId && (
                    <Link
                      href={`/slp/agencies/${viewTarget.agencyId}`}
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      代理店: {viewTarget.agencyName ?? `#${viewTarget.agencyId}`}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {viewTarget.lineFriends.length > 0 && (
                    <div>
                      LINEユーザー:{" "}
                      {viewTarget.lineFriends.map((lf) => `${lf.id} ${lf.snsname ?? ""}`).join(", ")}
                    </div>
                  )}
                  {!viewTarget.companyRecordId &&
                    !viewTarget.agencyId &&
                    viewTarget.lineFriends.length === 0 &&
                    (viewTarget.customerParticipants ? (
                      <span>{viewTarget.customerParticipants}</span>
                    ) : (
                      <EmptyText />
                    ))}
                </div>
              </DetailField>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailField label="接触方法">
                  {viewTarget.contactMethodName ?? <EmptyText />}
                </DetailField>
                <DetailField label="接触種別">
                  {viewTarget.contactCategoryName ?? <EmptyText />}
                </DetailField>
              </div>

              <DetailField label="担当者">
                {(() => {
                  const names = (viewTarget.assignedTo ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((id) => staffMap.get(id) ?? id);
                  return names.length === 0 ? <EmptyText /> : names.join(", ");
                })()}
              </DetailField>

              <DetailField label="顧客種別タグ" variant="tags">
                {viewTarget.customerTypes.length === 0 ? (
                  <EmptyText />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {viewTarget.customerTypes.map((ct) => (
                      <Badge key={ct.id} variant="outline" className="text-xs">
                        {ct.projectName ? `${ct.projectName}:` : ""}{ct.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </DetailField>

              <DetailField label="先方参加者">
                {viewTarget.customerParticipants || <EmptyText />}
              </DetailField>

              <DetailField label="議事録" variant="textarea">
                {viewTarget.meetingMinutes ? (
                  <div className="whitespace-pre-wrap">{viewTarget.meetingMinutes}</div>
                ) : (
                  <EmptyText />
                )}
              </DetailField>

              <DetailField label="備考" variant="textarea">
                {viewTarget.note ? (
                  <div className="whitespace-pre-wrap">{viewTarget.note}</div>
                ) : (
                  <EmptyText />
                )}
              </DetailField>

              <DetailField label="添付" variant="tags">
                {viewTarget.files.length === 0 ? (
                  <EmptyText />
                ) : (
                  <div className="space-y-1">
                    {viewTarget.files.map((f) => {
                      const href = f.url || f.filePath || "#";
                      const isUrl = !!f.url && !f.filePath;
                      return (
                        <a
                          key={f.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 hover:underline"
                        >
                          {isUrl ? <LinkIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          {f.fileName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </DetailField>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({
  label,
  children,
  variant = "default",
}: {
  label: string;
  children: React.ReactNode;
  variant?: "default" | "textarea" | "tags";
}) {
  const boxClass =
    variant === "textarea"
      ? "min-h-[96px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
      : variant === "tags"
        ? "min-h-10 w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-sm"
        : "flex min-h-10 w-full items-center rounded-md border border-input bg-muted/30 px-3 py-2 text-sm";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={boxClass}>{children}</div>
    </div>
  );
}

function EmptyText() {
  return <span className="text-gray-400">-</span>;
}
