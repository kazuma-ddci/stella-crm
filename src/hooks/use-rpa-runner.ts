"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { RPA_DOC_LABELS, type RpaDocKey } from "@/lib/hojo/rpa-document-config";
import type { RpaSelection } from "@/components/hojo/rpa-run-confirmation-dialog";
import type { useFormSubmissionEditor } from "@/hooks/use-form-submission-editor";

type Editor = ReturnType<typeof useFormSubmissionEditor>;

type Options = {
  notLinkedMessage?: string;
  /** 紐付けの有無を判定するためのコールバック。true を返すと実行できる */
  canRun: () => boolean;
};

/**
 * edit-client と form-answer-edit-modal で共通の RPA 実行フロー:
 * 1. 紐付けチェック
 * 2. 未保存編集があれば自動保存
 * 3. 確認ダイアログを開く（呼び出し側で `dialogOpen` state と `setDialogOpen` を使う）
 * 4. 「はい」が押されたら `runRpa` を実行、トースト表示、warnings も通知
 */
export function useRpaRunner(editor: Editor, options: Options) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { canRun, notLinkedMessage = "申請者レコードの紐付けが必要です" } = options;

  const openDialog = useCallback(async () => {
    if (!canRun()) {
      toast.error(notLinkedMessage);
      return;
    }
    if (editor.hasChanges) {
      const saveResult = await editor.save();
      if (!saveResult.ok) {
        toast.error(saveResult.error ?? "保存に失敗しました");
        return;
      }
    }
    setDialogOpen(true);
  }, [canRun, notLinkedMessage, editor]);

  const confirmRun = useCallback(
    async (selected: RpaSelection) => {
      setDialogOpen(false);
      const toastId = toast.loading("RPAを実行しています（数分かかる場合があります）");
      const result = await editor.runRpa(selected);
      if (!result.ok) {
        toast.error(result.error ?? "RPA実行に失敗しました", { id: toastId });
        return;
      }
      const parts: string[] = [];
      (Object.keys(selected) as RpaDocKey[]).forEach((k) => {
        if (!selected[k]) return;
        const r = result.results?.[k];
        parts.push(`${RPA_DOC_LABELS[k]}${r === "ok" ? "✓" : "×"}`);
      });
      toast.success(`資料生成が完了しました: ${parts.join(" / ")}`, { id: toastId });

      // Server Action から warnings が返されていれば警告トーストも出す
      for (const warning of result.warnings ?? []) {
        toast.warning(warning, { duration: 8000 });
      }
    },
    [editor],
  );

  return { dialogOpen, setDialogOpen, openDialog, confirmRun };
}
