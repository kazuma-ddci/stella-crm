"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { confirmTransaction, unconfirmTransaction, deleteTransaction } from "./actions";

type TransactionStatusActionsProps = {
  transactionId: number;
  status: string;
  invoiceGroupId?: number | null;
  paymentGroupId?: number | null;
};

export function TransactionStatusActions({
  transactionId,
  status,
  invoiceGroupId,
  paymentGroupId,
}: TransactionStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLinked = !!(invoiceGroupId || paymentGroupId);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmTransaction(transactionId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleUnconfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await unconfirmTransaction(transactionId);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteTransaction(transactionId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  return (
    <div className="flex items-center gap-1">
      {error && (
        <span className="text-xs text-red-600 mr-1">{error}</span>
      )}

      {/* 取引確定ボタン: unconfirmed → confirmed */}
      {status === "unconfirmed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              取引確定
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>取引を確定しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                取引の内容が正しいことを確認し、ステータスを「取引確定」に変更します。
                確定後は請求/支払に紐づけ可能になります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                確定する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 確定取消ボタン: confirmed かつ未紐づけ */}
      {status === "confirmed" && !isLinked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              確定取消
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定を取り消しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                取引のステータスを「未確定」に戻します。
                取引内容の編集が再び可能になります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnconfirm} disabled={isPending}>
                確定を取り消す
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 削除ボタン: 紐づけなしの場合のみ */}
      {!isLinked && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={isPending}
            >
              削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>取引を削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                取引を削除します（論理削除）。削除済みの取引は「削除済み」タブから確認できます。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
