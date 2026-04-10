"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Eye, Link as LinkIcon, Pencil, History } from "lucide-react";
import { InlineCell } from "@/components/inline-cell";
import { updateLoanSubmissionAnswers, updateLoanVendorMemo, toggleProgressExclusion } from "./actions";

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

export type LoanSubmissionRow = {
  id: number;
  formType: string;
  companyName: string;
  representName: string;
  email: string;
  phone: string;
  submittedAt: string;
  answers: Record<string, string>;
  modifiedAnswers: Record<string, string> | null;
  changeHistory: ChangeHistoryRecord[] | null;
  vendorMemo: string;
  progressExcluded: boolean; // 顧客進捗管理から除外されているか
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
// 詳細 + 編集モーダル
// ---------------------------------------------------------------------------

function DetailModal({
  submission: initialSubmission,
  vendorId,
  canEdit,
  onClose,
}: {
  submission: LoanSubmissionRow;
  vendorId: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  // ローカルstateで管理 → 保存後に即反映
  const [localSubmission, setLocalSubmission] = useState(initialSubmission);

  const isCorporate = localSubmission.formType === "loan-corporate";
  const allSections = getAllSections(localSubmission);
  const originalAnswers = localSubmission.answers;
  const currentAnswers = localSubmission.modifiedAnswers ?? localSubmission.answers;
  const hasModifications = !!localSubmission.modifiedAnswers;

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditData({ ...currentAnswers });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 変更差分を計算
      const fieldMap: Record<string, { value: string; label: string }> = {};
      for (const section of allSections) {
        for (const f of section.fields) {
          if (editData[f.key] !== currentAnswers[f.key]) {
            fieldMap[f.key] = { value: editData[f.key] || "", label: f.label };
          }
        }
      }
      if (Object.keys(fieldMap).length === 0) {
        setEditing(false);
        return;
      }
      const result = await updateLoanSubmissionAnswers(localSubmission.id, vendorId, fieldMap);
      if (!result.ok) {
        alert(result.error);
        return;
      }

      // ローカルstateを即時更新
      const newModifiedAnswers = { ...currentAnswers };
      const newChanges: ChangeEntry[] = [];
      for (const [key, { value, label }] of Object.entries(fieldMap)) {
        newChanges.push({
          field: key,
          fieldLabel: label,
          oldValue: currentAnswers[key] || "",
          newValue: value,
        });
        newModifiedAnswers[key] = value;
      }
      const newHistoryEntry: ChangeHistoryRecord = {
        changedAt: new Date().toISOString(),
        changedBy: "（自分）",
        changes: newChanges,
      };
      setLocalSubmission((prev) => ({
        ...prev,
        modifiedAnswers: newModifiedAnswers,
        changeHistory: [...(prev.changeHistory ?? []), newHistoryEntry],
      }));

      setEditing(false);
      router.refresh(); // バックグラウンドでサーバーデータも更新
    } finally {
      setSaving(false);
    }
  };

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

        {editing ? (
          /* ===== 編集モード ===== */
          <div className="space-y-4">
            {allSections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h4 className="font-medium text-sm border-b pb-1">{section.title}</h4>
                {section.fields.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      value={editData[field.key] || ""}
                      onChange={(e) => setEditData({ ...editData, [field.key]: e.target.value })}
                      className="text-sm"
                    />
                  </div>
                ))}
              </div>
            ))}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* ===== 閲覧モード ===== */
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

            {/* 最新データ / 元の回答がない場合はこちらのみ */}
            <TabsContent value={hasModifications ? "modified" : "original"}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  回答日時: {new Date(localSubmission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
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
                      フォーム送信時の元データ（{new Date(localSubmission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）
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
                    {!localSubmission.changeHistory || localSubmission.changeHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">変更履歴はありません</p>
                    ) : (
                      [...localSubmission.changeHistory].reverse().map((record, idx) => (
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
        )}

        {!editing && canEdit && (
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={startEdit} className="gap-1">
              <Pencil className="h-3 w-3" />
              回答を編集
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// テーブル
// ---------------------------------------------------------------------------

function SubmissionTable({
  data,
  vendorId,
  canEdit,
}: {
  data: LoanSubmissionRow[];
  vendorId: number;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<LoanSubmissionRow | null>(null);
  const router = useRouter();

  const handleMemoSave = async (id: number, value: string) => {
    const result = await updateLoanVendorMemo(id, vendorId, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleToggleProgress = async (submissionId: number, exclude: boolean) => {
    const result = await toggleProgressExclusion(submissionId, vendorId, exclude);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  if (data.length === 0) {
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
              <TableHead>会社名/屋号</TableHead>
              <TableHead>代表者/氏名</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>回答日時</TableHead>
              <TableHead className="w-12">状態</TableHead>
              <TableHead>備考</TableHead>
              <TableHead className="w-20 text-center">進捗反映</TableHead>
              <TableHead className="w-16">詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.id} className="group/row">
                <TableCell>{idx + 1}</TableCell>
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
                  {canEdit ? (
                    <InlineCell value={row.vendorMemo} onSave={(v) => handleMemoSave(row.id, v)} type="textarea">
                      <span className="truncate block">{row.vendorMemo || "-"}</span>
                    </InlineCell>
                  ) : (
                    <span className="truncate block">{row.vendorMemo || "-"}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {canEdit ? (
                    <button
                      onClick={() => handleToggleProgress(row.id, !row.progressExcluded)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        row.progressExcluded
                          ? "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          : "bg-green-100 text-green-700 hover:bg-green-200"
                      }`}
                    >
                      {row.progressExcluded ? "除外中" : "反映中"}
                    </button>
                  ) : (
                    <span className={`text-xs ${row.progressExcluded ? "text-gray-400" : "text-green-600"}`}>
                      {row.progressExcluded ? "除外" : "反映"}
                    </span>
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
          vendorId={vendorId}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// メインセクション
// ---------------------------------------------------------------------------

export function VendorLoanSection({
  vendorToken,
  vendorId,
  canEdit,
  corporateSubmissions,
  individualSubmissions,
}: {
  vendorToken: string;
  vendorId: number;
  canEdit: boolean;
  corporateSubmissions: LoanSubmissionRow[];
  individualSubmissions: LoanSubmissionRow[];
}) {
  const [copied, setCopied] = useState(false);
  const [formUrl, setFormUrl] = useState(`/form/hojo-loan-application?v=${vendorToken}`);

  useEffect(() => {
    setFormUrl(`${window.location.origin}/form/hojo-loan-application?v=${vendorToken}`);
  }, [vendorToken]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = formUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            借入申込フォームURL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            以下のURLをお客様にお送りください。このURLから申し込みされた回答は自動的にこちらに反映されます。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-gray-100 rounded px-3 py-2 break-all">{formUrl}</code>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">借入申込フォーム回答</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="corporate">
            <TabsList>
              <TabsTrigger value="corporate">法人 ({corporateSubmissions.length})</TabsTrigger>
              <TabsTrigger value="individual">個人事業主 ({individualSubmissions.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="corporate" className="mt-4">
              <SubmissionTable data={corporateSubmissions} vendorId={vendorId} canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="individual" className="mt-4">
              <SubmissionTable data={individualSubmissions} vendorId={vendorId} canEdit={canEdit} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
