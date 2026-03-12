"use client";

import { useTransition } from "react";
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
import { confirmTransaction } from "@/app/accounting/transactions/actions";
import { toast } from "sonner";

type Props = {
  transactionId: number;
  hasExpenseCategory?: boolean;
};

export function TransactionConfirmButton({ transactionId, hasExpenseCategory = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = async () => {
    if (!hasExpenseCategory) {
      toast.error("費目が未設定の取引は確定できません。先に費目を設定してください。");
      return;
    }
    try {
      await confirmTransaction(transactionId);
      toast.success("取引を確定しました");
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "取引確定に失敗しました");
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={isPending}>
          取引確定
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>取引を確定しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            取引 #{transactionId} を「取引確定」に変更します。確定後は編集できなくなります。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            取引確定
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
