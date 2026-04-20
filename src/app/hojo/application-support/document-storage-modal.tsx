"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, FileText, AlertCircle, Pencil, Undo2, Share2, Loader2 } from "lucide-react";
import {
  regenerateTrainingReport,
  regenerateSupportApplication,
  regenerateBusinessPlan,
  saveBusinessPlanEdits,
  restorePreviousBusinessPlan,
  shareWithBbs,
} from "./actions";
import { BusinessPlanEditor } from "@/components/hojo/business-plan-editor";
import {
  BUSINESS_PLAN_SECTIONS,
  type BusinessPlanSectionKey,
} from "@/lib/hojo/business-plan-sections";
import { RPA_DOC_LABELS, type RpaDocKey } from "@/lib/hojo/rpa-document-config";

// docType 文字列（DB値）を RpaDocKey に変換
function docTypeValueToKey(v: string | null): RpaDocKey | null {
  if (v === "training_report") return "trainingReport";
  if (v === "support_application") return "supportApplication";
  if (v === "business_plan") return "businessPlan";
  return null;
}

// 各資料の目安時間
const ESTIMATE_BY_DOC: Record<RpaDocKey, string> = {
  trainingReport: "5〜15秒",
  supportApplication: "5〜15秒",
  businessPlan: "3〜5分",
};

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}秒経過`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}分${rem}秒経過`;
}

// 「生成中...」パネル（タブ内に表示）
function GeneratingPanel({ docKey, startedAt }: { docKey: RpaDocKey; startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
      <p className="text-base font-medium">{RPA_DOC_LABELS[docKey]}を生成中...</p>
      <p className="text-sm text-gray-500">
        {formatElapsed(elapsedMs)} / 目安 {ESTIMATE_BY_DOC[docKey]}
      </p>
      <p className="text-xs text-gray-400">この画面を閉じても裏で処理は進みます</p>
    </div>
  );
}

export type DocumentInfo = {
  docType: string;
  filePath: string;
  fileName: string;
  generatedAt: string;
  // business_plan 用
  generatedSections?: Record<string, string> | null;
  editedSections?: Record<string, string> | null;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  costUsd?: string | null;
  hasPreviousBackup?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  applicationSupportId: number;
  applicantName: string;
  documents: DocumentInfo[];
  currentSharedDate: string | null;
  runningDocType: string | null; // DB値: training_report / support_application / business_plan
  runningStartedAt: string | null; // ISO 8601
};

