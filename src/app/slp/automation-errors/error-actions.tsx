"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { retryAutomationError, resolveError } from "./actions";
import { RefreshCw, CheckCircle } from "lucide-react";

const retryLabels: Record<string, string> = {
  "proline-form-submit": "プロライン送信をもう一度実行",
  "cloudsign-send": "契約書送付をもう一度実行",
  "form6-briefing-reservation": "予約通知をもう一度実行",
  "form7-briefing-change": "変更通知をもう一度実行",
  "form9-briefing-cancel": "キャンセル通知をもう一度実行",
  "form10-briefing-complete": "完了通知をもう一度実行",
  "form11-briefing-thank-you": "お礼メッセージをもう一度実行",
  "form12-contract-reminder": "契約書リマインドLINEをもう一度実行",
};

interface ErrorActionsProps {
  errorId: number;
  retryAction: string | null;
  resolved: boolean;
}

export function ErrorActions({
  errorId,
  retryAction,
  resolved,
}: ErrorActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (resolved) return null;

  const handleRetry = () => {
    startTransition(async () => {
      const res = await retryAutomationError(errorId);
      setResult(res);
    });
  };

  const handleResolve = () => {
    startTransition(async () => {
      const res = await resolveError(errorId);
      setResult(res);
    });
  };

  if (result?.success) {
    return (
      <p className="text-xs text-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {result.message}
      </p>
    );
  }

  const retryLabel = retryAction ? retryLabels[retryAction] : null;

  return (
    <div className="flex items-center gap-2 mt-2">
      {retryLabel && (
        <Button
          size="sm"
          variant="outline"
          onClick={handleRetry}
          disabled={isPending}
        >
          <RefreshCw
            className={`h-3 w-3 mr-1 ${isPending ? "animate-spin" : ""}`}
          />
          {isPending ? "実行中..." : retryLabel}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleResolve}
        disabled={isPending}
      >
        解決済みにする
      </Button>
      {result && !result.success && (
        <span className="text-xs text-red-600">{result.message}</span>
      )}
    </div>
  );
}
