"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { InlineCell } from "@/components/inline-cell";
import { DatePicker } from "@/components/ui/date-picker";
import { Pencil } from "lucide-react";
import { recordPasswordResetRequest, updateBbsFields, type BbsEditableFields } from "./actions";
import Link from "next/link";
import {
  PortalLoginWrapper,
  PortalCard,
} from "@/components/hojo-portal";
import { BbsPortalLayout } from "@/components/hojo/bbs-portal-layout";
import type { ModifiedAnswers, FileInfo } from "@/components/hojo/form-answer-editor";
import { FormAnswerViewerModal } from "@/components/hojo/form-answer-viewer-modal";

type SubmissionSummary = {
  id: number;
  answers: Record<string, unknown>;
  modifiedAnswers: ModifiedAnswers | null;
  fileUrls: Record<string, FileInfo> | null;
};

type BbsRecord = {
  id: number;
  applicantName: string;
  formTranscriptDate: string;
  applicationFormDate: string;
  bbsStatusId: number | null;
  bbsTransferAmount: number | null;
  bbsTransferDate: string;
  subsidyReceivedDate: string;
  alkesMemo: string;
  bbsMemo: string;
  submission: SubmissionSummary | null;
};

type StatusOption = { value: string; label: string };

type Props = {
  authenticated: boolean;
  isBbs: boolean;
  canEdit?: boolean;
  data: BbsRecord[];
  userName?: string;
  bbsStatusOptions?: StatusOption[];
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { identifier: email, password, redirect: false });
      if (result?.error) {
        if (result.code === "pending_approval") setError("アカウントは認証待ち中です。しばらくお待ちください。");
        else if (result.code === "suspended") setError("アカウントが停止されています。");
        else setError("メールアドレスまたはパスワードが正しくありません");
      } else router.refresh();
    } catch { setError("ログインに失敗しました"); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (email.trim()) await recordPasswordResetRequest(email.trim());
    setShowForgotPassword(true);
  };

  return (
    <PortalLoginWrapper title="BBS社様専用ページ" subtitle="支援金管理ポータルにログイン">
      {showForgotPassword ? (
        <div className="text-center space-y-4">
          <p className="text-gray-600">お手数ですが、サポートスタッフへご連絡ください。</p>
          <Button variant="outline" onClick={() => setShowForgotPassword(false)}>ログインに戻る</Button>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-gradient-to-r from-[#3b9d9d] to-[#6fb789] hover:opacity-90 text-white" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={handleForgotPassword} className="text-[#3b9d9d] hover:underline">パスワードを忘れた方</button>
            <Link href="/hojo/bbs/register" className="text-[#3b9d9d] hover:underline">アカウント登録</Link>
          </div>
        </form>
      )}
    </PortalLoginWrapper>
  );
}

