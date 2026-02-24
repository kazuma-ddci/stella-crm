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
};

export function TransactionConfirmButton({ transactionId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConfirm = async () => {
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
