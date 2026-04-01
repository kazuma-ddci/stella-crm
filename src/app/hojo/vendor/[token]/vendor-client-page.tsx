"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineCell } from "@/components/inline-cell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { recordVendorPasswordResetRequest, updateVendorFields, addWholesaleAccount, updateWholesaleAccountByVendor, deleteWholesaleAccountByVendor } from "./actions";
import { Trash2, Plus, Pencil } from "lucide-react";
import Link from "next/link";

type ApplicantRecord = {
  id: number; lineName: string; applicantName: string; statusName: string;
  formAnswerDate: string; subsidyDesiredDate: string; subsidyAmount: number | null;
  paymentReceivedAmount: number | null; paymentReceivedDate: string;
  subsidyReceivedDate: string; vendorMemo: string;
};

type WholesaleRecord = {
  id: number; supportProviderName: string; companyName: string; email: string;
  softwareSalesContractUrl: string;
  recruitmentRound: number | null; adoptionDate: string; issueRequestDate: string;
  accountApprovalDate: string; grantDate: string; toolCost: number | null; invoiceStatus: string;
};

type Props = {
  authenticated: boolean; isVendor: boolean;
  applicantData: ApplicantRecord[]; wholesaleData: WholesaleRecord[];
  vendorName: string; vendorToken: string; vendorId?: number;
  allVendors: { id: number; name: string; token: string }[];
  userName?: string;
};