function BbsDataTable({ data, canEdit, bbsStatusOptions = [] }: { data: BbsRecord[]; canEdit: boolean; bbsStatusOptions: StatusOption[] }) {
  const [editRecord, setEditRecord] = useState<BbsRecord | null>(null);
  const [editData, setEditData] = useState({
    bbsStatusId: "" as string,
    bbsMemo: "",
    applicationFormDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [viewRecord, setViewRecord] = useState<BbsRecord | null>(null);
  const router = useRouter();

  const getStatusLabel = (statusId: number | null) => {
    if (!statusId) return "-";
    const opt = bbsStatusOptions.find((o) => o.value === String(statusId));
    return opt?.label || "-";
  };

  const openEdit = (r: BbsRecord) => {
    setEditRecord(r);
    setEditData({
      bbsStatusId: r.bbsStatusId ? String(r.bbsStatusId) : "",
      bbsMemo: r.bbsMemo,
      applicationFormDate: r.applicationFormDate,
    });
  };

  const saveModal = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      const result = await updateBbsFields(editRecord.id, {
        bbsStatusId: editData.bbsStatusId ? Number(editData.bbsStatusId) : null,
        bbsMemo: editData.bbsMemo,
        applicationFormDate: editData.applicationFormDate || null,
      });
      if (!result.ok) { alert(result.error); return; }
      setEditRecord(null);
      router.refresh();
    } finally { setSaving(false); }
  };

  // 変更前後の値が同じなら DB 書き込みをスキップするための比較。__empty は null 相当。
  const isSameValue = (record: BbsRecord, field: keyof BbsEditableFields, raw: string): boolean => {
    if (field === "bbsStatusId") {
      const incoming = raw === "__empty" ? null : Number(raw);
      return (record.bbsStatusId ?? null) === incoming;
    }
    if (field === "bbsMemo") return (record.bbsMemo ?? "") === raw;
    if (field === "applicationFormDate") return (record.applicationFormDate ?? "") === raw;
    return false;
  };

  const buildPayload = (field: keyof BbsEditableFields, raw: string): BbsEditableFields => {
    if (field === "bbsStatusId") return { bbsStatusId: raw === "__empty" ? null : Number(raw) };
    if (field === "bbsMemo") return { bbsMemo: raw };
    return { applicationFormDate: raw || null };
  };

  const inlineSave = async (id: number, field: keyof BbsEditableFields, value: string) => {
    const current = data.find((r) => r.id === id);
    if (current && isSameValue(current, field, value)) return;
    const result = await updateBbsFields(id, buildPayload(field, value));
    if (!result.ok) { alert(result.error); return; }
    router.refresh();
  };

  const formatCurrency = (amount: number | null) => amount == null ? "-" : `\u00a5${amount.toLocaleString()}`;

  const statusOptions = [
    { value: "__empty", label: "未設定" },
    ...bbsStatusOptions.map((opt) => ({ value: opt.value, label: opt.label })),
  ];

  return (
    <>
      <PortalCard>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No.</TableHead>
                <TableHead>申請者名</TableHead>
                <TableHead>情報回収フォーム回答共有日</TableHead>
                <TableHead>支援制度申請フォーム回答日</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>支援枠</TableHead>
                <TableHead>BBSへの振込日</TableHead>
                <TableHead>お客様着金希望日</TableHead>
                <TableHead>運営備考</TableHead>
                <TableHead>BBS備考</TableHead>
                {canEdit && <TableHead className="w-[60px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 11 : 10} className="text-center text-gray-500 py-8">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                data.map((record, index) => (
                  <TableRow key={record.id} className="group/row">
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.applicantName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {record.submission ? (
                        <button
                          onClick={() => setViewRecord(record)}
                          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                        >
                          {record.formTranscriptDate}
                        </button>
                      ) : (
                        record.formTranscriptDate
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {canEdit ? (
                        <InlineCell value={record.applicationFormDate} onSave={(v) => inlineSave(record.id, "applicationFormDate", v)} type="date">
                          <span className="whitespace-nowrap">{record.applicationFormDate || "-"}</span>
                        </InlineCell>
                      ) : (
                        <span className="whitespace-nowrap">{record.applicationFormDate || "-"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <InlineCell value={record.bbsStatusId ? String(record.bbsStatusId) : "__empty"} onSave={(v) => inlineSave(record.id, "bbsStatusId", v)} type="select" options={statusOptions}>
                          <span className="whitespace-nowrap">{getStatusLabel(record.bbsStatusId)}</span>
                        </InlineCell>
                      ) : (
                        <span className="whitespace-nowrap">{getStatusLabel(record.bbsStatusId)}</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatCurrency(record.bbsTransferAmount)}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.bbsTransferDate}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.subsidyReceivedDate}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{record.alkesMemo || "-"}</TableCell>
                    <TableCell className="max-w-[200px]">
                      {canEdit ? (
                        <InlineCell value={record.bbsMemo} onSave={(v) => inlineSave(record.id, "bbsMemo", v)} type="textarea">
                          <span className="truncate block">{record.bbsMemo || "-"}</span>
                        </InlineCell>
                      ) : (
                        <span className="truncate block">{record.bbsMemo || "-"}</span>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(record)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PortalCard>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>支援制度申請フォーム回答日</Label>
              <DatePicker
                value={editData.applicationFormDate}
                onChange={(v) => setEditData((prev) => ({ ...prev, applicationFormDate: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label>ステータス</Label>
              <Select value={editData.bbsStatusId || "__empty"} onValueChange={(v) => setEditData((prev) => ({ ...prev, bbsStatusId: v === "__empty" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>BBS備考</Label>
              <Textarea value={editData.bbsMemo} onChange={(e) => setEditData((prev) => ({ ...prev, bbsMemo: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button>
            <Button onClick={saveModal} disabled={saving} className="bg-gradient-to-r from-[#3b9d9d] to-[#6fb789] hover:opacity-90 text-white">{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewRecord?.submission && (
        <FormAnswerViewerModal
          answers={viewRecord.submission.answers}
          modifiedAnswers={viewRecord.submission.modifiedAnswers}
          fileUrls={viewRecord.submission.fileUrls}
          open
          onClose={() => setViewRecord(null)}
          title="支援制度申請フォーム 回答内容（閲覧専用）"
          description={`申請者: ${viewRecord.applicantName} / 共有日: ${viewRecord.formTranscriptDate}`}
          hideOriginalToggle
        />
      )}
    </>
  );
}

export function BbsClientPage({ authenticated, isBbs, canEdit = false, data, userName, bbsStatusOptions = [] }: Props) {
  if (!authenticated) return <LoginForm />;

  return (
    <BbsPortalLayout userName={userName} isBbs={isBbs} pageTitle="支援金管理ページ">
      <BbsDataTable data={data} canEdit={canEdit} bbsStatusOptions={bbsStatusOptions} />
    </BbsPortalLayout>
  );
}
