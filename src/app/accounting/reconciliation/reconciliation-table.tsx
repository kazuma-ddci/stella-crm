"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Link2, Unlink, Search } from "lucide-react";
import { toast } from "sonner";
import { cancelReconciliation } from "./actions";
import { ReconciliationModal } from "./reconciliation-modal";
import type {
  UnmatchedBankTransaction,
  UnmatchedJournalEntry,
  ReconciliationRow,
  ReconciliationFormData,
} from "./actions";

type Props = {
  bankTransactions: UnmatchedBankTransaction[];
  journalEntries: UnmatchedJournalEntry[];
  reconciliations: ReconciliationRow[];
  formData: ReconciliationFormData;
};

export function ReconciliationTable({
  bankTransactions,
  journalEntries,
  reconciliations,
  formData,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 選択状態
  const [selectedBankTx, setSelectedBankTx] =
    useState<UnmatchedBankTransaction | null>(null);
  const [selectedJournal, setSelectedJournal] =
    useState<UnmatchedJournalEntry | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 検索フィルタ
  const [bankSearch, setBankSearch] = useState("");
  const [journalSearch, setJournalSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  // 入出金フィルタ
  const filteredBankTx = useMemo(() => {
    if (!bankSearch.trim()) return bankTransactions;
    const q = bankSearch.trim().toLowerCase();
    return bankTransactions.filter(
      (bt) =>
        bt.counterparty?.name?.toLowerCase().includes(q) ||
        bt.description?.toLowerCase().includes(q) ||
        bt.paymentMethod.name.toLowerCase().includes(q) ||
        String(bt.amount).includes(q)
    );
  }, [bankTransactions, bankSearch]);

  // 仕訳フィルタ
  const filteredJournals = useMemo(() => {
    if (!journalSearch.trim()) return journalEntries;
    const q = journalSearch.trim().toLowerCase();
    return journalEntries.filter(
      (je) =>
        je.description.toLowerCase().includes(q) ||
        je.lines.some(
          (l) =>
            l.account.name.toLowerCase().includes(q) ||
            l.account.code.toLowerCase().includes(q)
        ) ||
        je.transaction?.counterparty?.name?.toLowerCase().includes(q) ||
        je.invoiceGroup?.invoiceNumber?.toLowerCase().includes(q)
    );
  }, [journalEntries, journalSearch]);

  // 消込履歴フィルタ
  const filteredReconciliations = useMemo(() => {
    if (!historySearch.trim()) return reconciliations;
    const q = historySearch.trim().toLowerCase();
    return reconciliations.filter(
      (r) =>
        r.journalEntry.description.toLowerCase().includes(q) ||
        r.bankTransaction.counterparty?.name?.toLowerCase().includes(q) ||
        r.bankTransaction.description?.toLowerCase().includes(q) ||
        r.performer.name.toLowerCase().includes(q)
    );
  }, [reconciliations, historySearch]);

  // 消込作成モーダルを開く
  const handleOpenReconciliation = useCallback(() => {
    if (!selectedBankTx || !selectedJournal) {
      toast.error("入出金と仕訳をそれぞれ1つ選択してください");
      return;
    }
    setModalOpen(true);
  }, [selectedBankTx, selectedJournal]);

  // 消込取り消し
  const handleCancel = (id: number) => {
    startTransition(async () => {
      try {
        await cancelReconciliation(id);
        toast.success("消込を取り消しました");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "取り消しに失敗しました"
        );
      }
    });
  };

  const handleModalSuccess = () => {
    setModalOpen(false);
    setSelectedBankTx(null);
    setSelectedJournal(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 消込操作エリア */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>消込操作</CardTitle>
            <Button
              onClick={handleOpenReconciliation}
              disabled={!selectedBankTx || !selectedJournal || isPending}
            >
              <Link2 className="h-4 w-4 mr-1" />
              消込実行
            </Button>
          </div>
          {(selectedBankTx || selectedJournal) && (
            <div className="flex items-center gap-2 text-sm mt-2">
              <span className="text-muted-foreground">選択中:</span>
              {selectedBankTx && (
                <Badge variant="outline" className="gap-1">
                  入出金 #{selectedBankTx.id}
                  <span className="font-semibold">
                    ¥
                    {(
                      selectedBankTx.amount - selectedBankTx.reconciledAmount
                    ).toLocaleString()}
                  </span>
                  <button
                    className="ml-1 hover:text-red-500"
                    onClick={() => setSelectedBankTx(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
              {selectedJournal && (
                <Badge variant="outline" className="gap-1">
                  仕訳 #{selectedJournal.id}
                  <span className="font-semibold">
                    ¥
                    {(
                      selectedJournal.debitTotal -
                      selectedJournal.reconciledAmount
                    ).toLocaleString()}
                  </span>
                  <button
                    className="ml-1 hover:text-red-500"
                    onClick={() => setSelectedJournal(null)}
                  >
                    ×
                  </button>
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* 未消込データ 2カラム */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 未消込入出金 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              未消込の入出金
              <Badge variant="secondary" className="ml-2">
                {filteredBankTx.length}件
              </Badge>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="取引先・摘要・決済手段で検索..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredBankTx.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                未消込の入出金はありません
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium w-8"></th>
                      <th className="px-3 py-2 font-medium">日付</th>
                      <th className="px-3 py-2 font-medium">区分</th>
                      <th className="px-3 py-2 font-medium text-right">
                        金額
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        未消込
                      </th>
                      <th className="px-3 py-2 font-medium">取引先</th>
                      <th className="px-3 py-2 font-medium">決済手段</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBankTx.map((bt) => {
                      const remaining = bt.amount - bt.reconciledAmount;
                      const isSelected = selectedBankTx?.id === bt.id;
                      return (
                        <tr
                          key={bt.id}
                          className={`border-b cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-50 hover:bg-blue-100"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() =>
                            setSelectedBankTx(isSelected ? null : bt)
                          }
                        >
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedBankTx(isSelected ? null : bt)
                              }
                              className="accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(bt.transactionDate).toLocaleDateString(
                              "ja-JP"
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {bt.direction === "incoming" ? (
                              <span className="text-green-600 font-medium">
                                入金
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">
                                出金
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            ¥{bt.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                            ¥{remaining.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 max-w-[120px] truncate">
                            {bt.counterparty?.name ?? "-"}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {bt.paymentMethod.name}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 未消込仕訳 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              未消込の仕訳
              <Badge variant="secondary" className="ml-2">
                {filteredJournals.length}件
              </Badge>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="摘要・科目・取引先で検索..."
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredJournals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                未消込の仕訳はありません
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b text-left">
                      <th className="px-3 py-2 font-medium w-8"></th>
                      <th className="px-3 py-2 font-medium">日付</th>
                      <th className="px-3 py-2 font-medium">摘要</th>
                      <th className="px-3 py-2 font-medium text-right">
                        金額
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        未消込
                      </th>
                      <th className="px-3 py-2 font-medium">科目</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJournals.map((je) => {
                      const remaining =
                        je.debitTotal - je.reconciledAmount;
                      const isSelected = selectedJournal?.id === je.id;
                      const debitAccounts = je.lines
                        .filter((l) => l.side === "debit")
                        .map((l) => l.account.name)
                        .join(", ");

                      return (
                        <tr
                          key={je.id}
                          className={`border-b cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-blue-50 hover:bg-blue-100"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() =>
                            setSelectedJournal(isSelected ? null : je)
                          }
                        >
                          <td className="px-3 py-2">
                            <input
                              type="radio"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedJournal(isSelected ? null : je)
                              }
                              className="accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(je.journalDate).toLocaleDateString(
                              "ja-JP"
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[150px] truncate">
                            {je.description}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            ¥{je.debitTotal.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                            ¥{remaining.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[120px] truncate">
                            {debitAccounts}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 消込履歴 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>
            消込履歴
            <Badge variant="secondary" className="ml-2">
              {reconciliations.length}件
            </Badge>
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="摘要・取引先・担当者で検索..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-8 h-9 max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredReconciliations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              消込履歴はありません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-3 py-2 font-medium">消込日時</th>
                    <th className="px-3 py-2 font-medium">入出金</th>
                    <th className="px-3 py-2 font-medium">仕訳</th>
                    <th className="px-3 py-2 font-medium text-right">
                      消込金額
                    </th>
                    <th className="px-3 py-2 font-medium">実行者</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReconciliations.map((rec) => (
                    <tr
                      key={rec.id}
                      className="border-b hover:bg-muted/50 group/row"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(rec.performedAt).toLocaleDateString("ja-JP")}
                        <span className="text-xs text-muted-foreground ml-1">
                          {new Date(rec.performedAt).toLocaleTimeString(
                            "ja-JP",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs">
                          <span
                            className={
                              rec.bankTransaction.direction === "incoming"
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {rec.bankTransaction.direction === "incoming"
                              ? "入金"
                              : "出金"}
                          </span>
                          <span className="ml-1">
                            ¥{rec.bankTransaction.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {rec.bankTransaction.counterparty?.name ??
                            rec.bankTransaction.description ??
                            "-"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rec.bankTransaction.paymentMethod.name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs truncate max-w-[150px]">
                          {rec.journalEntry.description}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rec.journalEntry.lines
                            .filter((l) => l.side === "debit")
                            .map((l) => l.account.name)
                            .join(", ")}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                        ¥{rec.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {rec.performer.name}
                      </td>
                      <td className="px-3 py-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                              disabled={isPending}
                            >
                              <Unlink className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                消込を取り消しますか？
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                入出金と仕訳の紐づけが解除され、それぞれが未消込に戻ります。
                                <br />
                                <br />
                                <strong>消込金額:</strong> ¥
                                {rec.amount.toLocaleString()}
                                <br />
                                <strong>仕訳:</strong>{" "}
                                {rec.journalEntry.description}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancel(rec.id)}
                                disabled={isPending}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                取り消す
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 消込モーダル */}
      {selectedBankTx && selectedJournal && (
        <ReconciliationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          bankTransaction={selectedBankTx}
          journalEntry={selectedJournal}
          formData={formData}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}
