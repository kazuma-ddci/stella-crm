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
import { Eye, History, Pencil, Copy, Check, Link as LinkIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { InlineCell } from "@/components/inline-cell";
import Link from "next/link";
import { recordLenderPasswordResetRequest, updateLoanLenderMemo, updateLenderProgress } from "./actions";
import {
  PortalHeader,
  PortalUserMenu,
  PortalLayout,
  PortalSidebar,
  PortalLoginWrapper,
} from "@/components/alkes-portal";

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

type Props = {
  authenticated: boolean;
  isLender: boolean;
  corporateData: LoanSubmissionRow[];
  individualData: LoanSubmissionRow[];
  vendors: { id: number; name: string }[];
  progressData: LenderProgressRow[];
  statusOptions: { value: string; label: string }[];
  userName?: string;
};

// ---------------------------------------------------------------------------
// セクション定義
// ---------------------------------------------------------------------------

const INDIVIDUAL_DISPLAY_SECTIONS = [
  {
    title: "ご契約者様の情報",
    fields: [
      { key: "ind_email", label: "メールアドレス" },
      { key: "ind_name", label: "氏名(正式名称)" },
      { key: "ind_name_kana", label: "氏名(カナ)" },
      { key: "ind_postal_code", label: "郵便番号" },
      { key: "ind_address", label: "住所" },
      { key: "ind_phone", label: "電話番号" },
      { key: "ind_birthday", label: "生年月日" },
      { key: "ind_gender", label: "性別" },
    ],
  },
  {
    title: "事業者情報",
    fields: [
      { key: "ind_business_name", label: "屋号(正式名称)" },
      { key: "ind_business_type", label: "事業内容" },
      { key: "ind_business_start", label: "事業開始年月" },
      { key: "ind_income_type", label: "所得区分" },
      { key: "ind_office_address", label: "事業所住所" },
      { key: "ind_office_phone", label: "事業所電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "ind_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "口座情報",
    fields: [
      { key: "ind_bank_name", label: "金融機関名" },
      { key: "ind_branch_name", label: "支店名" },
      { key: "ind_account_type", label: "口座種別" },
      { key: "ind_account_number", label: "口座番号" },
      { key: "ind_account_holder", label: "口座名義人カナ" },
    ],
  },
];

const CORPORATE_DISPLAY_SECTIONS = [
  {
    title: "御社の情報",
    fields: [
      { key: "corp_email", label: "メールアドレス" },
      { key: "corp_company_name", label: "法人名称(正式名称)" },
      { key: "corp_company_name_kana", label: "法人名称(カナ)" },
      { key: "corp_postal_code", label: "法人郵便番号" },
      { key: "corp_address", label: "法人本店所在地" },
      { key: "corp_phone", label: "法人電話番号" },
    ],
  },
  {
    title: "代表者の情報",
    fields: [
      { key: "corp_rep_name", label: "代表者氏名(正式名称)" },
      { key: "corp_rep_name_kana", label: "代表者氏名(カナ)" },
      { key: "corp_rep_birthday", label: "代表者生年月日" },
      { key: "corp_rep_gender", label: "性別" },
      { key: "corp_rep_postal_code", label: "代表者郵便番号" },
      { key: "corp_rep_address", label: "代表者住所" },
      { key: "corp_rep_phone", label: "代表者電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "corp_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "口座情報",
    fields: [
      { key: "corp_bank_name", label: "金融機関名" },
      { key: "corp_branch_name", label: "支店名" },
      { key: "corp_account_type", label: "口座種別" },
      { key: "corp_account_number", label: "口座番号" },
      { key: "corp_account_holder", label: "口座名義人(カナ)" },
    ],
  },
];

function getBOSections(answers: Record<string, string>) {
  const sections = [];
  for (let i = 1; ; i++) {
    if (!answers[`corp_bo${i}_name`]) break;
    sections.push({
      title: `実質的支配者 ${i}人目`,
      fields: [
        { key: `corp_bo${i}_name`, label: "氏名称" },
        { key: `corp_bo${i}_name_kana`, label: "氏名称フリガナ" },
        { key: `corp_bo${i}_address`, label: "住所" },
        { key: `corp_bo${i}_share`, label: "議決権等保有割合" },
        { key: `corp_bo${i}_birthday`, label: "生年月日" },
        { key: `corp_bo${i}_gender`, label: "性別" },
      ],
    });
  }
  return sections;
}

function getAllSections(submission: LoanSubmissionRow) {
  const isCorporate = submission.formType === "loan-corporate";
  const currentAnswers = submission.modifiedAnswers ?? submission.answers;
  const baseSections = isCorporate ? CORPORATE_DISPLAY_SECTIONS : INDIVIDUAL_DISPLAY_SECTIONS;
  const boSections = isCorporate ? getBOSections(currentAnswers) : [];
  return [...baseSections, ...boSections];
}

// ---------------------------------------------------------------------------
// 共有URLカード（貸金業社ポータル共有用）
// ---------------------------------------------------------------------------

function ShareableUrlCard() {
  const [copied, setCopied] = useState(false);

  const portalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/hojo/lender`
      : "/hojo/lender";

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
          <p className="text-gray-600">お手数ですが、ALKESスタッフへご連絡ください。</p>
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
            <Link href="/hojo/lender/register" className="text-[#3b9d9d] hover:underline">アカウント登録</Link>
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
    try {
      await updateLoanLenderMemo(id, value);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    }
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

  return (
    <div className="space-y-4">
      <ShareableUrlCard />
      <div className="flex items-center gap-3">
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
      </div>

      <Tabs defaultValue="corporate">
        <TabsList>
          <TabsTrigger value="corporate">
            法人 ({vendorFilter && vendorFilter !== "all"
              ? corporateData.filter((r) => r.vendorName === vendorFilter).length
              : corporateData.length})
          </TabsTrigger>
          <TabsTrigger value="individual">
            個人事業主 ({vendorFilter && vendorFilter !== "all"
              ? individualData.filter((r) => r.vendorName === vendorFilter).length
              : individualData.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="corporate" className="mt-4">
          <SubmissionTable
            data={corporateData}
            vendorFilter={vendorFilter === "all" ? "" : vendorFilter}
            isLender={isLender}
          />
        </TabsContent>
        <TabsContent value="individual" className="mt-4">
          <SubmissionTable
            data={individualData}
            vendorFilter={vendorFilter === "all" ? "" : vendorFilter}
            isLender={isLender}
          />
        </TabsContent>
      </Tabs>
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
}: {
  data: LenderProgressRow[];
  statusOptions: { value: string; label: string }[];
  isLender: boolean;
}) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<LenderProgressRow | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async (id: number, field: string, value: string) => {
    try {
      await updateLenderProgress(id, field, value);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    }
  };

  const openProgressEdit = (row: LenderProgressRow) => {
    setEditRow(row);
    setEditData({
      statusId: row.statusId,
      memo: row.memo,
      memorandum: row.memorandum,
      funds: row.funds,
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

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <ShareableUrlCard />
        <div className="text-center py-12 text-muted-foreground text-sm">
          進捗データはまだありません
        </div>
      </div>
    );
  }

  const fmtDateTime = (d: string, t: string) => {
    if (!d) return "-";
    return t ? `${d} ${t}` : d;
  };

  const editableBg = isLender ? " bg-blue-50" : "";
  const editableCellBg = isLender ? " bg-blue-50/50" : "";

  return (
    <div className="space-y-4">
      <ShareableUrlCard />
      <div className="overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">No.</TableHead>
              <TableHead>ベンダー</TableHead>
              <TableHead className="w-12">ベンダーNo.</TableHead>
              <TableHead>依頼日</TableHead>
              <TableHead>社名（屋号名）</TableHead>
              <TableHead>代表者(契約者)氏名</TableHead>
              <TableHead className={editableBg}>ステータス</TableHead>
              <TableHead>法人/個人</TableHead>
              <TableHead>最終更新日</TableHead>
              <TableHead className={editableBg}>備考</TableHead>
              <TableHead className={editableBg}>覚書</TableHead>
              <TableHead className={editableBg}>資金</TableHead>
              <TableHead>ツール購入代金</TableHead>
              <TableHead>貸付金額</TableHead>
              <TableHead>資金移動日</TableHead>
              <TableHead>貸付実行日</TableHead>
              <TableHead className={editableBg}>返金日(着金日)</TableHead>
              <TableHead className={editableBg}>返金額(着金額)</TableHead>
              <TableHead className={editableBg}>元金分</TableHead>
              <TableHead className={editableBg}>利息分</TableHead>
              <TableHead className={editableBg}>過不足</TableHead>
              <TableHead className={editableBg}>運用フィー</TableHead>
              <TableHead className={editableBg}>償還額</TableHead>
              <TableHead className={editableBg}>償還日</TableHead>
              <TableHead className={editableBg}>返済備考</TableHead>
              {isLender && (
                <TableHead className="sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.id} className="group/row">
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="whitespace-nowrap">{row.vendorName}</TableCell>
                <TableCell>{row.vendorNo}</TableCell>
                <TableCell className="whitespace-nowrap">{row.requestDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.companyName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.representName || "-"}</TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <Select value={row.statusId || "none"} onValueChange={(v) => handleSave(row.id, "statusId", v === "none" ? "" : v)}>
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
                  ) : (
                    row.statusName || "-"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.applicantType || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.updatedAt}</TableCell>
                <TableCell className={"max-w-[150px]" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.memo} onSave={(v) => handleSave(row.id, "memo", v)} type="textarea">
                      <span className="truncate block">{row.memo || "-"}</span>
                    </InlineCell>
                  ) : row.memo || "-"}
                </TableCell>
                <TableCell className={"max-w-[150px]" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.memorandum} onSave={(v) => handleSave(row.id, "memorandum", v)} type="textarea">
                      <span className="truncate block">{row.memorandum || "-"}</span>
                    </InlineCell>
                  ) : row.memorandum || "-"}
                </TableCell>
                <TableCell className={"max-w-[150px]" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.funds} onSave={(v) => handleSave(row.id, "funds", v)} type="textarea">
                      <span className="truncate block">{row.funds || "-"}</span>
                    </InlineCell>
                  ) : row.funds || "-"}
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.toolPurchasePrice || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.loanAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.fundTransferDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDateTime(row.loanExecutionDate, row.loanExecutionTime)}</TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.repaymentDate} onSave={(v) => handleSave(row.id, "repaymentDate", v)} type="date">
                      {row.repaymentDate || "-"}
                    </InlineCell>
                  ) : row.repaymentDate || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.repaymentAmount.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "repaymentAmount", v)} type="number">
                      {row.repaymentAmount || "-"}
                    </InlineCell>
                  ) : row.repaymentAmount || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.principalAmount.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "principalAmount", v)} type="number">
                      {row.principalAmount || "-"}
                    </InlineCell>
                  ) : row.principalAmount || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.interestAmount.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "interestAmount", v)} type="number">
                      {row.interestAmount || "-"}
                    </InlineCell>
                  ) : row.interestAmount || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.overshortAmount.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "overshortAmount", v)} type="number">
                      {row.overshortAmount || "-"}
                    </InlineCell>
                  ) : row.overshortAmount || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.operationFee.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "operationFee", v)} type="number">
                      {row.operationFee || "-"}
                    </InlineCell>
                  ) : row.operationFee || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.redemptionAmount.replace(/,/g, "")} onSave={(v) => handleSave(row.id, "redemptionAmount", v)} type="number">
                      {row.redemptionAmount || "-"}
                    </InlineCell>
                  ) : row.redemptionAmount || "-"}
                </TableCell>
                <TableCell className={"whitespace-nowrap" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.redemptionDate} onSave={(v) => handleSave(row.id, "redemptionDate", v)} type="date">
                      {row.redemptionDate || "-"}
                    </InlineCell>
                  ) : row.redemptionDate || "-"}
                </TableCell>
                <TableCell className={"max-w-[150px]" + editableCellBg}>
                  {isLender ? (
                    <InlineCell value={row.endMemo} onSave={(v) => handleSave(row.id, "endMemo", v)} type="textarea">
                      <span className="truncate block">{row.endMemo || "-"}</span>
                    </InlineCell>
                  ) : row.endMemo || "-"}
                </TableCell>
                {isLender && (
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <Button variant="ghost" size="sm" onClick={() => openProgressEdit(row)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
        userName={userName}
      />
    </div>
  );
}
