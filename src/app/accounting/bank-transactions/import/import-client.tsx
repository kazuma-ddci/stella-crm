"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  parseCsvAction,
  confirmImport,
  type ImportFormData,
  type PreviewRow,
  type ConfirmImportData,
} from "./actions";

type Step = "upload" | "preview" | "result";

type Props = {
  formData: ImportFormData;
};

export function ImportClient({ formData }: Props) {
  const [step, setStep] = useState<Step>("upload");

  // Upload form state
  const [formatId, setFormatId] = useState("");
  const [operatingCompanyId, setOperatingCompanyId] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse result state
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    newCount: number;
    duplicateCount: number;
    errorCount: number;
  } | null>(null);

  // Loading & error
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  // Result state
  const [resultBatchId, setResultBatchId] = useState<number | null>(null);
  const [resultNewCount, setResultNewCount] = useState(0);

  // ---- Upload Step ----
  const handleParse = useCallback(async () => {
    setError("");
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("CSVファイルを選択してください。");
      return;
    }
    if (!formatId) {
      setError("銀行フォーマットを選択してください。");
      return;
    }
    if (!operatingCompanyId) {
      setError("法人を選択してください。");
      return;
    }
    if (!bankAccountName.trim()) {
      setError("銀行口座名を入力してください。");
      return;
    }

    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("formatId", formatId);
      fd.append("operatingCompanyId", operatingCompanyId);
      fd.append("bankAccountName", bankAccountName.trim());

      const result = await parseCsvAction(fd);

      if (!result.success) {
        setError(result.error ?? "解析に失敗しました。");
        return;
      }

      setRows(result.rows ?? []);
      setSummary(result.summary ?? null);
      setFileName(file.name);
      setStep("preview");
    } catch {
      setError("CSV解析中にエラーが発生しました。");
    } finally {
      setParsing(false);
    }
  }, [formatId, operatingCompanyId, bankAccountName]);

  // ---- Preview Step ----
  const toggleRow = useCallback((rowIndex: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r
      )
    );
  }, []);

  const toggleAll = useCallback((checked: boolean) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        selected: r.hasError ? false : checked,
      }))
    );
  }, []);

  const selectedCount = rows.filter((r) => r.selected).length;

  const handleConfirmImport = useCallback(async () => {
    setError("");
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError("取込対象の行を選択してください。");
      return;
    }

    setImporting(true);
    try {
      const data: ConfirmImportData = {
        rows: selectedRows.map((r) => ({
          date: r.date,
          description: r.description,
          incoming: r.incoming,
          outgoing: r.outgoing,
          balance: r.balance,
          memo: r.memo,
          direction: r.direction,
          amount: r.amount,
          hash: r.hash,
        })),
        operatingCompanyId: Number(operatingCompanyId),
        bankAccountName: bankAccountName.trim(),
        formatId,
        fileName,
      };

      const result = await confirmImport(data);

      if (!result.success) {
        setError(result.error ?? "取込に失敗しました。");
        return;
      }

      setResultBatchId(result.batchId ?? null);
      setResultNewCount(result.newCount ?? 0);
      setStep("result");
    } catch {
      setError("取込中にエラーが発生しました。");
    } finally {
      setImporting(false);
    }
  }, [rows, operatingCompanyId, bankAccountName, formatId, fileName]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setRows([]);
    setSummary(null);
    setError("");
    setFileName("");
    setResultBatchId(null);
    setResultNewCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ---- Render ----

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSVファイルのアップロード
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSVファイル</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              ref={fileInputRef}
            />
          </div>

          <div className="space-y-2">
            <Label>銀行フォーマット</Label>
            <Select value={formatId} onValueChange={setFormatId}>
              <SelectTrigger>
                <SelectValue placeholder="フォーマットを選択" />
              </SelectTrigger>
              <SelectContent>
                {formData.bankFormats.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.bankName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>法人</Label>
            <Select
              value={operatingCompanyId}
              onValueChange={setOperatingCompanyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="法人を選択" />
              </SelectTrigger>
              <SelectContent>
                {formData.operatingCompanies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-account-name">銀行口座名</Label>
            <Input
              id="bank-account-name"
              placeholder="例: 三菱UFJ 普通 1234567"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleParse} disabled={parsing} className="w-full">
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                解析中...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                解析する
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "preview") {
    return (
      <div className="space-y-4">
        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-muted-foreground">総件数</div>
                <div className="text-2xl font-bold">
                  {summary.total.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-muted-foreground">新規</div>
                <div className="text-2xl font-bold text-green-600">
                  {summary.newCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-muted-foreground">重複</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {summary.duplicateCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm text-muted-foreground">エラー</div>
                <div className="text-2xl font-bold text-red-600">
                  {summary.errorCount.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                プレビュー ({selectedCount.toLocaleString()}件選択中)
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(true)}
                >
                  すべて選択
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(false)}
                >
                  すべて解除
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 sticky top-0 bg-white z-10">
                      <Checkbox
                        checked={
                          rows.filter((r) => !r.hasError).length > 0 &&
                          rows
                            .filter((r) => !r.hasError)
                            .every((r) => r.selected)
                        }
                        onCheckedChange={(checked) =>
                          toggleAll(checked === true)
                        }
                      />
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10">
                      行
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10">
                      日付
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10">
                      内容
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">
                      入金
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">
                      出金
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10 text-right">
                      残高
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10">
                      メモ
                    </TableHead>
                    <TableHead className="sticky top-0 bg-white z-10">
                      状態
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.rowIndex}
                      className={
                        row.hasError
                          ? "bg-red-50"
                          : row.isDuplicate
                            ? "bg-yellow-50"
                            : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          disabled={row.hasError}
                          onCheckedChange={() => toggleRow(row.rowIndex)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {row.rowIndex + 1}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.date}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {row.description}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.incoming > 0
                          ? row.incoming.toLocaleString()
                          : ""}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.outgoing > 0
                          ? row.outgoing.toLocaleString()
                          : ""}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {row.balance !== null
                          ? row.balance.toLocaleString()
                          : ""}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate text-muted-foreground text-xs">
                        {row.memo}
                      </TableCell>
                      <TableCell>
                        {row.hasError ? (
                          <div>
                            <Badge variant="destructive">エラー</Badge>
                            <div className="text-xs text-red-600 mt-1">
                              {row.errors.join(", ")}
                            </div>
                          </div>
                        ) : row.isDuplicate ? (
                          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
                            重複
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                            新規
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleReset}>
            戻る
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={importing || selectedCount === 0}
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                取込中...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                取込実行 ({selectedCount.toLocaleString()}件)
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Step: result
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          <h2 className="text-xl font-bold">インポート完了</h2>
          <p className="text-muted-foreground">
            {resultNewCount.toLocaleString()}件の取引を取り込みました。
            {resultBatchId && (
              <span className="block text-sm mt-1">
                バッチID: {resultBatchId}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3 max-w-sm mx-auto">
          <Button asChild>
            <Link href="/accounting/bank-transactions">
              入出金履歴を確認する
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/accounting/bank-transactions/history">
              取込管理を確認する
            </Link>
          </Button>
          <Button variant="ghost" onClick={handleReset}>
            続けてインポート
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
