"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
} from "@/components/ui/alert-dialog";
import { deleteContactHistoryV2 } from "../actions";

export function DeleteContactHistoryButton({ id }: { id: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await deleteContactHistoryV2(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("削除しました");
      setOpen(false);
      router.push("/hojo/records/contact-histories-v2");
      router.refresh();
    });
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} disabled={pending}>
        削除
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接触履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この接触履歴は一覧から見えなくなります（論理削除）。
              関連する参加者・会議情報・添付ファイルも一緒に非表示になります。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