export function DocumentStorageModal({
  open,
  onClose,
  applicationSupportId,
  applicantName,
  documents,
  currentSharedDate,
  runningDocType,
  runningStartedAt,
}: Props) {
  const router = useRouter();
  const [generating, startGenerating] = useTransition();
  const [generatingSupport, startGeneratingSupport] = useTransition();
  const [generatingPlan, startGeneratingPlan] = useTransition();
  const [restoringPlan, startRestoringPlan] = useTransition();
  const [sharing, startSharing] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planConfirmOpen, setPlanConfirmOpen] = useState(false);

  const hasAnyDocument = documents.length > 0;

  // サーバー側生成中状態（props初期値を live stateとして保持しつつ軽量APIで更新）
  const [liveRunningDocType, setLiveRunningDocType] = useState<string | null>(runningDocType);
  const [liveRunningStartedAt, setLiveRunningStartedAt] = useState<string | null>(runningStartedAt);

  // props 更新時（別operation発火や手動reload後）に live state を同期
  useEffect(() => {
    setLiveRunningDocType(runningDocType);
    setLiveRunningStartedAt(runningStartedAt);
  }, [runningDocType, runningStartedAt]);

  const runningKey = docTypeValueToKey(liveRunningDocType);
  const isTrainingRunning = generating || runningKey === "trainingReport";
  const isSupportRunning = generatingSupport || runningKey === "supportApplication";
  const isPlanRunning = generatingPlan || runningKey === "businessPlan";

  // 生成中は5秒ごとに軽量APIで状態だけ取得（page全体のSSRを避ける）。
  // 完了検知時のみ router.refresh() で最新データ（PDF/cost/etc）を取得。
  useEffect(() => {
    if (!runningKey) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/hojo/application-support/${applicationSupportId}/running-status`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          runningDocType: string | null;
          runningStartedAt: string | null;
        };
        if (cancelled) return;
        setLiveRunningDocType(data.runningDocType);
        setLiveRunningStartedAt(data.runningStartedAt);
        if (!data.runningDocType) {
          // 完了 → 最新の documents を取得するために1回だけ refresh
          router.refresh();
        }
      } catch {
        // ネットワーク一時エラーは無視（次のtickで再試行）
      }
    };
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runningKey, applicationSupportId, router]);

  // 完了検知: runningKey が前回あって今回 null に変化したら完了トースト
  const prevRunningKeyRef = useRef<RpaDocKey | null>(runningKey);
  useEffect(() => {
    const prev = prevRunningKeyRef.current;
    if (prev && !runningKey) {
      toast.success(`${RPA_DOC_LABELS[prev]}の生成が完了しました`);
    }
    prevRunningKeyRef.current = runningKey;
  }, [runningKey]);

  const handleShare = () => {
    if (!hasAnyDocument) {
      toast.error("共有できる資料がありません。先にRPA実行で資料を生成してください");
      return;
    }
    const msg = currentSharedDate
      ? `BBS社への共有日を本日に上書きします。よろしいですか？\n（現在の共有日: ${currentSharedDate}）`
      : "BBS社に資料を共有します。BBS社側の画面に表示されるようになります。よろしいですか？";
    if (!window.confirm(msg)) return;
    startSharing(async () => {
      const result = await shareWithBbs(applicationSupportId);
      if (!result.ok) {
        toast.error(result.error ?? "共有に失敗しました");
        return;
      }
      const dateStr = result.data?.sharedAt
        ? new Date(result.data.sharedAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
        : "";
      toast.success(`BBS社に共有しました${dateStr ? `（${dateStr}）` : ""}`);
      router.refresh();
    });
  };

  const trainingReport = documents.find((d) => d.docType === "training_report");
  const supportApplication = documents.find((d) => d.docType === "support_application");
  const businessPlan = documents.find((d) => d.docType === "business_plan");

  const handleRegenerate = () => {
    setError(null);
    startGenerating(async () => {
      const result = await regenerateTrainingReport(applicationSupportId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleRegenerateSupport = () => {
    setSupportError(null);
    startGeneratingSupport(async () => {
      const result = await regenerateSupportApplication(applicationSupportId);
      if (!result.ok) {
        setSupportError(result.error);
        return;
      }
      router.refresh();
    });
  };

  // 事業計画書の生成ボタン押下 → AlertDialog を開いて確認
  const handleRegeneratePlanClick = () => {
    if (isPlanRunning) {
      toast.error("この申請者の資料生成中です。完了してからお試しください。");
      return;
    }
    if (businessPlan) {
      setPlanConfirmOpen(true);
    } else {
      // 新規生成は確認なしで即実行
      executeRegeneratePlan();
    }
  };

  const executeRegeneratePlan = () => {
    setPlanConfirmOpen(false);
    setPlanError(null);
    startGeneratingPlan(async () => {
      const result = await regenerateBusinessPlan(applicationSupportId);
      if (!result.ok) {
        setPlanError(result.error);
        return;
      }
      setEditingPlan(false);
      router.refresh();
    });
  };

  const handleSavePlanEdits = async (
    editedSections: Record<BusinessPlanSectionKey, string>,
  ): Promise<{ ok: boolean; error?: string }> => {
    const result = await saveBusinessPlanEdits(applicationSupportId, editedSections);
    if (!result.ok) return { ok: false, error: result.error };
    setEditingPlan(false);
    router.refresh();
    return { ok: true };
  };

  const handleRestorePlan = () => {
    if (
      !window.confirm(
        "直前の再生成でバックアップされた事業計画書（1世代前）に戻します。現在の内容は失われます。よろしいですか？",
      )
    ) {
      return;
    }
    setPlanError(null);
    startRestoringPlan(async () => {
      const result = await restorePreviousBusinessPlan(applicationSupportId);
      if (!result.ok) {
        setPlanError(result.error);
        return;
      }
      setEditingPlan(false);
      router.refresh();
    });
  };

  // 編集 UI 表示用：編集済みがあればそれを優先、なければ生成原文
  const planCurrentSections: Record<BusinessPlanSectionKey, string> = (() => {
    const base: Record<string, string> = { ...(businessPlan?.generatedSections ?? {}) };
    const edited = businessPlan?.editedSections ?? {};
    for (const key of Object.keys(edited)) base[key] = edited[key];
    const result: Record<string, string> = {};
    for (const def of BUSINESS_PLAN_SECTIONS) {
      result[def.key] = base[def.key] ?? "";
    }
    return result as Record<BusinessPlanSectionKey, string>;
  })();

  const formatUsd = (v: string | null | undefined) => {
    if (!v) return "-";
    const num = Number(v);
    if (isNaN(num)) return "-";
    return `$${num.toFixed(4)} ≈ ¥${Math.round(num * 150).toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="h-[85vh] flex flex-col"
        style={{ maxWidth: "calc((100vw - var(--sidebar-w, 0px)) * 0.8)" }}
      >
        <DialogHeader className="flex flex-row items-start justify-between gap-4 pr-8">
          <div className="space-y-1">
            <DialogTitle>資料保管 / {applicantName}</DialogTitle>
            <DialogDescription>
              申請者の資料（PDF）を確認・ダウンロードできます
            </DialogDescription>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Button
              size="sm"
              onClick={handleShare}
              disabled={sharing || !hasAnyDocument}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Share2 className="h-4 w-4 mr-1" />
              {sharing
                ? "共有中..."
                : currentSharedDate
                  ? "再共有（BBS社に）"
                  : "BBS社に共有確定"}
            </Button>
            {currentSharedDate && (
              <span className="text-xs text-gray-600">共有済み: {currentSharedDate}</span>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="training_report" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="training_report">研修終了報告書</TabsTrigger>
            <TabsTrigger value="support_application">支援制度申請書</TabsTrigger>
            <TabsTrigger value="business_plan">事業計画書</TabsTrigger>
          </TabsList>

          <TabsContent value="training_report" className="flex-1 flex flex-col min-h-0 mt-4">
            {isTrainingRunning ? (
              <GeneratingPanel docKey="trainingReport" startedAt={liveRunningStartedAt} />
            ) : trainingReport ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-600">
                    生成日時:{" "}
                    {new Date(trainingReport.generatedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerate}
                      disabled={isTrainingRunning || isSupportRunning || isPlanRunning}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      再生成
                    </Button>
                    <a href={trainingReport.filePath} download={trainingReport.fileName}>
                      <Button size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        ダウンロード
                      </Button>
                    </a>
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{error}</p>
                  </div>
                )}
                <iframe
                  key={trainingReport.filePath}
                  src={`${trainingReport.filePath}?t=${encodeURIComponent(trainingReport.generatedAt)}`}
                  className="flex-1 w-full border rounded"
                  title="研修終了報告書プレビュー"
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="text-sm">まだ研修終了報告書が生成されていません</p>
                <p className="text-xs">フォーム回答画面で「RPA実行」ボタンを押すと生成されます</p>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 max-w-md">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{error}</p>
                  </div>
                )}
                <Button onClick={handleRegenerate} disabled={isTrainingRunning || isSupportRunning || isPlanRunning}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  今すぐ生成
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="support_application" className="flex-1 flex flex-col min-h-0 mt-4">
            {isSupportRunning ? (
              <GeneratingPanel docKey="supportApplication" startedAt={liveRunningStartedAt} />
            ) : supportApplication ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-gray-600">
                    生成日時:{" "}
                    {new Date(supportApplication.generatedAt).toLocaleString("ja-JP", {
                      timeZone: "Asia/Tokyo",
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegenerateSupport}
                      disabled={isTrainingRunning || isSupportRunning || isPlanRunning}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      再生成
                    </Button>
                    <a
                      href={supportApplication.filePath}
                      download={supportApplication.fileName}
                    >
                      <Button size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        ダウンロード
                      </Button>
                    </a>
                  </div>
                </div>
                {supportError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{supportError}</p>
                  </div>
                )}
                <iframe
                  key={supportApplication.filePath}
                  src={`${supportApplication.filePath}?t=${encodeURIComponent(supportApplication.generatedAt)}`}
                  className="flex-1 w-full border rounded"
                  title="支援制度申請書プレビュー"
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="text-sm">まだ支援制度申請書が生成されていません</p>
                <p className="text-xs">フォーム回答画面で「RPA実行」ボタンを押すと生成されます</p>
                {supportError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 max-w-md">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{supportError}</p>
                  </div>
                )}
                <Button onClick={handleRegenerateSupport} disabled={isTrainingRunning || isSupportRunning || isPlanRunning}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  今すぐ生成
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="business_plan" className="flex-1 flex flex-col min-h-0 mt-4">
            {isPlanRunning ? (
              <GeneratingPanel docKey="businessPlan" startedAt={liveRunningStartedAt} />
            ) : businessPlan ? (
              editingPlan ? (
                <BusinessPlanEditor
                  initialSections={planCurrentSections}
                  onSave={handleSavePlanEdits}
                  onCancel={() => setEditingPlan(false)}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>
                        生成日時:{" "}
                        {new Date(businessPlan.generatedAt).toLocaleString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                        })}
                        {businessPlan.modelName && <span className="ml-2">（{businessPlan.modelName}）</span>}
                      </div>
                      <div>
                        トークン: 入 {(businessPlan.inputTokens ?? 0).toLocaleString()} / 出{" "}
                        {(businessPlan.outputTokens ?? 0).toLocaleString()}
                        {businessPlan.cacheReadTokens ? (
                          <span>（キャッシュ読 {businessPlan.cacheReadTokens.toLocaleString()}）</span>
                        ) : null}
                      </div>
                      <div>料金: {formatUsd(businessPlan.costUsd)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {businessPlan.hasPreviousBackup && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRestorePlan}
                          disabled={restoringPlan}
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          {restoringPlan ? "復元中..." : "以前の編集を復元"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingPlan(true)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        編集
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRegeneratePlanClick}
                        disabled={isTrainingRunning || isSupportRunning || isPlanRunning}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        再生成(Claude)
                      </Button>
                      <a href={businessPlan.filePath} download={businessPlan.fileName}>
                        <Button size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          ダウンロード
                        </Button>
                      </a>
                    </div>
                  </div>
                  {planError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800">{planError}</p>
                    </div>
                  )}
                  <iframe
                    key={businessPlan.filePath}
                    src={`${businessPlan.filePath}?t=${encodeURIComponent(businessPlan.generatedAt)}`}
                    className="flex-1 w-full border rounded"
                    title="事業計画書プレビュー"
                  />
                </>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
                <FileText className="h-12 w-12 text-gray-300" />
                <p className="text-sm">まだ事業計画書が生成されていません</p>
                <p className="text-xs">フォーム回答画面で「RPA実行」ボタンを押すと生成されます（Claude API 使用・料金目安 $0.35〜$0.50）</p>
                {planError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2 max-w-md">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{planError}</p>
                  </div>
                )}
                <Button onClick={handleRegeneratePlanClick} disabled={isTrainingRunning || isSupportRunning || isPlanRunning}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  今すぐ生成
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      {/* 事業計画書 再生成 確認ダイアログ */}
      <AlertDialog open={planConfirmOpen} onOpenChange={setPlanConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>事業計画書の再生成</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>Claude API を呼び直して事業計画書を再生成します。</p>
                <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                  <div><span className="font-semibold">料金:</span> 約 $0.35〜$0.50</div>
                  <div><span className="font-semibold">所要時間:</span> 3〜5分（Claude API）</div>
                  <div><span className="font-semibold">編集内容:</span> リセットされます（以前の編集は1世代のみバックアップ）</div>
                </div>
                <p className="text-gray-600">続行しますか？</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={executeRegeneratePlan}>続行</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
