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
import { LineUsersContactFormModal } from "./line-users-contact-form-modal";
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
  targetType: "company_record" | "agency" | "line_users";
  companyRecordId: number | null;
  companyRecordName: string | null;
  agencyId: number | null;
  agencyName: string | null;
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
  contactCategories: ContactCategoryOption[];
};

type TargetFilter = "all" | "company_record" | "agency" | "line_users" | "unlinked";

export function ContactHistoriesClient({
  histories,
  lineFriendOptions,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  contactCategories,
}: Props) {
  const router = useRouter();
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<HistoryRow | null>(null);
  const [viewTarget, setViewTarget] = useState<HistoryRow | null>(null);
  const [zoomModalTarget, setZoomModalTarget] = useState<{
    recordingId: number;
    companyName: string | null;
    hasRetryable: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    return histories.filter((h) => {
      if (targetFilter !== "all") {
        if (targetFilter === "unlinked") {
          if (!(h.targetType === "line_users" && h.lineFriends.length === 0)) return false;
        } else if (h.targetType !== targetFilter) {
          return false;
        }
      }
      if (dateFrom && h.contactDate < dateFrom) return false;
      if (dateTo && h.contactDate > dateTo + "T23:59:59") return false;
      if (methodFilter !== "all" && String(h.contactMethodId) !== methodFilter) return false;
      if (staffFilter !== "all") {
        const ids = (h.assignedTo ?? "").split(",").map((s) => s.trim());
        if (!ids.includes(staffFilter)) return false;
      }
      return true;
    });
  }, [histories, targetFilter, dateFrom, dateTo, methodFilter, staffFilter]);

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

  return (
    <div className="space-y-4">
      {/* フィルタ */}
      <div className="rounded-lg border bg-white p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <Label className="text-xs">相手種別</Label>
          <Select value={targetFilter} onValueChange={(v) => setTargetFilter(v as TargetFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="company_record">事業者</SelectItem>
              <SelectItem value="agency">代理店</SelectItem>
              <SelectItem value="line_users">LINEユーザー</SelectItem>
              <SelectItem value="unlinked">紐付けなし</SelectItem>
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

      {/* 新規登録ボタン */}
      <div className="flex justify-end">
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          接触履歴を追加
        </Button>
      </div>

      {/* 一覧 */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日時</TableHead>
              <TableHead>相手種別</TableHead>
              <TableHead>相手</TableHead>
              <TableHead>接触方法</TableHead>
              <TableHead>接触種別</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>顧客種別タグ</TableHead>
              <TableHead>Zoom</TableHead>
              <TableHead>備考</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-gray-500 py-6">
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
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {h.targetType === "company_record" && <Badge variant="secondary">事業者</Badge>}
                      {h.targetType === "agency" && <Badge variant="secondary">代理店</Badge>}
                      {h.targetType === "line_users" && (
                        h.lineFriends.length === 0
                          ? <Badge variant="outline">紐付けなし</Badge>
                          : <Badge variant="secondary">LINEユーザー</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {h.targetType === "company_record" && h.companyRecordId && (
                        <Link
                          href={`/slp/companies/${h.companyRecordId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {h.companyRecordName ?? `事業者#${h.companyRecordId}`}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </Link>
                      )}
                      {h.targetType === "agency" && h.agencyId && (
                        <Link
                          href={`/slp/agencies/${h.agencyId}`}
                          className="text-blue-600 hover:underline"
                        >
                          {h.agencyName ?? `代理店#${h.agencyId}`}
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </Link>
                      )}
                      {h.targetType === "line_users" && (
                        h.lineFriends.length === 0
                          ? <span className="text-gray-400">-</span>
                          : (
                            <div className="space-y-0.5">
                              {h.lineFriends.map((lf) => (
                                <div key={lf.id} className="text-sm">
                                  {lf.id} {lf.snsname ?? ""}
                                </div>
                              ))}
                            </div>
                          )
                      )}
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
                    <TableCell>
                      <div className="flex items-center gap-0.5">
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
                          onClick={() => { setEditTarget(h); setModalOpen(true); }}
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

      {/* 登録モーダル */}
      <LineUsersContactFormModal
        open={isModalOpen}
        onOpenChange={setModalOpen}
        lineFriendOptions={lineFriendOptions}
        contactMethodOptions={contactMethodOptions}
        staffOptions={staffOptions}
        customerTypes={customerTypes}
        contactCategories={contactCategories}
        editTarget={editTarget}
      />

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
        <DialogContent className="max-w-6xl w-[calc(100vw-2rem)] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle>接触履歴の詳細</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3 text-sm flex-1 min-h-0 overflow-y-auto px-6 py-4">
              <DetailRow label="日時">
                {new Date(viewTarget.contactDate).toLocaleString("ja-JP", {
                  year: "numeric", month: "2-digit", day: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </DetailRow>
              <DetailRow label="相手種別">
                {viewTarget.targetType === "company_record" && "事業者"}
                {viewTarget.targetType === "agency" && "代理店"}
                {viewTarget.targetType === "line_users" &&
                  (viewTarget.lineFriends.length === 0 ? "紐付けなし" : "LINEユーザー")}
              </DetailRow>
              <DetailRow label="相手">
                {viewTarget.targetType === "company_record" && viewTarget.companyRecordId && (
                  <Link
                    href={`/slp/companies/${viewTarget.companyRecordId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {viewTarget.companyRecordName ?? `事業者#${viewTarget.companyRecordId}`}
                    <ExternalLink className="inline h-3 w-3 ml-1" />
                  </Link>
                )}
                {viewTarget.targetType === "agency" && viewTarget.agencyId && (
                  <Link
                    href={`/slp/agencies/${viewTarget.agencyId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {viewTarget.agencyName ?? `代理店#${viewTarget.agencyId}`}
                    <ExternalLink className="inline h-3 w-3 ml-1" />
                  </Link>
                )}
                {viewTarget.targetType === "line_users" &&
                  (viewTarget.lineFriends.length === 0 ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    <div className="space-y-0.5">
                      {viewTarget.lineFriends.map((lf) => (
                        <div key={lf.id}>
                          {lf.id} {lf.snsname ?? ""}
                        </div>
                      ))}
                    </div>
                  ))}
              </DetailRow>
              <DetailRow label="接触方法">{viewTarget.contactMethodName ?? "-"}</DetailRow>
              <DetailRow label="接触種別">{viewTarget.contactCategoryName ?? "-"}</DetailRow>
              <DetailRow label="担当者">
                {(viewTarget.assignedTo ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((id) => staffMap.get(id) ?? id)
                  .join(", ") || "-"}
              </DetailRow>
              <DetailRow label="顧客種別タグ">
                <div className="flex flex-wrap gap-1">
                  {viewTarget.customerTypes.length === 0 ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    viewTarget.customerTypes.map((ct) => (
                      <Badge key={ct.id} variant="outline" className="text-xs">
                        {ct.projectName ? `${ct.projectName}:` : ""}{ct.name}
                      </Badge>
                    ))
                  )}
                </div>
              </DetailRow>
              <DetailRow label="先方参加者">
                {viewTarget.customerParticipants || "-"}
              </DetailRow>
              <DetailRow label="議事録">
                {viewTarget.meetingMinutes ? (
                  <div className="whitespace-pre-wrap bg-gray-50 border rounded p-2">
                    {viewTarget.meetingMinutes}
                  </div>
                ) : "-"}
              </DetailRow>
              <DetailRow label="備考">
                {viewTarget.note ? (
                  <div className="whitespace-pre-wrap bg-gray-50 border rounded p-2">
                    {viewTarget.note}
                  </div>
                ) : "-"}
              </DetailRow>
              <DetailRow label="添付">
                {viewTarget.files.length === 0 ? (
                  <span className="text-gray-400">-</span>
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
              </DetailRow>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-gray-500 font-medium">{label}</div>
      <div>{children}</div>
    </div>
  );
}
