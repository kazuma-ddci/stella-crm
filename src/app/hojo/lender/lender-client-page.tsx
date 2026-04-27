"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, History, Pencil, Copy, Check, Link as LinkIcon, Download } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { InlineCell } from "@/components/inline-cell";
import { CrudTable, type ColumnDef, type CustomAction, type CustomRenderers } from "@/components/crud-table";
import Link from "next/link";
import { recordLenderPasswordResetRequest, updateLoanLenderMemo, updateLenderProgress, updateHojoLoanProgressRates } from "./actions";
import {
  INDIVIDUAL_LOAN_SECTIONS,
  CORPORATE_LOAN_SECTIONS,
  getCorporateBOSections,
} from "@/lib/hojo/loan-form-fields";
import { buildLoanSubmissionsCsv, downloadCsv } from "@/lib/hojo/loan-submission-csv";
import { CsvExportDialog } from "@/components/csv-export-dialog";
import {
  PortalHeader,
  PortalUserMenu,
  PortalLayout,
  PortalSidebar,
  PortalLoginWrapper,
} from "@/components/hojo-portal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChangeEntry = {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
};

type ChangeHistoryRecord = {
  changedAt: string;
  changedBy: string;
  changes: ChangeEntry[];
};

type LoanSubmissionRow = {
  id: number;
  formType: string;
  companyName: string;
  representName: string;
  email: string;
  phone: string;
  vendorName: string;
  submittedAt: string;
  answers: Record<string, string>;
  modifiedAnswers: Record<string, string> | null;
  changeHistory: ChangeHistoryRecord[] | null;
  lenderMemo: string;
};

type LenderSection = "loan-submissions" | "customer-progress";

type LenderProgressRow = {
  id: number;
  vendorName: string;
  vendorNo: number;
  requestDate: string;
  companyName: string;
  representName: string;
  statusId: string;
  statusName: string;
  applicantType: string;
  updatedAt: string;
  memo: string;
  memorandum: string;
  funds: string;
  redemptionScheduleIssuedAt: string;
  toolPurchasePrice: string;
  loanAmount: string;
  fundTransferDate: string;
  loanExecutionDate: string;
  loanExecutionTime: string;
  repaymentDate: string;
  repaymentAmount: string;
  principalAmount: string;
  interestAmount: string;
  overshortAmount: string;
  operationFee: string;
  redemptionAmount: string;
  redemptionDate: string;
  endMemo: string;
};

type ProgressRates = {
  interestRate: number;
  feeRate: number;
};

type Props = {
  authenticated: boolean;
  isLender: boolean;
  corporateData: LoanSubmissionRow[];
  individualData: LoanSubmissionRow[];
  vendors: { id: number; name: string }[];
  progressData: LenderProgressRow[];
  statusOptions: { value: string; label: string }[];
  rates: ProgressRates;
  userName?: string;
};

// ---------------------------------------------------------------------------
// セクション定義（共有: src/lib/hojo/loan-form-fields.ts）
// ---------------------------------------------------------------------------

function getAllSections(submission: LoanSubmissionRow) {
  const isCorporate = submission.formType === "loan-corporate";
  const currentAnswers = submission.modifiedAnswers ?? submission.answers;
  const baseSections = isCorporate ? CORPORATE_LOAN_SECTIONS : INDIVIDUAL_LOAN_SECTIONS;
  const boSections = isCorporate ? getCorporateBOSections(currentAnswers) : [];
  return [...baseSections, ...boSections];
}

// ---------------------------------------------------------------------------
// 共有URLカード（貸金業社ポータル共有用）
// ---------------------------------------------------------------------------

