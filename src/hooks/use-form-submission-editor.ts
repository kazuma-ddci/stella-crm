"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
// 注: RPA実行は useTransition を使わない。長時間実行中 pending transition は
// Next.js の <Link>/router.push を保留するため、画面遷移が止まって見える。
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ModifiedAnswers } from "@/components/hojo/form-answer-editor";
import {
  confirmSubmission,
  linkSubmissionToApplicationSupport,
  saveDraftAnswers,
} from "@/app/hojo/form-submissions/[id]/actions";

type Options = {
  submissionId: number;
  linkedApplicationSupportId: number | null;
  initialModifiedAnswers: ModifiedAnswers;
};

export type RpaSelectedDocs = {
  trainingReport: boolean;
  supportApplication: boolean;
  businessPlan: boolean;
};

export type RpaResult = {
  ok: boolean;
  error?: string;
  results?: Record<keyof RpaSelectedDocs, "ok" | "failed" | "skipped">;
  warnings?: string[];
};

/**
 * 初期値と現在値の差分を検出。値が空文字でも初期値に無ければ差分として扱うと
 * 「追加→削除で初期状態に戻した」場合に再び disabled にならない。
 * 両方のキーを集めて「空文字 = 未入力」と見なす厳密比較を行う。
 */
function computeHasChanges(
  initial: ModifiedAnswers,
  current: ModifiedAnswers,
): boolean {
  const paths = new Set<string>([...Object.keys(initial), ...Object.keys(current)]);
  for (const path of paths) {
    const a = initial[path] ?? {};
    const b = current[path] ?? {};
    const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const av = a[k] ?? "";
      const bv = b[k] ?? "";
      if (av !== bv) return true;
    }
  }
  return false;
}

export function useFormSubmissionEditor({
  submissionId,
  linkedApplicationSupportId,
  initialModifiedAnswers,
}: Options) {
  const router = useRouter();
  const [modifiedAnswers, setModifiedAnswers] = useState<ModifiedAnswers>(initialModifiedAnswers);
  const [saving, startSave] = useTransition();
  const [linking, startLink] = useTransition();
  const [running, setRunning] = useState(false);

  const hasChanges = useMemo(
    () => computeHasChanges(initialModifiedAnswers, modifiedAnswers),
    [initialModifiedAnswers, modifiedAnswers],
  );

  const handleChange = useCallback((path: string, key: string, value: string) => {
    setModifiedAnswers((prev) => {
      if ((prev[path]?.[key] ?? "") === value) return prev;
      const next: ModifiedAnswers = { ...prev };
      next[path] = { ...(next[path] ?? {}), [key]: value };
      return next;
    });
  }, []);

  const save = useCallback(
    async (): Promise<{ ok: boolean; error?: string }> => {
      return new Promise((resolve) => {
        startSave(async () => {
          const result = await saveDraftAnswers(submissionId, modifiedAnswers);
          if (!result.ok) {
            resolve({ ok: false, error: result.error });
            return;
          }
          router.refresh();
          resolve({ ok: true });
        });
      });
    },
    [submissionId, modifiedAnswers, router],
  );

  const link = useCallback(
    (applicationSupportId: number, onSuccess?: () => void) => {
      startLink(async () => {
        const result = await linkSubmissionToApplicationSupport(submissionId, applicationSupportId);
        if (!result.ok) {
          toast.error(result.error ?? "紐付けに失敗しました");
          return;
        }
        router.refresh();
        onSuccess?.();
      });
    },
    [submissionId, router],
  );

  /**
   * RPA を実行する。未保存編集があれば自動保存してから呼ぶこと（呼び出し側で制御）。
   * useTransition は使わない（pending transition が画面遷移を保留するため）。
   */
  const runRpa = useCallback(
    async (selectedDocs: RpaSelectedDocs): Promise<RpaResult> => {
      if (!linkedApplicationSupportId) {
        return { ok: false, error: "申請者レコードの紐付けが必要です" };
      }
      setRunning(true);
      try {
        const result = await confirmSubmission(submissionId, undefined, selectedDocs);
        if (!result.ok) return { ok: false, error: result.error };
        router.refresh();
        return {
          ok: true,
          results: result.data?.results,
          warnings: result.data?.warnings,
        };
      } finally {
        setRunning(false);
      }
    },
    [submissionId, linkedApplicationSupportId, router],
  );

  return {
    modifiedAnswers,
    hasChanges,
    saving,
    linking,
    running,
    handleChange,
    save,
    link,
    runRpa,
  };
}
