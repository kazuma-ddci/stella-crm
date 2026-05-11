"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  importStatementCsv,
  type ImportStatementSummary,
} from "./import-actions";
import type { StatementCompanyOption } from "./actions";
import {
  BANK_STATEMENT_FORMAT_OPTIONS,
  type BankStatementFormatId,
} from "@/lib/accounting/statements/format-options";

type ImportStatus = "ready" | "needs_input" | "importing" | "success" | "error";

type ImportQueueItem = {
  id: string;
  file: File;
  companyId: string;
  bankAccountId: string;
  formatId: BankStatementFormatId | "";
  status: ImportStatus;
  result: ImportStatementSummary | null;
  error: string | null;
  autoDetected: boolean;
};

function decodeArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.slice(3));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("shift_jis").decode(bytes);
  }
}

const MANUAL_STANDARD_TEMPLATE = [
  ["日付", "摘要", "入金", "出金", "残高", "メモ"],
  ["2026-04-01", "サンプル入金", "10000", "", "110000", "必要に応じてメモ"],
  ["2026-04-02", "サンプル出金", "", "3000", "107000", ""],
];

const FORMAT_LABEL_BY_ID = new Map(
  BANK_STATEMENT_FORMAT_OPTIONS.map((format) => [format.id, format.label])
);

const COMPANY_FILE_HINTS: { hints: string[]; companyIncludes: string }[] = [
  { hints: ["stp"], companyIncludes: "Stella Talent Partners" },
  { hints: ["stella"], companyIncludes: "Stella株式会社" },
  { hints: ["aeon"], companyIncludes: "AEON" },
  { hints: ["meta trust", "metatrust"], companyIncludes: "Meta Trust" },
  { hints: ["metahealth", "meta health"], companyIncludes: "MetaHealth" },
  { hints: ["lifeadds"], companyIncludes: "lifeadds" },
  { hints: ["アドア", "アドア"], companyIncludes: "アドア" },
  { hints: ["スピナンザ", "スピナンザ"], companyIncludes: "スピナンザ" },
  { hints: ["申請サポートセンター", "申請サポートセンター"], companyIncludes: "申請サポートセンター" },
];

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[\s　・_\-()（）株式会社合同会社]/g, "");
}

function detectFormatFromFileName(fileName: string): BankStatementFormatId | "" {
  const normalized = normalizeForMatch(fileName);
  if (normalized.includes("住信")) return "sumishin_sbi";
  if (normalized.includes("gmo")) return "gmo_aozora";
  if (normalized.includes("楽天")) return "rakuten";
  if (normalized.includes("三井")) return "zengin_mitsui";
  return "";
}

function bankMatchesFormat(
  bankName: string,
  formatId: BankStatementFormatId | ""
): boolean {
  const normalized = normalizeForMatch(bankName);
  if (formatId === "sumishin_sbi") return normalized.includes("住信");
  if (formatId === "gmo_aozora") return normalized.includes("gmo") || normalized.includes("あおぞら");
  if (formatId === "rakuten") return normalized.includes("楽天");
  if (formatId === "zengin_mitsui") return normalized.includes("三井");
  return false;
}