// ========== ログインフォーム ==========
function LoginForm({ vendorName, vendorToken }: { vendorName: string; vendorToken: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
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
    if (email.trim()) await recordVendorPasswordResetRequest(email.trim());
    setShowForgotPassword(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle className="text-center text-2xl">{vendorName}様 専用ページ</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {showForgotPassword ? (
            <div className="text-center space-y-4">
              <p className="text-gray-600">お手数ですが、担当スタッフへご連絡ください。</p>
              <Button variant="outline" onClick={() => setShowForgotPassword(false)}>ログインに戻る</Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="email">メールアドレス</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div className="space-y-2"><Label htmlFor="password">パスワード</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "ログイン中..." : "ログイン"}</Button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={handleForgotPassword} className="text-blue-600 hover:underline">パスワードを忘れた方</button>
                <Link href={`/hojo/vendor/${vendorToken}/register`} className="text-blue-600 hover:underline">アカウント登録</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ========== 助成金申請者管理タブ ==========
function ApplicantTab({ data, isVendor, vendorId }: { data: ApplicantRecord[]; isVendor: boolean; vendorId?: number }) {
  const [editRecord, setEditRecord] = useState<ApplicantRecord | null>(null);
  const [editData, setEditData] = useState({ subsidyDesiredDate: "", subsidyAmount: "", vendorMemo: "" });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const openEdit = (r: ApplicantRecord) => {
    setEditRecord(r);
    setEditData({ subsidyDesiredDate: r.subsidyDesiredDate, subsidyAmount: r.subsidyAmount != null ? String(r.subsidyAmount) : "", vendorMemo: r.vendorMemo });
  };

  const saveModal = async () => {
    if (!editRecord || !vendorId) return;
    setSaving(true);
    try {
      await updateVendorFields(editRecord.id, vendorId, { subsidyDesiredDate: editData.subsidyDesiredDate || null, subsidyAmount: editData.subsidyAmount ? Number(editData.subsidyAmount) : null, vendorMemo: editData.vendorMemo || null });
      setEditRecord(null); router.refresh();
    } catch { alert("保存に失敗しました"); } finally { setSaving(false); }
  };

  const inlineSave = async (id: number, field: string, value: string) => {
    if (!vendorId) return;
    const payload: Record<string, unknown> = {};
    if (field === "subsidyDesiredDate") payload.subsidyDesiredDate = value || null;
    if (field === "subsidyAmount") payload.subsidyAmount = value ? Number(value) : null;
    if (field === "vendorMemo") payload.vendorMemo = value || null;
    try { await updateVendorFields(id, vendorId, payload); router.refresh(); } catch { alert("保存に失敗しました"); }
  };

  const fmt = (n: number | null) => n == null ? "-" : `¥${n.toLocaleString()}`;

  return (
    <>
      <div className="overflow-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>LINE名</TableHead><TableHead>申請者名</TableHead><TableHead>ステータス</TableHead><TableHead>フォーム回答日</TableHead>
            <TableHead>助成金着金希望日</TableHead><TableHead>助成金額</TableHead><TableHead>原資金額</TableHead><TableHead>原資着金日</TableHead>
            <TableHead>助成金着金日</TableHead><TableHead>備考</TableHead>
            {isVendor && <TableHead className="w-[60px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={isVendor ? 11 : 10} className="text-center text-gray-500 py-8">データがありません</TableCell></TableRow>
            : data.map((r) => (
              <TableRow key={r.id} className="group/row">
                <TableCell className="whitespace-nowrap">{r.lineName}</TableCell><TableCell className="whitespace-nowrap">{r.applicantName}</TableCell><TableCell className="whitespace-nowrap">{r.statusName}</TableCell><TableCell className="whitespace-nowrap">{r.formAnswerDate}</TableCell>
                <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.subsidyDesiredDate} onSave={(v) => inlineSave(r.id, "subsidyDesiredDate", v)} type="date">{r.subsidyDesiredDate || "-"}</InlineCell> : r.subsidyDesiredDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.subsidyAmount != null ? String(r.subsidyAmount) : ""} onSave={(v) => inlineSave(r.id, "subsidyAmount", v)} type="number">{fmt(r.subsidyAmount)}</InlineCell> : fmt(r.subsidyAmount)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmt(r.paymentReceivedAmount)}</TableCell><TableCell className="whitespace-nowrap">{r.paymentReceivedDate}</TableCell><TableCell className="whitespace-nowrap">{r.subsidyReceivedDate}</TableCell>
                <TableCell className="max-w-[200px]">{isVendor ? <InlineCell value={r.vendorMemo} onSave={(v) => inlineSave(r.id, "vendorMemo", v)} type="textarea">{r.vendorMemo || "-"}</InlineCell> : r.vendorMemo || "-"}</TableCell>
                {isVendor && <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]"><Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button></TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>申請者情報の編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>助成金着金希望日</Label><DatePicker value={editData.subsidyDesiredDate} onChange={(v) => setEditData({ ...editData, subsidyDesiredDate: v })} /></div>
            <div className="space-y-1"><Label>助成金額</Label><Input type="number" value={editData.subsidyAmount} onChange={(e) => setEditData({ ...editData, subsidyAmount: e.target.value })} /></div>
            <div className="space-y-1"><Label>備考</Label><Textarea value={editData.vendorMemo} onChange={(e) => setEditData({ ...editData, vendorMemo: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button><Button onClick={saveModal} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== 卸アカウント管理タブ ==========
function WholesaleTab({ data, isVendor, vendorId }: { data: WholesaleRecord[]; isVendor: boolean; vendorId?: number }) {
  const [editRecord, setEditRecord] = useState<WholesaleRecord | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newData, setNewData] = useState<Record<string, string>>({});
  const router = useRouter();

  const openEdit = (r: WholesaleRecord) => {
    setEditRecord(r);
    setEditData({
      supportProviderName: r.supportProviderName, companyName: r.companyName, email: r.email,
      softwareSalesContractUrl: r.softwareSalesContractUrl,
      recruitmentRound: r.recruitmentRound != null ? String(r.recruitmentRound) : "",
      adoptionDate: r.adoptionDate, issueRequestDate: r.issueRequestDate, grantDate: r.grantDate,
    });
  };

  const saveModal = async () => {
    if (!editRecord || !vendorId) return;
    setSaving(true);
    try {
      await updateWholesaleAccountByVendor(editRecord.id, vendorId, { ...editData, recruitmentRound: editData.recruitmentRound ? Number(editData.recruitmentRound) : null });
      setEditRecord(null); router.refresh();
    } catch { alert("保存に失敗しました"); } finally { setSaving(false); }
  };

  const inlineSave = async (id: number, field: string, value: string) => {
    if (!vendorId) return;
    const payload: Record<string, unknown> = { [field]: field === "recruitmentRound" ? (value ? Number(value) : null) : (value || null) };
    try { await updateWholesaleAccountByVendor(id, vendorId, payload); router.refresh(); } catch { alert("保存に失敗しました"); }
  };

  const handleAdd = async () => {
    if (!vendorId) return;
    setSaving(true);
    try {
      await addWholesaleAccount(vendorId, { ...newData, recruitmentRound: newData.recruitmentRound ? Number(newData.recruitmentRound) : null });
      setAdding(false); setNewData({}); router.refresh();
    } catch { alert("追加に失敗しました"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!vendorId || !confirm("削除しますか？")) return;
    try { await deleteWholesaleAccountByVendor(id, vendorId); router.refresh(); } catch { alert("削除に失敗しました"); }
  };

  const fmtCost = (n: number | null) => n == null ? "-" : `${n}万円`;

  const editableFields = [
    { key: "supportProviderName", label: "支援事業者名", type: "text" as const },
    { key: "companyName", label: "会社名(補助事業社、納品先）", type: "text" as const },
    { key: "email", label: "メールアドレス(アカウント)", type: "text" as const },
    { key: "softwareSalesContractUrl", label: "ソフトウェア販売契約書", type: "url" as const, placeholder: "https://..." },
    { key: "recruitmentRound", label: "募集回", type: "number" as const },
    { key: "adoptionDate", label: "採択日", type: "date" as const },
    { key: "issueRequestDate", label: "発行依頼日", type: "date" as const },
    { key: "grantDate", label: "交付日", type: "date" as const },
  ];

  return (
    <>
      <div className="space-y-4">
        {isVendor && (
          <div className="flex justify-end">
            <Button onClick={() => { setAdding(true); setNewData({}); }} className="gap-2"><Plus className="h-4 w-4" />新規追加</Button>
          </div>
        )}
        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12">No.</TableHead>
              <TableHead>支援事業者名</TableHead><TableHead>会社名(補助事業社、納品先）</TableHead><TableHead>メールアドレス(アカウント)</TableHead>
              <TableHead>ソフトウェア販売契約書</TableHead><TableHead>募集回</TableHead><TableHead>採択日</TableHead><TableHead>発行依頼日</TableHead><TableHead>アカウント承認日</TableHead>
              <TableHead>交付日</TableHead><TableHead>ツール代(税別)万円</TableHead><TableHead>請求入金状況</TableHead>
              {isVendor && <TableHead className="w-[80px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={isVendor ? 13 : 12} className="text-center text-gray-500 py-8">データがありません</TableCell></TableRow>
              : data.map((r, idx) => (
                <TableRow key={r.id} className="group/row">
                  <TableCell className="text-gray-500">{idx + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.supportProviderName} onSave={(v) => inlineSave(r.id, "supportProviderName", v)}>{r.supportProviderName || "-"}</InlineCell> : r.supportProviderName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.companyName} onSave={(v) => inlineSave(r.id, "companyName", v)}>{r.companyName || "-"}</InlineCell> : r.companyName || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.email} onSave={(v) => inlineSave(r.id, "email", v)}>{r.email || "-"}</InlineCell> : r.email || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.softwareSalesContractUrl} onSave={(v) => inlineSave(r.id, "softwareSalesContractUrl", v)}>{r.softwareSalesContractUrl ? <a href={r.softwareSalesContractUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">リンク</a> : "-"}</InlineCell> : r.softwareSalesContractUrl ? <a href={r.softwareSalesContractUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">リンク</a> : "-"}</TableCell>
                  <TableCell>{isVendor ? <InlineCell value={r.recruitmentRound != null ? String(r.recruitmentRound) : ""} onSave={(v) => inlineSave(r.id, "recruitmentRound", v)} type="number">{r.recruitmentRound ?? "-"}</InlineCell> : r.recruitmentRound ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.adoptionDate} onSave={(v) => inlineSave(r.id, "adoptionDate", v)} type="date">{r.adoptionDate || "-"}</InlineCell> : r.adoptionDate || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.issueRequestDate} onSave={(v) => inlineSave(r.id, "issueRequestDate", v)} type="date">{r.issueRequestDate || "-"}</InlineCell> : r.issueRequestDate || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.accountApprovalDate}</TableCell>
                  <TableCell className="whitespace-nowrap">{isVendor ? <InlineCell value={r.grantDate} onSave={(v) => inlineSave(r.id, "grantDate", v)} type="date">{r.grantDate || "-"}</InlineCell> : r.grantDate || "-"}</TableCell>
                  <TableCell>{fmtCost(r.toolCost)}</TableCell><TableCell className="whitespace-nowrap">{r.invoiceStatus}</TableCell>
                  {isVendor && (
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 新規追加モーダル */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>卸アカウント新規追加</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editableFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === "date" ? <DatePicker value={newData[f.key] || ""} onChange={(v) => setNewData({ ...newData, [f.key]: v })} />
                : <Input type={f.type} value={newData[f.key] || ""} onChange={(e) => setNewData({ ...newData, [f.key]: e.target.value })} min={f.type === "number" ? "1" : undefined} placeholder={"placeholder" in f ? f.placeholder : undefined} />}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdding(false)}>キャンセル</Button><Button onClick={handleAdd} disabled={saving}>{saving ? "追加中..." : "追加"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集モーダル */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>卸アカウント編集</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editableFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === "date" ? <DatePicker value={editData[f.key] || ""} onChange={(v) => setEditData({ ...editData, [f.key]: v })} />
                : <Input type={f.type} value={editData[f.key] || ""} onChange={(e) => setEditData({ ...editData, [f.key]: e.target.value })} min={f.type === "number" ? "1" : undefined} />}
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditRecord(null)}>キャンセル</Button><Button onClick={saveModal} disabled={saving}>{saving ? "保存中..." : "保存"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ========== メインコンポーネント ==========
function VendorDataPage({ applicantData, wholesaleData, isVendor, vendorId, vendorName, allVendors, vendorToken, userName }: Omit<Props, "authenticated">) {
  const router = useRouter();
  const hasApplicantData = applicantData.length > 0;
  const handleVendorChange = (token: string) => { router.push(`/hojo/vendor/${token}`); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{vendorName}様 専用ページ</h1>
        <div className="flex items-center gap-3">
          {isVendor && userName && (
            <>
              <span className="text-sm text-gray-600">{userName}さん</span>
              <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: `/hojo/vendor/${vendorToken}` })}>
                ログアウト
              </Button>
            </>
          )}
        {allVendors.length > 0 && (
          <Select value={vendorToken} onValueChange={handleVendorChange}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{allVendors.map((v) => <SelectItem key={v.token} value={v.token}>{v.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
        </div>
      </div>
      {hasApplicantData ? (
        <Tabs defaultValue="wholesale">
          <TabsList>
            <TabsTrigger value="wholesale">卸アカウント管理</TabsTrigger>
            <TabsTrigger value="applicant">助成金申請者管理</TabsTrigger>
          </TabsList>
          <TabsContent value="wholesale" className="mt-4"><WholesaleTab data={wholesaleData} isVendor={isVendor} vendorId={vendorId} /></TabsContent>
          <TabsContent value="applicant" className="mt-4"><ApplicantTab data={applicantData} isVendor={isVendor} vendorId={vendorId} /></TabsContent>
        </Tabs>
      ) : (
        <WholesaleTab data={wholesaleData} isVendor={isVendor} vendorId={vendorId} />
      )}
    </div>
  );
}

export function VendorClientPage({ authenticated, isVendor, applicantData, wholesaleData, vendorName, vendorToken, vendorId, allVendors, userName }: Props) {
  if (!authenticated) return <LoginForm vendorName={vendorName} vendorToken={vendorToken} />;
  return (
    <div className={isVendor ? "min-h-screen bg-gray-50 p-6" : ""}>
      <VendorDataPage applicantData={applicantData} wholesaleData={wholesaleData} isVendor={isVendor} vendorId={vendorId} vendorName={vendorName} allVendors={allVendors} vendorToken={vendorToken} userName={userName} />
    </div>
  );
}
