"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  parseAirworkFilename,
  parseDailyCsv,
  parseJobPostingCsv,
  type ParsedDailyRow,
  type ParsedJobPostingRow,
  type AirworkFileType,
} from "@/lib/csv/airwork-parser";
import {
  findAdByNumber,
  createMediaAd,
  importCsvData,
  type CsvImportItem,
} from "./actions";
type Contract = {
  id: number;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  contractPlan: string;
};

const AD_STATUSES = [
  { value: "active", label: "配信中" },
  { value: "ended", label: "終了" },
  { value: "preparing", label: "準備中" },
  { value: "paused", label: "停止中" },
];

type ParsedFile = {
  filename: string;
  type: AirworkFileType;
  adNumber: string;
  adName: string;
  dailyRows?: ParsedDailyRow[];
  jobPostingRows?: ParsedJobPostingRow[];
  error?: string;
};

type AdGroup = {
  adNumber: string;
  adName: string;
  existingAdId: number | null;
  existingAdName: string | null;
  files: ParsedFile[];
  dailyCount: number;
  jobPostingCount: number;
  // 新規登録フォーム
  newAdForm?: {
    contractHistoryId: number;
    status: string;
    startDate: string;
    endDate: string;
    budgetLimit: string;
  };
};

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function decodeArrayBuffer(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);

  // UTF-8 BOM チェック
  if (uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(uint8.slice(3));
  }

  // UTF-8として正しくデコードできるか試行（fatal: trueで不正バイトをエラーにする）
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(uint8);
  } catch {
    // UTF-8でない場合はShift-JISとしてデコード
    return new TextDecoder("shift_jis").decode(uint8);
  }
}