function ShareableUrlCard() {
  const [copied, setCopied] = useState(false);
  const [portalUrl, setPortalUrl] = useState("/hojo/lender");

  useEffect(() => {
    setPortalUrl(`${window.location.origin}/hojo/lender`);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = portalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          貸金業社様 専用ページ 共有URL
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          このURLを貸金業社のご担当者様にお送りください。ログイン後、こちらのポータルにアクセスできます。
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-gray-100 rounded px-3 py-2 break-all">{portalUrl}</code>
          <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
            {copied ? (
              <><Check className="h-4 w-4 mr-1 text-green-500" />コピー済</>
            ) : (
              <><Copy className="h-4 w-4 mr-1" />コピー</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// メニュー定義
// ---------------------------------------------------------------------------

const menuSections = [
  {
    label: "メニュー",
    items: [
      { key: "loan-submissions", label: "借入申込フォーム回答" },
      { key: "customer-progress", label: "顧客進捗管理" },
    ],
  },
];

function getSectionTitle(section: LenderSection): string {
  const map: Record<LenderSection, string> = {
    "loan-submissions": "借入申込フォーム回答",
    "customer-progress": "顧客進捗管理",
  };
  return map[section];
}

// ---------------------------------------------------------------------------
// ログインフォーム
// ---------------------------------------------------------------------------

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
    if (email.trim()) await recordLenderPasswordResetRequest(email.trim());
    setShowForgotPassword(true);
  };

  return (
    <PortalLoginWrapper title="貸金業社様専用ページ" subtitle="ポータルにログイン">
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
          <Button type="submit" className="w-full bg-gradient-to-r from-[#10b981] to-[#86efac] hover:opacity-90 text-white" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={handleForgotPassword} className="text-[#10b981] hover:underline">パスワードを忘れた方</button>
            <Link href="/hojo/lender/register" className="text-[#10b981] hover:underline">アカウント登録</Link>
          </div>
        </form>
      )}
    </PortalLoginWrapper>
  );
}

// ---------------------------------------------------------------------------
// 詳細モーダル（表示専用）
// ---------------------------------------------------------------------------

function DetailModal({
  submission,
  onClose,
}: {
  submission: LoanSubmissionRow;
  onClose: () => void;
}) {
  const isCorporate = submission.formType === "loan-corporate";
  const allSections = getAllSections(submission);
  const originalAnswers = submission.answers;
  const currentAnswers = submission.modifiedAnswers ?? submission.answers;
  const hasModifications = !!submission.modifiedAnswers;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            借入申込 回答詳細
            <Badge variant={isCorporate ? "default" : "secondary"}>
              {isCorporate ? "法人" : "個人事業主"}
            </Badge>
            {hasModifications && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                変更あり
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ベンダー情報 */}
        {originalAnswers._vendorName && (
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
            <span className="text-muted-foreground">ベンダー: </span>
            <span className="font-medium">{originalAnswers._vendorName}</span>
          </div>
        )}

        <Tabs defaultValue={hasModifications ? "modified" : "original"}>
          {hasModifications && (
            <TabsList className="mb-4">
              <TabsTrigger value="modified">最新データ</TabsTrigger>
              <TabsTrigger value="original">元の回答</TabsTrigger>
              <TabsTrigger value="history" className="gap-1">
                <History className="h-3 w-3" />変更履歴
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value={hasModifications ? "modified" : "original"}>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                回答日時: {new Date(submission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
              {allSections.map((section) => {
                const data = hasModifications ? currentAnswers : originalAnswers;
                const hasAnyValue = section.fields.some((f) => data[f.key]);
                if (!hasAnyValue) return null;
                return (
                  <div key={section.title} className="space-y-2">
                    <h4 className="font-medium text-sm border-b pb-1">{section.title}</h4>
                    <dl className="space-y-2">
                      {section.fields.map((field) => {
                        const value = data[field.key];
                        if (!value) return null;
                        const origVal = originalAnswers[field.key];
                        const isChanged = hasModifications && origVal !== value;
                        return (
                          <div key={field.key} className="grid grid-cols-3 gap-2">
                            <dt className="text-xs text-muted-foreground col-span-1">{field.label}</dt>
                            <dd className="text-sm col-span-2">
                              {value}
                              {isChanged && (
                                <span className="ml-2 text-xs text-orange-500">(変更済)</span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {hasModifications && (
            <>
              <TabsContent value="original">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    フォーム送信時の元データ（{new Date(submission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）
                  </p>
                  {allSections.map((section) => {
                    const hasAnyValue = section.fields.some((f) => originalAnswers[f.key]);
                    if (!hasAnyValue) return null;
                    return (
                      <div key={section.title} className="space-y-2">
                        <h4 className="font-medium text-sm border-b pb-1">{section.title}</h4>
                        <dl className="space-y-2">
                          {section.fields.map((field) => {
                            const value = originalAnswers[field.key];
                            if (!value) return null;
                            return (
                              <div key={field.key} className="grid grid-cols-3 gap-2">
                                <dt className="text-xs text-muted-foreground col-span-1">{field.label}</dt>
                                <dd className="text-sm col-span-2">{value}</dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="history">
                <div className="space-y-4">
                  {!submission.changeHistory || submission.changeHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">変更履歴はありません</p>
                  ) : (
                    [...submission.changeHistory].reverse().map((record, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-gray-700">{record.changedBy}</span>
                          <span>
                            {new Date(record.changedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {record.changes.map((c, ci) => (
                            <div key={ci} className="text-sm bg-gray-50 rounded px-3 py-2">
                              <span className="font-medium">{c.fieldLabel}</span>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">
                                  {c.oldValue || "（空）"}
                                </span>
                                <span>→</span>
                                <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                  {c.newValue || "（空）"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// テーブル
// ---------------------------------------------------------------------------

function SubmissionTable({
  data,
  vendorFilter,
  isLender,
}: {
  data: LoanSubmissionRow[];
  vendorFilter: string;
  isLender: boolean;
}) {
  const [selected, setSelected] = useState<LoanSubmissionRow | null>(null);
  const router = useRouter();

  const handleMemoSave = async (id: number, value: string) => {
    const result = await updateLoanLenderMemo(id, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const filtered = vendorFilter
    ? data.filter((r) => r.vendorName === vendorFilter)
    : data;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        まだ回答がありません
      </div>
    );
  }

  return (
    <>
      <div className="overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No.</TableHead>
              <TableHead>ベンダー</TableHead>
              <TableHead>会社名/屋号</TableHead>
              <TableHead>代表者/氏名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>回答日時</TableHead>
              <TableHead className="w-12">状態</TableHead>
              <TableHead>備考</TableHead>
              <TableHead className="w-16">詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, idx) => (
              <TableRow key={row.id} className="group/row">
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {row.vendorName || "（不明）"}
                </TableCell>
                <TableCell className="font-medium">{row.companyName}</TableCell>
                <TableCell>{row.representName}</TableCell>
                <TableCell>{row.email}</TableCell>
                <TableCell>{row.phone}</TableCell>
                <TableCell>
                  {new Date(row.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                </TableCell>
                <TableCell>
                  {row.modifiedAnswers && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      編集済
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  {isLender ? (
                    <InlineCell value={row.lenderMemo} onSave={(v) => handleMemoSave(row.id, v)} type="textarea">
                      <span className="truncate block">{row.lenderMemo || "-"}</span>
                    </InlineCell>
                  ) : (
                    <span className="truncate block">{row.lenderMemo || "-"}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selected && (
        <DetailModal
          submission={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// 借入申込フォーム回答セクション
// ---------------------------------------------------------------------------

function LoanSubmissionsSection({
  corporateData,
  individualData,
  vendors,
  isLender,
}: {
  corporateData: LoanSubmissionRow[];
  individualData: LoanSubmissionRow[];
  vendors: { id: number; name: string }[];
  isLender: boolean;
}) {
  const [vendorFilter, setVendorFilter] = useState("");
  const [activeTab, setActiveTab] = useState<"corporate" | "individual">("corporate");
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const effectiveVendor = vendorFilter && vendorFilter !== "all" ? vendorFilter : "";
  const filteredCorporate = effectiveVendor
    ? corporateData.filter((r) => r.vendorName === effectiveVendor)
    : corporateData;
  const filteredIndividual = effectiveVendor
    ? individualData.filter((r) => r.vendorName === effectiveVendor)
    : individualData;

  const csvSourceData = activeTab === "corporate" ? filteredCorporate : filteredIndividual;
  const csvFormType: "loan-corporate" | "loan-individual" =
    activeTab === "corporate" ? "loan-corporate" : "loan-individual";

  return (
    <div className="space-y-4">
      <ShareableUrlCard />
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-muted-foreground">ベンダー:</span>
        <Select value={vendorFilter} onValueChange={setVendorFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="すべて" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.name}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCsvDialogOpen(true)}
            disabled={csvSourceData.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            CSV出力（{activeTab === "corporate" ? "法人" : "個人事業主"}）
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "corporate" | "individual")}>
        <TabsList>
          <TabsTrigger value="corporate">
            法人 ({filteredCorporate.length})
          </TabsTrigger>
          <TabsTrigger value="individual">
            個人事業主 ({filteredIndividual.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="corporate" className="mt-4">
          <SubmissionTable
            data={corporateData}
            vendorFilter={effectiveVendor}
            isLender={isLender}
          />
        </TabsContent>
        <TabsContent value="individual" className="mt-4">
          <SubmissionTable
            data={individualData}
            vendorFilter={effectiveVendor}
            isLender={isLender}
          />
        </TabsContent>
      </Tabs>

      <CsvExportDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        title={`借入申込フォーム回答 CSV出力（${activeTab === "corporate" ? "法人" : "個人事業主"}）`}
        items={csvSourceData.map((r) => ({
          id: r.id,
          primary: r.companyName || r.representName || `#${r.id}`,
          secondary: [r.representName, r.vendorName, new Date(r.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })]
            .filter(Boolean)
            .join(" / "),
        }))}
        onExport={(selected) => {
          const selectedIds = new Set(selected.map((s) => s.id));
          const rows = csvSourceData
            .filter((r) => selectedIds.has(r.id))
            .map((r) => ({
              id: r.id,
              formType: r.formType,
              submittedAt: r.submittedAt,
              vendorName: r.vendorName,
              companyName: r.companyName,
              representName: r.representName,
              email: r.email,
              phone: r.phone,
              lenderMemo: r.lenderMemo,
              answers: r.answers as Record<string, unknown>,
              modifiedAnswers: r.modifiedAnswers as Record<string, unknown> | null,
            }));
          const csv = buildLoanSubmissionsCsv(csvFormType, rows);
          const today = new Date().toISOString().slice(0, 10);
          downloadCsv(`loan-submissions_${csvFormType === "loan-corporate" ? "corporate" : "individual"}_${today}.csv`, csv);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 顧客進捗管理セクション（貸金業社用）
// ---------------------------------------------------------------------------

function CustomerProgressSection({
  data,
  statusOptions,
  isLender,
  rates,
}: {
  data: LenderProgressRow[];
  statusOptions: { value: string; label: string }[];
  isLender: boolean;
  rates: ProgressRates;
}) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<LenderProgressRow | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [rateDialog, setRateDialog] = useState<null | "interest" | "fee">(null);
  const [rateInput, setRateInput] = useState("");
  const [rateSaving, setRateSaving] = useState(false);

  const formatRatePercent = (rate: number) => {
    // 0.05 → "5%", 0.0525 → "5.25%"
    const pct = rate * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
  };

  const openRateDialog = (which: "interest" | "fee") => {
    const current = which === "interest" ? rates.interestRate : rates.feeRate;
    const pct = current * 100;
    setRateInput(Number.isFinite(pct) ? String(pct) : "0");
    setRateDialog(which);
  };

  const handleRateSave = async () => {
    if (!rateDialog) return;
    const num = Number(rateInput);
    if (!Number.isFinite(num) || num < 0) {
      alert("0以上の数値を入力してください");
      return;
    }
    setRateSaving(true);
    try {
      const interestPct = rateDialog === "interest" ? num : rates.interestRate * 100;
      const feePct = rateDialog === "fee" ? num : rates.feeRate * 100;
      const result = await updateHojoLoanProgressRates(interestPct, feePct);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setRateDialog(null);
      router.refresh();
    } finally {
      setRateSaving(false);
    }
  };

  const handleSave = async (id: number, field: string, value: string) => {
    const result = await updateLenderProgress(id, field, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const openProgressEdit = (item: Record<string, unknown>) => {
    const row = item as unknown as LenderProgressRow;
    setEditRow(row);
    setEditData({
      statusId: row.statusId,
      memo: row.memo,
      memorandum: row.memorandum,
      funds: row.funds,
      redemptionScheduleIssuedAt: row.redemptionScheduleIssuedAt,
      repaymentDate: row.repaymentDate,
      repaymentAmount: row.repaymentAmount.replace(/,/g, ""),
      principalAmount: row.principalAmount.replace(/,/g, ""),
      interestAmount: row.interestAmount.replace(/,/g, ""),
      overshortAmount: row.overshortAmount.replace(/,/g, ""),
      operationFee: row.operationFee.replace(/,/g, ""),
      redemptionAmount: row.redemptionAmount.replace(/,/g, ""),
      redemptionDate: row.redemptionDate,
      endMemo: row.endMemo,
    });
  };

  const handleEditSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const original: Record<string, string> = {
        statusId: editRow.statusId,
        memo: editRow.memo,
        memorandum: editRow.memorandum,
        funds: editRow.funds,
        redemptionScheduleIssuedAt: editRow.redemptionScheduleIssuedAt,
        repaymentDate: editRow.repaymentDate,
        repaymentAmount: editRow.repaymentAmount.replace(/,/g, ""),
        principalAmount: editRow.principalAmount.replace(/,/g, ""),
        interestAmount: editRow.interestAmount.replace(/,/g, ""),
        overshortAmount: editRow.overshortAmount.replace(/,/g, ""),
        operationFee: editRow.operationFee.replace(/,/g, ""),
        redemptionAmount: editRow.redemptionAmount.replace(/,/g, ""),
        redemptionDate: editRow.redemptionDate,
        endMemo: editRow.endMemo,
      };
      for (const [field, value] of Object.entries(editData)) {
        if (value !== original[field]) {
          await updateLenderProgress(editRow.id, field, value);
        }
      }
      router.refresh();
      setEditRow(null);
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const fmtDateTime = (d: string, t: string) => {
    if (!d) return "-";
    return t ? `${d} ${t}` : d;
  };

  // フィルタ用の選択肢（データから動的生成）
  const vendorNameOptions = Array.from(new Set(data.map((r) => r.vendorName).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));
  const statusNameOptions = Array.from(new Set(data.map((r) => r.statusName).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));
  const applicantTypeOptions = Array.from(new Set(data.map((r) => r.applicantType).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorName", header: "ベンダー", type: "select", options: vendorNameOptions, editable: false, filterable: true },
    { key: "vendorNo", header: "ベンダーNo.", type: "number", editable: false, filterable: true, cellClassName: "text-center" },
    { key: "requestDate", header: "依頼日", type: "date", editable: false, filterable: true },
    { key: "companyName", header: "社名（屋号名）", type: "text", editable: false, filterable: true },
    { key: "representName", header: "代表者(契約者)氏名", type: "text", editable: false, filterable: true },
    { key: "statusName", header: "ステータス", type: "select", options: statusNameOptions, editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "applicantType", header: "法人/個人", type: "select", options: applicantTypeOptions, editable: false, filterable: true },
    { key: "updatedAt", header: "最終更新日", type: "date", editable: false, filterable: true },
    { key: "memo", header: "備考", type: "textarea", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "memorandum", header: "覚書", type: "textarea", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "funds", header: "資金", type: "textarea", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "redemptionScheduleIssuedAt", header: "償還表発行日", type: "date", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "toolPurchasePrice", header: "ツール購入代金", editable: false, filterable: true },
    { key: "loanAmount", header: "貸付金額", editable: false, filterable: true },
    { key: "fundTransferDate", header: "資金移動日", type: "date", editable: false, filterable: true },
    { key: "loanExecutionDate", header: "貸付実行日", type: "date", editable: false, filterable: true },
    { key: "repaymentDate", header: "返金日(着金日)", type: "date", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "repaymentAmount", header: "返金額(着金額)", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "principalAmount", header: "元金分", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "interestAmount", header: "利息分", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "overshortAmount", header: "過不足", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "operationFee", header: "運用フィー", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "redemptionAmount", header: "償還額", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "redemptionDate", header: "償還日", type: "date", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
    { key: "endMemo", header: "返済備考", type: "textarea", editable: false, filterable: true, cellClassName: isLender ? "bg-blue-50/50" : undefined },
  ];

  const truncateCell = (value: unknown) => (
    <span className="truncate block max-w-[180px]">{value ? String(value) : "-"}</span>
  );

  const inlineTextarea = (id: number, field: keyof LenderProgressRow, value: string) => (
    <InlineCell value={value} onSave={(v) => handleSave(id, field as string, v)} type="textarea">
      <span className="truncate block max-w-[180px]">{value || "-"}</span>
    </InlineCell>
  );

  const inlineDate = (id: number, field: keyof LenderProgressRow, value: string) => (
    <InlineCell value={value} onSave={(v) => handleSave(id, field as string, v)} type="date">
      <span className="whitespace-nowrap">{value || "-"}</span>
    </InlineCell>
  );

  const inlineNumber = (id: number, field: keyof LenderProgressRow, displayValue: string) => (
    <InlineCell value={displayValue.replace(/,/g, "")} onSave={(v) => handleSave(id, field as string, v)} type="number">
      <span className="whitespace-nowrap">{displayValue || "-"}</span>
    </InlineCell>
  );

  const customRenderers: CustomRenderers = isLender
    ? {
        loanExecutionDate: (_, row) => (
          <span className="whitespace-nowrap">
            {fmtDateTime(row.loanExecutionDate as string, row.loanExecutionTime as string)}
          </span>
        ),
        statusName: (_, row) => (
          <Select
            value={(row.statusId as string) || "none"}
            onValueChange={(v) => handleSave(row.id as number, "statusId", v === "none" ? "" : v)}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未設定</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        memo: (_, row) => inlineTextarea(row.id as number, "memo", (row.memo as string) ?? ""),
        memorandum: (_, row) => inlineTextarea(row.id as number, "memorandum", (row.memorandum as string) ?? ""),
        funds: (_, row) => inlineTextarea(row.id as number, "funds", (row.funds as string) ?? ""),
        redemptionScheduleIssuedAt: (_, row) =>
          inlineDate(row.id as number, "redemptionScheduleIssuedAt", (row.redemptionScheduleIssuedAt as string) ?? ""),
        repaymentDate: (_, row) => inlineDate(row.id as number, "repaymentDate", (row.repaymentDate as string) ?? ""),
        repaymentAmount: (_, row) => inlineNumber(row.id as number, "repaymentAmount", (row.repaymentAmount as string) ?? ""),
        principalAmount: (_, row) => inlineNumber(row.id as number, "principalAmount", (row.principalAmount as string) ?? ""),
        interestAmount: (_, row) => inlineNumber(row.id as number, "interestAmount", (row.interestAmount as string) ?? ""),
        overshortAmount: (_, row) => inlineNumber(row.id as number, "overshortAmount", (row.overshortAmount as string) ?? ""),
        operationFee: (_, row) => inlineNumber(row.id as number, "operationFee", (row.operationFee as string) ?? ""),
        redemptionAmount: (_, row) => inlineNumber(row.id as number, "redemptionAmount", (row.redemptionAmount as string) ?? ""),
        redemptionDate: (_, row) => inlineDate(row.id as number, "redemptionDate", (row.redemptionDate as string) ?? ""),
        endMemo: (_, row) => inlineTextarea(row.id as number, "endMemo", (row.endMemo as string) ?? ""),
      }
    : {
        loanExecutionDate: (_, row) => (
          <span className="whitespace-nowrap">
            {fmtDateTime(row.loanExecutionDate as string, row.loanExecutionTime as string)}
          </span>
        ),
        memo: truncateCell,
        memorandum: truncateCell,
        funds: truncateCell,
        endMemo: truncateCell,
      };

  const customActions: CustomAction[] | undefined = isLender
    ? [
        {
          icon: <Pencil className="h-4 w-4" />,
          label: "進捗データを編集",
          onClick: openProgressEdit,
        },
      ]
    : undefined;

  const customHeaderRenderers = isLender
    ? {
        interestAmount: () => (
          <button
            type="button"
            onClick={() => openRateDialog("interest")}
            className="hover:underline focus:outline-none"
            title="クリックして利息%を編集"
          >
            利息分 <span className="text-xs text-gray-500">({formatRatePercent(rates.interestRate)})</span>
          </button>
        ),
        operationFee: () => (
          <button
            type="button"
            onClick={() => openRateDialog("fee")}
            className="hover:underline focus:outline-none"
            title="クリックしてフィー%を編集"
          >
            運用フィー <span className="text-xs text-gray-500">({formatRatePercent(rates.feeRate)})</span>
          </button>
        ),
      }
    : undefined;

  return (
    <div className="space-y-4">
      <ShareableUrlCard />
      <CrudTable
        tableId="hojo.lender.customer-progress"
        data={data as unknown as Record<string, unknown>[]}
        columns={columns}
        emptyMessage="進捗データはまだありません"
        customRenderers={customRenderers}
        customHeaderRenderers={customHeaderRenderers}
        customActions={customActions}
      />

      {/* 編集モーダル */}
      <Dialog open={!!editRow} onOpenChange={(open) => { if (!open) setEditRow(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>進捗データ編集</DialogTitle>
          </DialogHeader>
          <div className="max-h-[80vh] overflow-y-auto space-y-4 pr-2">
            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select value={editData.statusId || "none"} onValueChange={(v) => setEditData((d) => ({ ...d, statusId: v === "none" ? "" : v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未設定</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Textarea value={editData.memo ?? ""} onChange={(e) => setEditData((d) => ({ ...d, memo: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>覚書</Label>
              <Textarea value={editData.memorandum ?? ""} onChange={(e) => setEditData((d) => ({ ...d, memorandum: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>資金</Label>
              <Textarea value={editData.funds ?? ""} onChange={(e) => setEditData((d) => ({ ...d, funds: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>償還表発行日</Label>
              <Input type="date" value={editData.redemptionScheduleIssuedAt ?? ""} onChange={(e) => setEditData((d) => ({ ...d, redemptionScheduleIssuedAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>返金日(着金日)</Label>
              <Input type="date" value={editData.repaymentDate ?? ""} onChange={(e) => setEditData((d) => ({ ...d, repaymentDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>返金額(着金額)</Label>
              <Input type="number" value={editData.repaymentAmount ?? ""} onChange={(e) => setEditData((d) => ({ ...d, repaymentAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>元金分</Label>
              <Input type="number" value={editData.principalAmount ?? ""} onChange={(e) => setEditData((d) => ({ ...d, principalAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>利息分</Label>
              <Input type="number" value={editData.interestAmount ?? ""} onChange={(e) => setEditData((d) => ({ ...d, interestAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>過不足</Label>
              <Input type="number" value={editData.overshortAmount ?? ""} onChange={(e) => setEditData((d) => ({ ...d, overshortAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>運用フィー</Label>
              <Input type="number" value={editData.operationFee ?? ""} onChange={(e) => setEditData((d) => ({ ...d, operationFee: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>償還額</Label>
              <Input type="number" value={editData.redemptionAmount ?? ""} onChange={(e) => setEditData((d) => ({ ...d, redemptionAmount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>償還日</Label>
              <Input type="date" value={editData.redemptionDate ?? ""} onChange={(e) => setEditData((d) => ({ ...d, redemptionDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>返済備考</Label>
              <Textarea value={editData.endMemo ?? ""} onChange={(e) => setEditData((d) => ({ ...d, endMemo: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>キャンセル</Button>
            <Button onClick={handleEditSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 利率/フィー率 編集ダイアログ */}
      <Dialog open={!!rateDialog} onOpenChange={(open) => { if (!open) setRateDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{rateDialog === "interest" ? "利息% を編集" : "運用フィー% を編集"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>{rateDialog === "interest" ? "利息率（%）" : "フィー率（%）"}</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="例: 5"
              />
              <p className="text-xs text-gray-500">
                例: 5 と入力すると 5% として保存されます。
              </p>
            </div>
            <p className="text-xs text-amber-600">
              ※ 既存レコードの該当項目（{rateDialog === "interest" ? "利息分・過不足" : "運用フィー・償還額"}）も新しい%で再計算され、手動上書き値は上書きされます。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRateDialog(null)} disabled={rateSaving}>キャンセル</Button>
            <Button onClick={handleRateSave} disabled={rateSaving}>{rateSaving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// メインコンポーネント
// ---------------------------------------------------------------------------

const VALID_SECTIONS: LenderSection[] = ["loan-submissions", "customer-progress"];

function LenderDataPage({
  isLender,
  corporateData,
  individualData,
  vendors,
  progressData,
  statusOptions,
  rates,
  userName,
}: Omit<Props, "authenticated">) {
  const [activeSection, setActiveSection] = useState<LenderSection>("loan-submissions");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (VALID_SECTIONS.includes(hash as LenderSection)) {
      setActiveSection(hash as LenderSection);
    }
  }, []);

  const handleSectionChange = useCallback((section: LenderSection) => {
    setActiveSection(section);
    window.history.replaceState(null, "", `#${section}`);
  }, []);

  const header = (
    <PortalHeader
      title="貸金業社様 専用ページ"
      rightContent={
        isLender && userName ? (
          <PortalUserMenu
            userName={userName}
            onLogout={() => signOut({ callbackUrl: "/hojo/lender" })}
          />
        ) : undefined
      }
    />
  );

  const sidebar = (
    <PortalSidebar
      sections={menuSections}
      activeKey={activeSection}
      onSelect={(key) => handleSectionChange(key as LenderSection)}
    />
  );

  const renderSection = () => {
    switch (activeSection) {
      case "loan-submissions":
        return (
          <LoanSubmissionsSection
            corporateData={corporateData}
            individualData={individualData}
            vendors={vendors}
            isLender={isLender}
          />
        );
      case "customer-progress":
        return (
          <CustomerProgressSection
            data={progressData}
            statusOptions={statusOptions}
            isLender={isLender}
            rates={rates}
          />
        );
    }
  };

  return (
    <PortalLayout
      header={header}
      sidebar={sidebar}
      pageTitle={getSectionTitle(activeSection)}
    >
      {renderSection()}
    </PortalLayout>
  );
}

export function LenderClientPage({
  authenticated,
  isLender,
  corporateData,
  individualData,
  vendors,
  progressData,
  statusOptions,
  rates,
  userName,
}: Props) {
  if (!authenticated) return <LoginForm />;
  return (
    <div className={isLender ? "min-h-screen" : ""}>
      <LenderDataPage
        isLender={isLender}
        corporateData={corporateData}
        individualData={individualData}
        vendors={vendors}
        progressData={progressData}
        statusOptions={statusOptions}
        rates={rates}
        userName={userName}
      />
    </div>
  );
}
