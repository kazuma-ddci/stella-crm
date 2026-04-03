"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { InlineCell } from "@/components/inline-cell";
import { Pencil } from "lucide-react";
import { recordPasswordResetRequest, updateBbsFields } from "./actions";
import Link from "next/link";

type BbsRecord = {
  id: number;
  applicantName: string;
  formAnswerDate: string;
  bbsStatusId: number | null;
  bbsTransferAmount: number | null;
  bbsTransferDate: string;
  subsidyReceivedDate: string;
  alkesMemo: string;
  bbsMemo: string;
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
      const result = await signIn("credentials", {
        identifier: email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.code === "pending_approval") {
          setError("アカウントは認証待ち中です。しばらくお待ちください。");
        } else if (result.code === "suspended") {
          setError("アカウントが停止されています。");
        } else {
          setError("メールアドレスまたはパスワードが正しくありません");
        }
      } else {
        router.refresh();
      }
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (email.trim()) {
      await recordPasswordResetRequest(email.trim());
    }
    setShowForgotPassword(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">BBS社様専用_支援金管理ページ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForgotPassword ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600">
                お手数ですが、ALKESスタッフへご連絡ください。
              </p>
              <Button variant="outline" onClick={() => setShowForgotPassword(false)}>
                ログインに戻る
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "ログイン中..." : "ログイン"}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-blue-600 hover:underline"
                >
                  パスワードを忘れた方
                </button>
                <Link href="/hojo/bbs/register" className="text-blue-600 hover:underline">
                  アカウント登録
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BbsDataTable({ data, canEdit, bbsStatusOptions = [] }: { data: BbsRecord[]; canEdit: boolean; bbsStatusOptions: StatusOption[] }) {
  const [editRecord, setEditRecord] = useState<BbsRecord | null>(null);
  const [editData, setEditData] = useState({ bbsStatusId: "" as string, bbsMemo: "" });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const getStatusLabel = (statusId: number | null) => {
    if (!statusId) return "-";
    const opt = bbsStatusOptions.find((o) => o.value === String(statusId));
    return opt?.label || "-";
  };

  const openEdit = (r: BbsRecord) => {
    setEditRecord(r);
    setEditData({ bbsStatusId: r.bbsStatusId ? String(r.bbsStatusId) : "", bbsMemo: r.bbsMemo });
  };

  const saveModal = async () => {
    if (!editRecord) return;
    setSaving(true);
    try {
      await updateBbsFields(editRecord.id, {
        bbsStatusId: editData.bbsStatusId ? Number(editData.bbsStatusId) : null,
        bbsMemo: editData.bbsMemo,
      });
      setEditRecord(null);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const inlineSave = async (id: number, field: string, value: string) => {
    if (field === "bbsStatusId") {
      const bbsStatusId = value === "__empty" ? null : Number(value);
      try {
        await updateBbsFields(id, { bbsStatusId });
        router.refresh();
      } catch {
        alert("保存に失敗しました");
      }
    } else if (field === "bbsMemo") {
      try {
        await updateBbsFields(id, { bbsMemo: value });
        router.refresh();
      } catch {
        alert("保存に失敗しました");
      }
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount == null) return "-";
    return `¥${amount.toLocaleString()}`;
  };

  const statusOptions = [
    { value: "__empty", label: "未設定" },
    ...bbsStatusOptions.map((opt) => ({ value: opt.value, label: opt.label })),
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">BBS社様専用_支援金管理ページ</h1>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No.</TableHead>
                <TableHead>申請者名</TableHead>
                <TableHead>支援制度申請フォーム入力日</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>支援枠</TableHead>
                <TableHead>BBSへの振込日</TableHead>
                <TableHead>お客様着金希望日</TableHead>
                <TableHead>ALKES備考</TableHead>
                <TableHead>BBS備考</TableHead>
                {canEdit && <TableHead className="w-[60px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center text-gray-500 py-8">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                data.map((record, index) => (
                  <TableRow key={record.id} className="group/row">
                    <TableCell className="text-gray-500">{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.applicantName}</TableCell>
                    <TableCell className="whitespace-nowrap">{record.formAnswerDate}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <InlineCell
                          value={record.bbsStatusId ? String(record.bbsStatusId) : "__empty"}
                          onSave={(v) => inlineSave(record.id, "bbsStatusId", v)}
                          type="select"
                          options={statusOptions}
                        >
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
                        <InlineCell
                          value={record.bbsMemo}
                          onSave={(v) => inlineSave(record.id, "bbsMemo", v)}
                          type="textarea"
                        >
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
      </div>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>ステータス</Label>
              <Select value={editData.bbsStatusId || "__empty"} onValueChange={(v) => setEditData({ ...editData, bbsStatusId: v === "__empty" ? "" : v })}>
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
              <Textarea value={editData.bbsMemo} onChange={(e) => setEditData({ ...editData, bbsMemo: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button>
            <Button onClick={saveModal} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BbsClientPage({ authenticated, isBbs, canEdit = false, data, userName, bbsStatusOptions = [] }: Props) {
  if (!authenticated) {
    return <LoginForm />;
  }

  return (
    <div className={isBbs ? "min-h-screen bg-gray-50 p-6" : ""}>
      {isBbs && userName && (
        <div className="flex items-center justify-end gap-3 mb-4">
          <span className="text-sm text-gray-600">{userName}さん</span>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/hojo/bbs" })}>
            ログアウト
          </Button>
        </div>
      )}
      <BbsDataTable data={data} canEdit={canEdit} bbsStatusOptions={bbsStatusOptions} />
    </div>
  );
}
