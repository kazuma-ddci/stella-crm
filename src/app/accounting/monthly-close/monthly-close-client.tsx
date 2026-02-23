"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Lock, LockOpen, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { closeMonthAction, reopenMonthAction } from "./actions";
import type { MonthlyCloseStatusRow, MonthlyCloseLogRow } from "./actions";

type Props = {
  statuses: MonthlyCloseStatusRow[];
  history: MonthlyCloseLogRow[];
};

export function MonthlyCloseClient({ statuses, history }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);
  const [reopenDialog, setReopenDialog] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState("");

  const closedCount = statuses.filter((s) => s.isClosed).length;
  const openCount = statuses.filter((s) => !s.isClosed).length;

  const handleClose = async (month: string) => {
    setLoading(month);
    try {
      await closeMonthAction(`${month}-01`);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "クローズに失敗しました");
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
      await reopenMonthAction(`${month}-01`, reopenReason.trim());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "再オープンに失敗しました");
    } finally {
      setLoading(null);
      setReopenDialog(null);
      setReopenReason("");
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* サマリーカード */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">クローズ済み</CardTitle>
            <Lock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {closedCount}ヶ月
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">オープン</CardTitle>
            <LockOpen className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {openCount}ヶ月
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">操作履歴</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{history.length}件</div>
          </CardContent>
        </Card>
      </div>

      {/* 月次ステータス一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>月次クローズ状況</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>対象月</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">売上</TableHead>
                <TableHead className="text-right">経費</TableHead>
                <TableHead className="text-right">粗利</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell>
                    {row.isClosed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        <Lock className="h-3 w-3" />
                        クローズ済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <LockOpen className="h-3 w-3" />
                        オープン
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    ¥{row.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ¥{row.expense.toLocaleString()}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      row.grossProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ¥{row.grossProfit.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {row.isClosed ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReopenDialog(row.month);
                          setReopenReason("");
                        }}
                        disabled={loading === row.month}
                      >
                        {loading === row.month ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "再オープン"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setConfirmClose(row.month)}
                        disabled={loading === row.month}
                      >
                        {loading === row.month ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "クローズ"
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* クローズ・再オープン履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>クローズ・再オープン履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">履歴はありません</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>対象月</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>実行者</TableHead>
                  <TableHead>理由</TableHead>
                  <TableHead>スナップショット</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(log.performedAt)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.targetMonth}
                    </TableCell>
                    <TableCell>
                      {log.action === "close" ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          クローズ
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">
                          再オープン
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{log.performerName}</TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {log.reason || "-"}
                    </TableCell>
                    <TableCell>
                      {log.hasSnapshot ? (
                        <span className="text-xs text-green-600">あり</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* クローズ確認ダイアログ */}
      <Dialog
        open={confirmClose !== null}
        onOpenChange={(o) => !o && setConfirmClose(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月次クローズ確認</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            <strong>{confirmClose}</strong>{" "}
            をクローズします。クローズ済みの月はデータの変更が制限されます。
          </p>
          <p className="text-sm text-muted-foreground">
            PLスナップショットが自動保存されます。必要に応じて後から再オープンすることも可能です。
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
              クローズ実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 再オープン理由ダイアログ */}
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
            <p className="text-sm">再オープンの理由を入力してください（必須）。</p>
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
