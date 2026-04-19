"use client";

import { useState } from "react";
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
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { importMembersFromCsv, type MemberImportSummary } from "./csv-import-actions";

function decodeArrayBuffer(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  if (uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(uint8.slice(3));
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(uint8);
  } catch {
    return new TextDecoder("shift_jis").decode(uint8);
  }
}

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<MemberImportSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("CSVファイルを選択してください");
      return;
    }
    // Next.js Server Action のボディ上限（デフォルト1MB）を考慮。
    // 余裕を持って 900KB でガード。
    if (file.size > 900 * 1024) {
      toast.error(
        "ファイルサイズが大きすぎます（900KBまで）。CSVを分割してインポートしてください"
      );
      return;
    }
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeArrayBuffer(buffer);
      const res = await importMembersFromCsv(text);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      if (res.data.imported > 0) {
        toast.success(`${res.data.imported}名をインポートしました`);
      } else {
        toast.warning("インポートされた組合員はありません");
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "インポートに失敗しました");
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>組合員名簿 CSVインポート</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm space-y-2">
            <p className="font-medium text-blue-900">インポート手順</p>
            <ol className="list-decimal list-inside text-xs text-blue-900 space-y-1">
              <li>下のボタンからCSVテンプレートをダウンロード</li>
              <li>スプレッドシートの内容をテンプレートに合わせて整形</li>
              <li>UTF-8形式のCSVとして保存してからアップロード</li>
            </ol>
            <p className="text-xs text-blue-900">
              ※ LINE UIDは取り込み時に仮IDを自動付与します。後から公式LINE友だち追加経由で本UIDに紐付けされます。
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/templates/slp-members-template.csv" download>
                <Download className="h-4 w-4 mr-1" />
                CSVテンプレートをダウンロード
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSVファイル</label>
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
                <span className="text-sm font-medium">結果:</span>
                <Badge className="bg-green-600">{result.imported}名 インポート成功</Badge>
                {result.skipped.length > 0 && (
                  <Badge variant="secondary">{result.skipped.length}件 重複スキップ</Badge>
                )}
                {result.errors.length > 0 && (
                  <Badge variant="destructive">{result.errors.length}件 エラー</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  全{result.total}行
                </span>
              </div>

              {result.skipped.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-amber-900">
                        メールアドレス重複のためスキップされた組合員があります
                      </p>
                      <p className="text-xs text-amber-800">
                        下記のメールアドレスは既存組合員と重複しています。スタッフが手動で情報を更新してください。
                      </p>
                      <ul className="text-xs text-amber-900 space-y-0.5 mt-1">
                        {result.skipped.map((s, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-amber-600">行{s.row}:</span>
                            <span className="font-mono">{s.email || "(メール空欄)"}</span>
                            <span className="text-amber-700">— {s.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-red-900">
                        エラーのため登録できなかった行があります
                      </p>
                      <ul className="text-xs text-red-900 space-y-0.5 mt-1">
                        {result.errors.map((e, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="text-red-600">行{e.row}:</span>
                            <span>{e.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {result.imported > 0 && result.skipped.length === 0 && result.errors.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  すべての行を正常にインポートしました
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            閉じる
          </Button>
          <Button onClick={handleImport} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                インポート中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1" />
                インポート実行
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
