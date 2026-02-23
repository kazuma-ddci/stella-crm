"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  confirmTransaction,
  returnTransaction,
  resubmitTransaction,
  hideTransaction,
} from "./actions";

const returnReasonLabels: Record<string, string> = {
  question: "質問",
  correction_request: "修正依頼",
  approval_check: "承認確認",
  other: "その他",
};

type TransactionStatusActionsProps = {
  transactionId: number;
  status: string;
};

export function TransactionStatusActions({
  transactionId,
  status,
}: TransactionStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 差し戻しダイアログ
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnBody, setReturnBody] = useState("");
  const [returnReasonType, setReturnReasonType] = useState("");

  // 再提出ダイアログ
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [resubmitBody, setResubmitBody] = useState("");

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await confirmTransaction(transactionId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  const handleReturn = () => {
    setError(null);
    startTransition(async () => {
      try {
        await returnTransaction(transactionId, {
          body: returnBody,
          returnReasonType,
        });
        setReturnOpen(false);
        setReturnBody("");
        setReturnReasonType("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  const handleResubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await resubmitTransaction(transactionId, resubmitBody || undefined);
        setResubmitOpen(false);
        setResubmitBody("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      }
    });
  };

  const handleHide = () => {
    setError(null);
    startTransition(async () => {
      try {
        await hideTransaction(transactionId);
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

      {/* 確認ボタン: unconfirmed → confirmed */}
      {status === "unconfirmed" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              確認
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>取引を確認しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                取引の内容が正しいことを確認し、ステータスを「確認済み」に変更します。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
                確認する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* 差し戻しボタン: confirmed/awaiting_accounting → returned */}
      {(status === "confirmed" || status === "awaiting_accounting") && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => setReturnOpen(true)}
            disabled={isPending}
          >
            差し戻し
          </Button>
          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>取引の差し戻し</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>差し戻し理由 *</Label>
                  <Select
                    value={returnReasonType}
                    onValueChange={setReturnReasonType}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="理由を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(returnReasonLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>コメント *</Label>
                  <Textarea
                    className="mt-1"
                    value={returnBody}
                    onChange={(e) => setReturnBody(e.target.value)}
                    placeholder="差し戻しの理由を入力してください"
                    rows={3}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setReturnOpen(false)}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReturn}
                  disabled={isPending || !returnBody.trim() || !returnReasonType}
                >
                  差し戻す
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* 再提出ボタン: returned → resubmitted */}
      {status === "returned" && (
        <>
          <Button
            variant="outline"
            size="sm"
            className="text-yellow-700 border-yellow-200 hover:bg-yellow-50"
            onClick={() => setResubmitOpen(true)}
            disabled={isPending}
          >
            再提出
          </Button>
          <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>取引の再提出</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>コメント（任意）</Label>
                  <Textarea
                    className="mt-1"
                    value={resubmitBody}
                    onChange={(e) => setResubmitBody(e.target.value)}
                    placeholder="修正内容や対応内容を記載してください"
                    rows={3}
                  />
                </div>
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setResubmitOpen(false)}
                  disabled={isPending}
                >
                  キャンセル
                </Button>
                <Button
                  onClick={handleResubmit}
                  disabled={isPending}
                >
                  再提出する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* 非表示ボタン: paid → hidden */}
      {status === "paid" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500 hover:text-gray-700"
              disabled={isPending}
            >
              非表示
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>取引を非表示にしますか？</AlertDialogTitle>
              <AlertDialogDescription>
                入金/支払完了済みの取引を非表示にします。データは削除されません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleHide} disabled={isPending}>
                非表示にする
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
