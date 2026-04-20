"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Unlock, Lock } from "lucide-react";
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
import { enableTodayOverride, disableTodayOverride } from "./actions";

type Props = {
  dailyUsageYen: number;
  dailyUsageUsd: number;
  limitYen: number;
  overridden: boolean;
  overriddenAt: string | null;
  overriddenByName: string | null;
};

export function ApiUsageClient({
  dailyUsageYen,
  dailyUsageUsd,
  limitYen,
  overridden,
  overriddenAt,
  overriddenByName,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enableOpen, setEnableOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [reason, setReason] = useState("");

  const atLimit = dailyUsageYen >= limitYen;
  const percent = Math.min(100, Math.round((dailyUsageYen / limitYen) * 100));

  const handleEnable = () => {
    setEnableOpen(false);
    start(async () => {
      const result = await enableTodayOverride(reason.trim() || undefined);
      if (!result.ok) {
        toast.error(result.error ?? "解除に失敗しました");
        return;
      }
      toast.success("本日の上限を解除しました");
      setReason("");
      router.refresh();
    });
  };

  const handleDisable = () => {
    setDisableOpen(false);
    start(async () => {
      const result = await disableTodayOverride();
      if (!result.ok) {
        toast.error(result.error ?? "取消に失敗しました");
        return;
      }
      toast.success("解除を取り消しました");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">本日のAPI費用</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-bold">
                ¥{dailyUsageYen.toLocaleString()}
                <span className="text-sm font-normal text-gray-500 ml-2">
                  / ¥{limitYen.toLocaleString()}
                </span>
              </span>
              <span className="text-xs text-gray-500">
                ≈ ${dailyUsageUsd.toFixed(4)} USD（レート: 1USD = 150円 概算）
              </span>
            </div>
            <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  atLimit ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{percent}% 使用</div>
          </div>

          {overridden ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3">
              <Unlock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-semibold text-amber-900">本日の上限解除中</div>
                <div className="text-amber-800 text-xs mt-1">
                  {overriddenAt && (
                    <>
                      解除日時:{" "}
                      {new Date(overriddenAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </>
                  )}
                  {overriddenByName && <> / 実行者: {overriddenByName}</>}
                </div>
                <div className="text-amber-700 text-xs mt-2">
                  翌日（JST 0時）になると自動的に上限が再び有効になります。
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisableOpen(true)}
                disabled={pending}
              >
                <Lock className="h-4 w-4 mr-1" />
                解除を取消
              </Button>
            </div>
          ) : atLimit ? (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-semibold text-red-900">本日の上限に達しました</div>
                <div className="text-red-800 text-xs mt-1">
                  事業計画書（Claude API）の生成が停止されています。
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setEnableOpen(true)}
                disabled={pending}
                className="bg-red-600 hover:bg-red-700"
              >
                <Unlock className="h-4 w-4 mr-1" />
                本日の上限を解除
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded p-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-green-800">
                本日の費用は上限内です。引き続き事業計画書を生成できます。
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">仕様メモ</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>• 対象: 事業計画書（Claude API）のみ。研修終了報告書・支援制度申請書は料金がかからないため本上限の影響を受けません。</p>
          <p>• 合算期間: JST の 0:00〜24:00 に生成された書類の <code className="bg-gray-100 px-1 rounded">costUsd</code> を円換算で合計。</p>
          <p>• 上限解除: 押下すると当日のみ上限がスキップされます。翌日 0時に自動的に再有効化されます。</p>
          <p>• 為替レート: 1USD = 150円の固定値で概算。Anthropic への実際の請求額とは若干ズレる可能性があります。</p>
          <p>• 最終防衛線: Anthropic Console の <strong>Usage limits</strong> でも月次上限を設定してください。アプリ側の上限と二重になります。</p>
        </CardContent>
      </Card>

      {/* 解除確認ダイアログ */}
      <AlertDialog open={enableOpen} onOpenChange={setEnableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本日の上限を解除</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>本日中は事業計画書の生成が上限¥{limitYen.toLocaleString()}を超えても継続できるようになります。翌日 0時に自動的に上限が再有効化されます。</p>
                <div className="space-y-1">
                  <Label className="text-xs">解除理由（任意）</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="例: 大量申請者対応のため"
                    rows={3}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnable}>解除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 取消確認ダイアログ */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解除を取り消しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              上限が再び有効になります。本日の費用が既に¥{limitYen.toLocaleString()}を超えている場合、事業計画書の生成は停止されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisable}>取消</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