export function CsvUploadDialog({
  open,
  onOpenChange,
  contracts,
  stpCompanyId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  stpCompanyId: number;
  onSuccess: () => void;
}) {
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setParsing(true);
      const parsedFiles: ParsedFile[] = [];

      for (const file of Array.from(files)) {
        if (!file.name.endsWith(".csv")) {
          parsedFiles.push({
            filename: file.name,
            type: "daily",
            adNumber: "",
            adName: "",
            error: "CSVファイルではありません",
          });
          continue;
        }

        const parsed = parseAirworkFilename(file.name);
        if (!parsed) {
          parsedFiles.push({
            filename: file.name,
            type: "daily",
            adNumber: "",
            adName: "",
            error: "ファイル名の形式が認識できません",
          });
          continue;
        }

        try {
          const buffer = await readFileAsArrayBuffer(file);
          const text = decodeArrayBuffer(buffer);

          if (parsed.type === "daily") {
            const rows = parseDailyCsv(text);
            parsedFiles.push({
              filename: file.name,
              type: "daily",
              adNumber: parsed.adNumber,
              adName: parsed.adName,
              dailyRows: rows,
            });
          } else {
            const rows = parseJobPostingCsv(text);
            parsedFiles.push({
              filename: file.name,
              type: "job_posting",
              adNumber: parsed.adNumber,
              adName: parsed.adName,
              jobPostingRows: rows,
            });
          }
        } catch (e) {
          parsedFiles.push({
            filename: file.name,
            type: parsed.type,
            adNumber: parsed.adNumber,
            adName: parsed.adName,
            error: `解析エラー: ${e instanceof Error ? e.message : "不明"}`,
          });
        }
      }

      // 広告番号ごとにグループ化
      const groupMap = new Map<string, AdGroup>();
      for (const pf of parsedFiles) {
        if (pf.error || !pf.adNumber) continue;
        const existing = groupMap.get(pf.adNumber);
        if (existing) {
          existing.files.push(pf);
          if (pf.dailyRows) existing.dailyCount += pf.dailyRows.length;
          if (pf.jobPostingRows) existing.jobPostingCount += pf.jobPostingRows.length;
        } else {
          groupMap.set(pf.adNumber, {
            adNumber: pf.adNumber,
            adName: pf.adName,
            existingAdId: null,
            existingAdName: null,
            files: [pf],
            dailyCount: pf.dailyRows?.length ?? 0,
            jobPostingCount: pf.jobPostingRows?.length ?? 0,
          });
        }
      }

      // エラーファイルもグループに追加
      const errorFiles = parsedFiles.filter((pf) => pf.error);

      // DBで既存広告をチェック
      const groups = Array.from(groupMap.values());
      for (const group of groups) {
        const result = await findAdByNumber(group.adNumber);
        if (result.ok && result.data) {
          group.existingAdId = result.data.id;
          group.existingAdName = result.data.adName;
        } else {
          // 新規広告のデフォルトフォーム
          group.newAdForm = {
            contractHistoryId: contracts[0]?.id ?? 0,
            status: "active",
            startDate: "",
            endDate: "",
            budgetLimit: "",
          };
        }
      }

      setAdGroups(groups);
      setParsing(false);

      if (errorFiles.length > 0) {
        toast.error(
          `${errorFiles.length}件のファイルでエラーが発生しました`
        );
      }
    },
    [contracts]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  const updateNewAdForm = (adNumber: string, field: string, value: string | number) => {
    setAdGroups((prev) =>
      prev.map((g) =>
        g.adNumber === adNumber && g.newAdForm
          ? { ...g, newAdForm: { ...g.newAdForm, [field]: value } }
          : g
      )
    );
  };

  const handleImport = async () => {
    // 未登録広告の契約チェック
    for (const group of adGroups) {
      if (!group.existingAdId && group.newAdForm) {
        if (!group.newAdForm.contractHistoryId) {
          toast.error(`広告 #${group.adNumber} の契約を選択してください`);
          return;
        }
      }
    }

    setImporting(true);
    try {
      // 新規広告を先に作成
      const importItems: CsvImportItem[] = [];
      for (const group of adGroups) {
        let adId = group.existingAdId;

        if (!adId && group.newAdForm) {
          const createResult = await createMediaAd({
            contractHistoryId: group.newAdForm.contractHistoryId,
            adNumber: group.adNumber,
            adName: group.adName,
            status: group.newAdForm.status,
            startDate: group.newAdForm.startDate || null,
            endDate: group.newAdForm.endDate || null,
            budgetLimit: group.newAdForm.budgetLimit
              ? parseInt(group.newAdForm.budgetLimit as string, 10)
              : null,
          });
          if (!createResult.ok) {
            toast.error(`広告 #${group.adNumber} の作成に失敗: ${createResult.error}`);
            setImporting(false);
            return;
          }
          adId = createResult.data.id;
        }

        if (!adId) continue;

        const dailyMetrics = group.files
          .filter((f) => f.type === "daily" && f.dailyRows)
          .flatMap((f) => f.dailyRows!);

        const jobPostings = group.files
          .filter((f) => f.type === "job_posting" && f.jobPostingRows)
          .flatMap((f) => f.jobPostingRows!);

        importItems.push({
          adId,
          adNameFromCsv: group.adName,
          dailyMetrics: dailyMetrics.length > 0 ? dailyMetrics : undefined,
          jobPostings: jobPostings.length > 0 ? jobPostings : undefined,
        });
      }

      const result = await importCsvData(importItems);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `${result.data.importedCount}件のデータをインポートしました`
      );
      onOpenChange(false);
      setAdGroups([]);
      onSuccess();
    } catch {
      toast.error("インポート中にエラーが発生しました");
    } finally {
      setImporting(false);
    }
  };

  const formatContractLabel = (c: Contract) => {
    const media = c.jobMedia || "未設定";
    const start = c.contractStartDate;
    const end = c.contractEndDate || "〜";
    return `${media}（${start}〜${end}）`;
  };

  const handleReset = () => {
    setAdGroups([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setAdGroups([]);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CSVアップロード</DialogTitle>
        </DialogHeader>

        {/* ドロップゾーン */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("csv-file-input")?.click()}
        >
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            CSVファイルをここにドラッグ＆ドロップ
          </p>
          <p className="text-xs text-gray-400 mt-1">
            広告詳細・求人別配信実績のCSVをまとめてアップロードできます
          </p>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {parsing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm text-gray-600">解析中...</span>
          </div>
        )}

        {/* 解析結果 */}
        {adGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium">
                {adGroups.length}件の広告が検出されました
              </p>
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4 mr-1" />
                クリア
              </Button>
            </div>

            {adGroups.map((group) => (
              <div
                key={group.adNumber}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {group.existingAdId ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="font-medium">
                        {group.adName}
                        <span className="ml-1 text-gray-500 text-sm">
                          #{group.adNumber}
                        </span>
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {group.dailyCount > 0 && (
                        <span>日別データ: {group.dailyCount}件</span>
                      )}
                      {group.jobPostingCount > 0 && (
                        <span>求人データ: {group.jobPostingCount}件</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      group.existingAdId
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                  >
                    {group.existingAdId ? "既存の広告" : "新規登録が必要"}
                  </Badge>
                </div>

                {/* 既存広告で名前が異なる場合の通知 */}
                {group.existingAdId &&
                  group.existingAdName &&
                  group.existingAdName !== group.adName && (
                    <p className="text-xs text-blue-600">
                      広告名を「{group.existingAdName}」→「{group.adName}
                      」に更新します
                    </p>
                  )}

                {/* 新規登録フォーム */}
                {!group.existingAdId && group.newAdForm && (
                  <div className="bg-gray-50 rounded p-3 space-y-3">
                    <div>
                      <Label className="text-xs">契約 *</Label>
                      <Select
                        value={group.newAdForm.contractHistoryId?.toString() ?? ""}
                        onValueChange={(v) =>
                          updateNewAdForm(group.adNumber, "contractHistoryId", Number(v))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="契約を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {contracts.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>
                              {formatContractLabel(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">状態</Label>
                        <Select
                          value={group.newAdForm.status}
                          onValueChange={(v) =>
                            updateNewAdForm(group.adNumber, "status", v)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AD_STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">予算上限（円）</Label>
                        <Input
                          type="number"
                          className="h-8 text-sm"
                          value={group.newAdForm.budgetLimit}
                          onChange={(e) =>
                            updateNewAdForm(group.adNumber, "budgetLimit", e.target.value)
                          }
                          placeholder="任意"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">開始日</Label>
                        <DatePicker
                          value={group.newAdForm.startDate}
                          onChange={(v) =>
                            updateNewAdForm(group.adNumber, "startDate", v)
                          }
                          placeholder="任意"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">終了日</Label>
                        <DatePicker
                          value={group.newAdForm.endDate}
                          onChange={(v) =>
                            updateNewAdForm(group.adNumber, "endDate", v)
                          }
                          placeholder="任意"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ファイル一覧 */}
                <div className="space-y-1">
                  {group.files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-gray-600"
                    >
                      <FileText className="h-3 w-3" />
                      <span className="truncate">{f.filename}</span>
                      <span className="text-gray-400">
                        ({f.type === "daily" ? "日別" : "求人別"})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              既存データは新しいCSVデータで入れ替えられます
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={adGroups.length === 0 || importing}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            インポート
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