function createImportItem(
  file: File,
  index: number,
  companies: StatementCompanyOption[],
  defaultCompanyId?: number | null,
  defaultBankAccountId?: number | null
): ImportQueueItem {
  const formatId = detectFormatFromFileName(file.name);
  const fileKey = normalizeForMatch(file.name);
  const fileNameWithoutExt = file.name.replace(/\.[^.]+$/, "");

  let companyId = "";
  let bankAccountId = "";
  let autoDetected = false;

  for (const company of companies) {
    const matchedAccount = company.bankAccounts.find((account) => {
      const note = account.note ?? "";
      return (
        normalizeForMatch(note).includes(fileKey) ||
        normalizeForMatch(note).includes(normalizeForMatch(fileNameWithoutExt))
      );
    });
    if (matchedAccount) {
      companyId = String(company.id);
      bankAccountId = String(matchedAccount.id);
      autoDetected = true;
      break;
    }
  }

  if (!companyId) {
    const matchedHint = COMPANY_FILE_HINTS.find((entry) =>
      entry.hints.some((hint) => fileKey.includes(normalizeForMatch(hint)))
    );
    const matchedCompany = matchedHint
      ? companies.find((company) =>
          normalizeForMatch(company.name).includes(
            normalizeForMatch(matchedHint.companyIncludes)
          )
        )
      : null;
    if (matchedCompany) {
      companyId = String(matchedCompany.id);
      autoDetected = true;
    }
  }

  if (!companyId && defaultCompanyId) {
    companyId = String(defaultCompanyId);
  }

  const selectedCompany =
    companies.find((company) => String(company.id) === companyId) ?? null;

  if (!bankAccountId && selectedCompany) {
    const matchedByBank = selectedCompany.bankAccounts.find((account) =>
      bankMatchesFormat(account.bankName, formatId)
    );
    const fallbackAccount = defaultBankAccountId
      ? selectedCompany.bankAccounts.find(
          (account) => account.id === defaultBankAccountId
        )
      : null;
    const selectedAccount = matchedByBank ?? fallbackAccount;
    if (selectedAccount) {
      bankAccountId = String(selectedAccount.id);
      autoDetected = autoDetected || !!matchedByBank;
    }
  }

  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    file,
    companyId,
    bankAccountId,
    formatId,
    status: companyId && bankAccountId && formatId ? "ready" : "needs_input",
    result: null,
    error: null,
    autoDetected,
  };
}

function getItemStatusLabel(item: ImportQueueItem): string {
  if (item.status === "success") return "取込済み";
  if (item.status === "error") return "エラー";
  if (item.status === "importing") return "取込中";
  if (item.status === "needs_input") return "要確認";
  return item.autoDetected ? "自動判定" : "手動設定";
}

