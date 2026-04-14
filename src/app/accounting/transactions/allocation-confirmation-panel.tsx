"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  getAllocationStatus,
  confirmAllocation,
  type AllocationStatusResult,
} from "@/app/finance/transactions/allocation-actions";

type AllocationConfirmationPanelProps = {
  transactionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AllocationConfirmationPanel({
  transactionId,
  open,
  onOpenChange,
}: AllocationConfirmationPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<AllocationStatusResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    costCenterId: number;
    costCenterName: string;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAllocationStatus(transactionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStatus(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open, loadStatus]);

  const handleConfirm = (costCenterId: number) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await confirmAllocation(transactionId, costCenterId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        await loadStatus();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setConfirmTarget(null);
      }
    });
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>按分確定状況</DialogTitle>
          </DialogHeader>

          {loading && (
            <p className="text-sm text-muted-foreground py-4">読み込み中...</p>
          )}

          {error && <p className="text-sm text-red-600 py-2">{error}</p>}

          {status && (
            <div className="space-y-4">
              {/* サマリー */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  税込金額: ¥{status.amountIncludingTax.toLocaleString()}
                </span>
                <Badge
                  variant="outline"
                  className={
                    status.isFullyConfirmed
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-yellow-100 text-yellow-800 border-yellow-200"
                  }
                >
                  {status.confirmed}/{status.totalRequired} 確定
                </Badge>
              </div>

              {/* 按分先一覧 */}
              <div className="divide-y border rounded-lg">
                {status.confirmations.map((conf) => (
                  <div
                    key={conf.costCenterId}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {conf.costCenterName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({conf.allocationRate}%)
                        </span>
                      </div>
                      <div className="text-sm">
                        ¥{conf.allocatedAmount.toLocaleString()}
                      </div>
                      {conf.status === "confirmed" && conf.confirmedBy && (
                        <div className="text-xs text-muted-foreground">
                          確定: {conf.confirmedBy.name}
                          {conf.confirmedAt && (
                            <>
                              {" "}
                              (
                              {new Date(conf.confirmedAt).toLocaleDateString(
                                "ja-JP"
                              )}
                              )
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      {conf.status === "confirmed" ? (
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 border-green-200"
                        >
                          確定済み
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            setConfirmTarget({
                              costCenterId: conf.costCenterId,
                              costCenterName: conf.costCenterName,
                            })
                          }
                        >
                          確定する
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {status.isFullyConfirmed && (
                <p className="text-sm text-green-700">
                  全ての按分先が確定されました。
                  {status.transactionStatus === "confirmed" &&
                    "取引は自動的に「経理処理待ち」に移行します。"}
                  {status.transactionStatus === "awaiting_accounting" &&
                    "経理処理待ちに移行済みです。"}
                  {status.transactionStatus === "journalized" &&
                    "仕訳済みです。"}
                </p>
              )}
            </div>
          )}

          {!loading && !status && !error && (
            <p className="text-sm text-muted-foreground py-4">
              この取引には按分テンプレートが設定されていません。
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* 確定確認ダイアログ */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>按分を確定しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{confirmTarget?.costCenterName}」の按分を確定します。
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                confirmTarget && handleConfirm(confirmTarget.costCenterId)
              }
              disabled={isPending}
            >
              確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 按分確定ボタン（取引テーブルの操作列用）
export function AllocationStatusButton({
  transactionId,
  hasAllocationTemplate,
}: {
  transactionId: number;
  hasAllocationTemplate: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!hasAllocationTemplate) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-indigo-600 hover:text-indigo-800"
        onClick={() => setOpen(true)}
      >
        按分
      </Button>
      <AllocationConfirmationPanel
        transactionId={transactionId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
