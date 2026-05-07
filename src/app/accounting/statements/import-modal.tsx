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

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
  const [companyId, setCompanyId] = useState<string>(
    defaultCompanyId ? String(defaultCompanyId) : ""
  );
  const [bankAccountId, setBankAccountId] = useState<string>(
    defaultBankAccountId ? String(defaultBankAccountId) : ""
  );
  const [formatId, setFormatId] = useState<BankStatementFormatId | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportStatementSummary | null>(null);

  const selectedCompany = useMemo(
    () => companies.find((c) => String(c.id) === companyId) ?? null,
    [companies, companyId]
  );
  const bankAccounts = selectedCompany?.bankAccounts ?? [];

  useEffect(() => {
    if (!open || uploading) return;
    const nextCompanyId = defaultCompanyId ? String(defaultCompanyId) : "";
    const nextBankAccountId = defaultBankAccountId
      ? String(defaultBankAccountId)
      : "";
    setCompanyId(nextCompanyId);
    setBankAccountId(nextBankAccountId);
    setResult(null);
  }, [defaultBankAccountId, defaultCompanyId, open, uploading]);

  const canSubmit =
    !!companyId && !!bankAccountId && !!formatId && !!file && !uploading;

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !file || !formatId) return;
    if (file.size > 900 * 1024) {
      toast.error(
        "ファイルサイズが大きすぎます（900KBまで）。CSVを分割してアップロードしてください"
      );
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const csvText = decodeArrayBuffer(buffer);
      const res = await importStatementCsv({
        operatingCompanyId: parseInt(companyId, 10),
        operatingCompanyBankAccountId: parseInt(bankAccountId, 10),
        bankFormatId: formatId,
        fileName: file.name,
        csvText,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      if (res.data.inserted > 0) {
        toast.success(
          `${res.data.inserted}件 取込（重複スキップ ${res.data.duplicates}件）`
        );
      } else if (res.data.duplicates > 0) {
        toast.info(
          `新規取込はありませんでした（${res.data.duplicates}件 重複）`
        );
      } else {
        toast.warning("取込された取引はありません");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "取込に失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSV取込</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            法人と銀行口座を選び、対応するフォーマットでCSVをアップロード。重複行は自動でスキップされます。
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(120px,0.8fr)_minmax(0,1.8fr)_minmax(160px,1.1fr)]">
            <div className="min-w-0 space-y-1">
              <Label>法人</Label>
              <Select
                value={companyId}
                onValueChange={(v) => {
                  setCompanyId(v);
                  setBankAccountId("");
                }}
                disabled={uploading}
              >
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1">
              <Label>銀行口座</Label>
              <Select
                value={bankAccountId}
                onValueChange={setBankAccountId}
                disabled={uploading || !companyId}
              >
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue
                    placeholder={
                      companyId ? "選択してください" : "先に法人を選択"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.bankName} {b.branchName} {b.accountType} {b.accountNumber}
                    </SelectItem>
                  ))}
                  {bankAccounts.length === 0 && companyId && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      この法人に銀行口座が登録されていません
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-1">
              <Label>CSVフォーマット</Label>
              <Select
                value={formatId}
                onValueChange={(v) => setFormatId(v as BankStatementFormatId)}
                disabled={uploading}
              >
                <SelectTrigger className="w-full min-w-0 overflow-hidden">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {BANK_STATEMENT_FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>CSVファイル</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-accent cursor-pointer"
            />
            {file && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {result && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">取込結果:</span>
                <Badge className="bg-green-600">新規 {result.inserted}件</Badge>
                {result.duplicates > 0 && (
                  <Badge variant="secondary">
                    重複スキップ {result.duplicates}件
                  </Badge>
                )}
                {result.parseErrors.length > 0 && (
                  <Badge variant="destructive">
                    パース警告 {result.parseErrors.length}件
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  解析対象 {result.totalRowsParsed}行 / スキップ{" "}
                  {result.skippedLines}行
                </span>
              </div>

              {result.parseErrors.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-amber-900">
                        パース時の警告
                      </p>
                      <ul className="text-xs text-amber-900 space-y-0.5 mt-1 max-h-48 overflow-y-auto">
                        {result.parseErrors.map((e, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-amber-600">行{e.line}:</span>
                            <span>{e.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.inserted > 0 && result.parseErrors.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  エラー無く取込完了しました
                </div>
              )}
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
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                取込中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                取込実行
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
