"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Lock, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { closeMonthAction, reopenMonthAction } from "./actions";

type CloseInfo = {
  id: number;
  closedAt: string;
  closedByName: string;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
};

type MonthData = {
  month: string;
  revenue: number;
  expense: number;
  grossProfit: number;
  isClosed: boolean;
  isReopened: boolean;
  closeInfo: CloseInfo | null;
};

type Props = {
  monthData: MonthData[];
};

export function MonthlyCloseControls({ monthData }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [reopenDialog, setReopenDialog] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const handleClose = async (month: string) => {
    setLoading(month);
    try {
      await closeMonthAction(`${month}-01`, 1);
      router.refresh();
    } catch {
      alert("締め処理に失敗しました");
    } finally {
      setLoading(null);
      setConfirmClose(null);
    }
  };

  const handleReopen = async (month: string) => {
    if (!reopenReason.trim()) {
      alert("再オープンの理由を入力してください");
      return;
    }

    setLoading(month);
    try {
      await reopenMonthAction(`${month}-01`, 1, reopenReason.trim());
      router.refresh();
    } catch {
      alert("再オープンに失敗しました");
    } finally {
      setLoading(null);
      setReopenDialog(null);
      setReopenReason("");
    }
  };

  const getStatusLabel = (data: MonthData) => {
    if (data.isClosed) return "締め済み";
    if (data.isReopened) return "再オープン済み";
    return "オープン";
  };

  const getStatusColor = (data: MonthData) => {
    if (data.isClosed) return "text-green-700";
    if (data.isReopened) return "text-orange-600";
    return "text-gray-500";
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monthData.map((data) => (
          <Card
            key={data.month}
            className={data.isClosed ? "border-green-200 bg-green-50/50" : ""}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">{data.month}</h3>
                <div className="flex items-center gap-1.5">
                  {data.isClosed ? (
                    <Lock className="h-4 w-4 text-green-600" />
                  ) : (
                    <Unlock className="h-4 w-4 text-gray-400" />
                  )}
                  <span className={`text-sm font-medium ${getStatusColor(data)}`}>
                    {getStatusLabel(data)}
                  </span>
                </div>
              </div>

              <div className="space-y-1 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">売上</span>
                  <span className="font-medium">
                    ¥{data.revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">経費</span>
                  <span className="font-medium">
                    ¥{data.expense.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">粗利</span>
                  <span
                    className={`font-bold ${
                      data.grossProfit >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ¥{data.grossProfit.toLocaleString()}
                  </span>
                </div>
              </div>

              {data.closeInfo && (
                <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                  <div>
                    締め: {new Date(data.closeInfo.closedAt).toLocaleString("ja-JP")} ({data.closeInfo.closedByName})
                  </div>
                  {data.closeInfo.reopenedAt && (
                    <div>
                      再オープン:{" "}
                      {new Date(data.closeInfo.reopenedAt).toLocaleString("ja-JP")} ({data.closeInfo.reopenedByName})
                      {data.closeInfo.reopenReason && (
                        <span className="block ml-2">
                          理由: {data.closeInfo.reopenReason}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                {!data.isClosed ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => setConfirmClose(data.month)}
                    disabled={loading === data.month}
                  >
                    {loading === data.month ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "締め実行"
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setReopenDialog(data.month);
                      setReopenReason("");
                    }}
                    disabled={loading === data.month}
                  >
                    {loading === data.month ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "再オープン"
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Close confirmation dialog */}
      <Dialog
        open={confirmClose !== null}
        onOpenChange={(o) => !o && setConfirmClose(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月次締め確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            <strong>{confirmClose}</strong>{" "}
            を締め処理します。締め済みの月はデータの変更が制限されます。
          </p>
          <p className="text-sm text-muted-foreground">
            必要に応じて後から再オープンすることも可能です。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => confirmClose && handleClose(confirmClose)}
              disabled={loading !== null}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              締め実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen reason dialog */}
      <Dialog
        open={reopenDialog !== null}
        onOpenChange={(o) => {
          if (!o) {
            setReopenDialog(null);
            setReopenReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>再オープン - {reopenDialog}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              再オープンの理由を入力してください。
            </p>
            <Textarea
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="再オープンの理由..."
              className="min-h-[100px]"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReopenDialog(null);
                setReopenReason("");
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={() => reopenDialog && handleReopen(reopenDialog)}
              disabled={loading !== null || !reopenReason.trim()}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              再オープン
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