function getItemStatusClass(item: ImportQueueItem): string {
  if (item.status === "success") return "bg-green-100 text-green-700 border-green-200";
  if (item.status === "error") return "bg-red-100 text-red-700 border-red-200";
  if (item.status === "importing") return "bg-blue-100 text-blue-700 border-blue-200";
  if (item.status === "needs_input") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function ImportModal({
  open,
  onOpenChange,
  companies,
  defaultCompanyId,
  defaultBankAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: StatementCompanyOption[];
  defaultCompanyId?: number | null;
  defaultBankAccountId?: number | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState<ImportQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open && !uploading) setItems([]);
  }, [open, uploading]);

  const canSubmit =
    items.length > 0 &&
    items.every(
      (item) =>
        item.companyId &&
        item.bankAccountId &&
        item.formatId &&
        item.file.size <= 900 * 1024 &&
        item.status !== "importing"
    ) &&
    !uploading;

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          if (item.result) {
            acc.inserted += item.result.inserted;
            acc.duplicates += item.result.duplicates;
            acc.errors += item.result.parseErrors.length;
          }
          if (item.status === "success") acc.success += 1;
          if (item.status === "error") acc.failed += 1;
          return acc;
        },
        { inserted: 0, duplicates: 0, errors: 0, success: 0, failed: 0 }
      ),
    [items]
  );

  const handleDownloadTemplate = () => {
    const csv = MANUAL_STANDARD_TEMPLATE
      .map((row) => row.map(csvEscape).join(","))
      .join("\r\n");
    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank_statement_manual_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const updateItem = (
    itemId: string,
    updater: (item: ImportQueueItem) => ImportQueueItem
  ) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? updater(item) : item))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setItems(
      files.map((file, index) =>
        createImportItem(
          file,
          index,
          companies,
          defaultCompanyId,
          defaultBankAccountId
        )
      )
    );
    e.target.value = "";
  };

  const handleCompanyChange = (itemId: string, nextCompanyId: string) => {
    updateItem(itemId, (item) => ({
      ...item,
      companyId: nextCompanyId,
      bankAccountId: "",
      status: item.formatId ? "needs_input" : item.status,
      result: null,
      error: null,
      autoDetected: false,
    }));
  };

  const handleBankAccountChange = (itemId: string, nextBankAccountId: string) => {
    updateItem(itemId, (item) => {
      const ready = item.companyId && nextBankAccountId && item.formatId;
      return {
        ...item,
        bankAccountId: nextBankAccountId,
        status: ready ? "ready" : "needs_input",
        result: null,
        error: null,
        autoDetected: false,
      };
    });
  };

  const handleFormatChange = (
    itemId: string,
    nextFormatId: BankStatementFormatId
  ) => {
    updateItem(itemId, (item) => {
      const ready = item.companyId && item.bankAccountId && nextFormatId;
      return {
        ...item,
        formatId: nextFormatId,
        status: ready ? "ready" : "needs_input",
        result: null,
        error: null,
        autoDetected: false,
      };
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const okToImport = window.confirm(
      `${items.length}件のCSVを表示中の設定で一括取込します。実行してよろしいですか？`
    );
    if (!okToImport) return;

    setUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const item of items) {
      updateItem(item.id, (current) => ({
        ...current,
        status: "importing",
        result: null,
        error: null,
      }));
      try {
        const buffer = await item.file.arrayBuffer();
        const csvText = decodeArrayBuffer(buffer);
        const res = await importStatementCsv({
          operatingCompanyId: parseInt(item.companyId, 10),
          operatingCompanyBankAccountId: parseInt(item.bankAccountId, 10),
          bankFormatId: item.formatId,
          fileName: item.file.name,
          csvText,
        });

        if (!res.ok) {
          failedCount += 1;
          updateItem(item.id, (current) => ({
            ...current,
            status: "error",
            error: res.error,
          }));
          continue;
        }

        successCount += 1;
        updateItem(item.id, (current) => ({
          ...current,
          status: "success",
          result: res.data,
        }));
      } catch (e) {
        failedCount += 1;
        updateItem(item.id, (current) => ({
          ...current,
          status: "error",
          error: e instanceof Error ? e.message : "取込に失敗しました",
        }));
      }
    }

    setUploading(false);
    router.refresh();

    if (failedCount > 0) {
      toast.error(`${successCount}件成功、${failedCount}件失敗しました`);
    } else {
      toast.success(`${successCount}件のCSV取込が完了しました`);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setItems([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        style={{ width: "min(1100px, calc(100vw - 2rem))", maxWidth: "1100px" }}
      >
        <DialogHeader>
          <DialogTitle>CSV一括取込</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            複数CSVをまとめて選択し、法人・銀行口座・フォーマットの判定結果を確認してから一括取込できます。判定できない行は手動で選択してください。
          </p>

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                通帳から手動で作る場合は「標準CSV（手動作成用）」を選び、
                テンプレートの列順（日付・摘要・入金・出金・残高・メモ）に合わせて入力してください。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="shrink-0"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                標準CSVテンプレート
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>CSVファイル</Label>
            <input
              type="file"
              multiple
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
          </div>

          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">取込対象 {items.length}件</span>
                {items.some((item) => item.status === "needs_input") && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                    要確認あり
                  </Badge>
                )}
                {totals.success > 0 && (
                  <Badge className="bg-green-600">
                    完了 {totals.success}件 / 新規 {totals.inserted}件
                  </Badge>
                )}
                {totals.duplicates > 0 && (
                  <Badge variant="secondary">重複 {totals.duplicates}件</Badge>
                )}
                {totals.failed > 0 && (
                  <Badge variant="destructive">失敗 {totals.failed}件</Badge>
                )}
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-[980px] w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">CSV</th>
                      <th className="px-3 py-2 font-medium">法人</th>
                      <th className="px-3 py-2 font-medium">銀行口座</th>
                      <th className="px-3 py-2 font-medium">フォーマット</th>
                      <th className="px-3 py-2 font-medium">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item) => {
                      const selectedCompany =
                        companies.find((company) => String(company.id) === item.companyId) ??
                        null;
                      const bankAccounts = selectedCompany?.bankAccounts ?? [];
                      const oversized = item.file.size > 900 * 1024;

                      return (
                        <tr key={item.id} className="align-top">
                          <td className="max-w-[250px] px-3 py-3">
                            <div className="flex items-start gap-2">
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="break-words font-medium">
                                  {item.file.name}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {(item.file.size / 1024).toFixed(1)} KB
                                </div>
                                {oversized && (
                                  <div className="mt-1 text-xs text-red-600">
                                    900KBを超えています
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              value={item.companyId}
                              onValueChange={(v) => handleCompanyChange(item.id, v)}
                              disabled={uploading}
                            >
                              <SelectTrigger className="w-[190px]">
                                <SelectValue placeholder="選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {companies.map((company) => (
                                  <SelectItem key={company.id} value={String(company.id)}>
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              value={item.bankAccountId}
                              onValueChange={(v) => handleBankAccountChange(item.id, v)}
                              disabled={uploading || !item.companyId}
                            >
                              <SelectTrigger className="w-[250px]">
                                <SelectValue placeholder={item.companyId ? "選択" : "先に法人"} />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map((account) => (
                                  <SelectItem key={account.id} value={String(account.id)}>
                                    {account.bankName} {account.branchName} {account.accountType} {account.accountNumber}
                                  </SelectItem>
                                ))}
                                {bankAccounts.length === 0 && item.companyId && (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    この法人に銀行口座がありません
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-3">
                            <Select
                              value={item.formatId}
                              onValueChange={(v) =>
                                handleFormatChange(item.id, v as BankStatementFormatId)
                              }
                              disabled={uploading}
                            >
                              <SelectTrigger className="w-[210px]">
                                <SelectValue placeholder="選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {BANK_STATEMENT_FORMAT_OPTIONS.map((format) => (
                                  <SelectItem key={format.id} value={format.id}>
                                    {format.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {item.formatId && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {FORMAT_LABEL_BY_ID.get(item.formatId)}
                              </div>
                            )}
                          </td>
                          <td className="w-[180px] px-3 py-3">
                            <Badge variant="outline" className={getItemStatusClass(item)}>
                              {getItemStatusLabel(item)}
                            </Badge>
                            {item.status === "importing" && (
                              <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin" />
                            )}
                            {item.error && (
                              <div className="mt-2 text-xs text-red-600">
                                {item.error}
                              </div>
                            )}
                            {item.result && (
                              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                <div>新規 {item.result.inserted}件</div>
                                <div>重複 {item.result.duplicates}件</div>
                                {item.result.parseErrors.length > 0 && (
                                  <div className="text-amber-700">
                                    警告 {item.result.parseErrors.length}件
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {items.some((item) => item.status === "error") && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  エラーの行は設定を見直して、同じCSVを再度選択して取り込んでください。既に取り込まれた行は重複判定でスキップされます。
                </div>
              )}
            </div>
          )}

          {items.length === 0 && (
            <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              CSVを複数選択すると、ここに判定結果が表示されます。
            </div>
          )}

          {items.some((item) => item.status === "needs_input") && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                自動判定できないCSVがあります。法人・銀行口座・CSVフォーマットを選択すると取込できます。
              </p>
            </div>
          )}

          {items.length > 0 && totals.success === items.length && totals.failed === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              一括取込が完了しました。
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            閉じる
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {uploading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                取込中...
              </>
            ) : (
              <>
                <Upload className="mr-1 h-4 w-4" />
                確認して一括取込
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
