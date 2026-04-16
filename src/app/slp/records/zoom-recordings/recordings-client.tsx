"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Sparkles, Copy, CheckCircle2 } from "lucide-react";

export type RecordingRow = {
  id: number;
  category: "briefing" | "consultation";
  companyName: string | null;
  contactDate: string | null;
  hostName: string | null;
  hasMp4: boolean;
  hasTranscript: boolean;
  aiCompanionSummary: string | null;
  claudeSummary: string | null;
  claudeSummaryGeneratedAt: string | null;
  claudeSummaryModel: string | null;
  downloadStatus: string;
  companyRecordId: number | null;
  prolineUid: string | null;
};

export function RecordingsClient({ rows }: { rows: RecordingRow[] }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [currentSummary, setCurrentSummary] = useState<{
    recordingId: number;
    claude: string | null;
    aiCompanion: string | null;
  } | null>(null);
  const [thankYou, setThankYou] = useState<{
    recordingId: number;
    suggested: string;
    editing: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleRegenerate = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${row.id}/regenerate-summary`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        toast.success("Claude要約を再生成しました");
        setCurrentSummary({
          recordingId: row.id,
          claude: data.summary,
          aiCompanion: row.aiCompanionSummary,
        });
      } else {
        toast.error(`失敗: ${data.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setBusyId(null);
    }
  };

  const handleThankYou = async (row: RecordingRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch(
        `/api/slp/zoom-recordings/${row.id}/thankyou-suggest`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.ok) {
        setThankYou({
          recordingId: row.id,
          suggested: data.text,
          editing: data.text,
        });
      } else {
        toast.error(`失敗: ${data.message}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "予期しないエラー");
    } finally {
      setBusyId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("コピーに失敗しました");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">日時</th>
              <th className="text-left p-3">種別</th>
              <th className="text-left p-3">事業者名</th>
              <th className="text-left p-3">担当</th>
              <th className="text-left p-3">DL</th>
              <th className="text-left p-3">要約</th>
              <th className="text-left p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-center text-muted-foreground">
                  録画データはまだありません
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.contactDate ?? "—"}</td>
                <td className="p-3">
                  {r.category === "briefing" ? "概要案内" : "導入希望商談"}
                </td>
                <td className="p-3">{r.companyName ?? "—"}</td>
                <td className="p-3">{r.hostName ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={
                      r.downloadStatus === "completed"
                        ? "text-green-700"
                        : r.downloadStatus === "failed"
                        ? "text-red-700"
                        : "text-muted-foreground"
                    }
                  >
                    {r.downloadStatus}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-col gap-1 text-xs">
                    {r.aiCompanionSummary && (
                      <span className="text-blue-700">Zoom AI要約: あり</span>
                    )}
                    {r.claudeSummary && (
                      <span className="text-purple-700">
                        Claude要約: あり{r.claudeSummaryGeneratedAt && ` (${r.claudeSummaryGeneratedAt})`}
                      </span>
                    )}
                    {!r.aiCompanionSummary && !r.claudeSummary && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-2 flex-wrap">
                    {(r.aiCompanionSummary || r.claudeSummary) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setCurrentSummary({
                            recordingId: r.id,
                            claude: r.claudeSummary,
                            aiCompanion: r.aiCompanionSummary,
                          })
                        }
                      >
                        要約を見る
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerate(r)}
                      disabled={busyId === r.id || !r.hasTranscript}
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3 mr-1" />
                      )}
                      Claude生成
                    </Button>
                    {r.prolineUid && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleThankYou(r)}
                        disabled={busyId === r.id}
                      >
                        お礼文案
                      </Button>
                    )}
                    {r.companyRecordId ? (
                      <a
                        href={`/slp/companies/${r.companyRecordId}`}
                        className="text-xs text-blue-600 underline self-center"
                      >
                        事業者へ
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground self-center">
                        （事業者削除済）
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 要約ビューダイアログ */}
      <Dialog open={!!currentSummary} onOpenChange={(o) => !o && setCurrentSummary(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>商談要約</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {currentSummary?.claude && (
              <div>
                <div className="text-sm font-semibold mb-1 text-purple-800">Claude要約</div>
                <div className="whitespace-pre-wrap text-sm bg-purple-50 border rounded-md p-3">
                  {currentSummary.claude}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => handleCopy(currentSummary.claude!)}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copied ? "コピー済" : "コピー"}
                </Button>
              </div>
            )}
            {currentSummary?.aiCompanion && (
              <div>
                <div className="text-sm font-semibold mb-1 text-blue-800">Zoom AI Companion 要約</div>
                <div className="whitespace-pre-wrap text-sm bg-blue-50 border rounded-md p-3">
                  {currentSummary.aiCompanion}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurrentSummary(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* お礼文案ダイアログ */}
      <Dialog open={!!thankYou} onOpenChange={(o) => !o && setThankYou(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>お礼メッセージ文案</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              AIが生成した下書きです。必要に応じて編集してから、コピーしてお客様のLINEへ送付してください。
            </p>
            <textarea
              className="w-full h-40 rounded-md border p-2 text-sm"
              value={thankYou?.editing ?? ""}
              onChange={(e) =>
                setThankYou((prev) => (prev ? { ...prev, editing: e.target.value } : prev))
              }
            />
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => thankYou && handleCopy(thankYou.editing)}
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" /> コピー済
                  </>
                ) : (
                  "クリップボードにコピー"
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                （送信はプロライン画面から手動で行ってください）
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThankYou(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
