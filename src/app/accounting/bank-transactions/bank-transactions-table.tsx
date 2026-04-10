"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import type { BankTransactionRow, BankTransactionFormData } from "./actions";
import { deleteBankTransaction } from "./actions";
import { BankTransactionModal } from "./bank-transaction-modal";

type Props = {
  transactions: BankTransactionRow[];
  formData: BankTransactionFormData;
};

export function BankTransactionsTable({ transactions, formData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // フィルタ
  const [searchText, setSearchText] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");

  // モーダル
  const [createOpen, setCreateOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<BankTransactionRow | null>(null);

  // フィルタリング
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (directionFilter !== "all") {
      result = result.filter((tx) => tx.direction === directionFilter);
    }

    if (paymentMethodFilter !== "all") {
      result = result.filter(
        (tx) => tx.paymentMethod.id === Number(paymentMethodFilter)
      );
    }

    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (tx) =>
          tx.counterparty?.name?.toLowerCase().includes(q) ||
          tx.description?.toLowerCase().includes(q) ||
          tx.paymentMethod.name.toLowerCase().includes(q) ||
          String(tx.amount).includes(q) ||
          tx.groupLinks.some(
            (l) =>
              l.groupLabel.toLowerCase().includes(q) ||
              l.counterpartyName.toLowerCase().includes(q)
          )
      );
    }

    return result;
  }, [transactions, directionFilter, paymentMethodFilter, searchText]);

  const handleDelete = (id: number) => {
    startTransition(async () => {
      try {
        await deleteBankTransaction(id);
        toast.success("入出金を削除しました");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "削除に失敗しました"
        );
      }
    });
  };

  // 消込状態の判定
  const getReconciliationStatus = (tx: BankTransactionRow) => {
    if (tx.reconciliations.length === 0) {
      return { label: "未消込", className: "bg-orange-100 text-orange-800 border-orange-200" };
    }
    const reconciledAmount = tx.reconciliations.reduce((sum, r) => sum + r.amount, 0);
    if (reconciledAmount >= tx.amount) {
      return { label: "消込済", className: "bg-green-100 text-green-800 border-green-200" };
    }
    return { label: "一部消込", className: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  };

  // ユニークな決済手段リスト
  const uniquePaymentMethods = useMemo(() => {
    const seen = new Set<number>();
    return transactions
      .map((tx) => tx.paymentMethod)
      .filter((pm) => {
        if (seen.has(pm.id)) return false;
        seen.add(pm.id);
        return true;
      });
  }, [transactions]);

  return (
    <div className="space-y-4">
      {/* フィルタ・操作バー */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="紐付け・摘要・決済手段で検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-64"
        />
        <Select value={directionFilter} onValueChange={setDirectionFilter}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="incoming">入金</SelectItem>
            <SelectItem value="outgoing">出金</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全決済手段</SelectItem>
            {uniquePaymentMethods.map((pm) => (
              <SelectItem key={pm.id} value={String(pm.id)}>
                {pm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            入出金を登録
          </Button>
        </div>
      </div>

      {/* テーブル */}
      {filteredTransactions.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          入出金データがありません
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="px-3 py-2 font-medium">日付</th>
                <th className="px-3 py-2 font-medium">区分</th>
                <th className="px-3 py-2 font-medium">決済手段</th>
                <th className="px-3 py-2 font-medium">紐付け</th>
                <th className="px-3 py-2 font-medium text-right">金額</th>
                <th className="px-3 py-2 font-medium">摘要</th>
                <th className="px-3 py-2 font-medium">消込状態</th>
                <th className="px-3 py-2 font-medium">証憑</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => {
                const reconStatus = getReconciliationStatus(tx);
                const isReconciled = tx.reconciliations.length > 0;

                return (
                  <tr
                    key={tx.id}
                    className="border-b hover:bg-muted/50 group/row"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(tx.transactionDate).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-3 py-2">
                      {tx.direction === "incoming" ? (
                        <span className="text-green-600 font-medium">入金</span>
                      ) : (
                        <span className="text-red-600 font-medium">出金</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {tx.paymentMethod.name}
                    </td>
                    <td className="px-3 py-2">
                      {tx.groupLinks.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {tx.groupLinks.map((l) => (
                            <span
                              key={l.id}
                              className={
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium w-fit " +
                                (l.groupType === "invoice"
                                  ? "text-blue-700 bg-blue-50"
                                  : "text-purple-700 bg-purple-50")
                              }
                            >
                              {l.groupType === "invoice" ? "請求: " : "支払: "}
                              {l.groupLabel}
                              {l.counterpartyName && ` / ${l.counterpartyName}`}
                              {tx.groupLinks.length > 1 && ` (¥${l.amount.toLocaleString()})`}
                            </span>
                          ))}
                          {tx.linkCompleted && (
                            <span className="text-xs text-green-600">✓ 紐付け完了</span>
                          )}
                        </div>
                      ) : tx.counterparty?.name ? (
                        <span className="text-muted-foreground text-xs">{tx.counterparty.name}</span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      ¥{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate">
                      {tx.description ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={reconStatus.className}>
                        {reconStatus.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {tx.attachments.length > 0 ? (
                        <span className="flex items-center gap-1 text-blue-600">
                          <FileText className="h-4 w-4" />
                          <span className="text-xs">{tx.attachments.length}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {!isReconciled && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setEditEntry(tx)}
                              disabled={isPending}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                  disabled={isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>入出金を削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {new Date(tx.transactionDate).toLocaleDateString("ja-JP")}
                                    {" "}
                                    {tx.direction === "incoming" ? "入金" : "出金"}
                                    {" "}
                                    ¥{tx.amount.toLocaleString()}
                                    {tx.counterparty ? ` (${tx.counterparty.name})` : ""}
                                    {" を削除します。この操作は取り消せません。"}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(tx.id)}
                                    disabled={isPending}
                                    className="bg-red-600"
                                  >
                                    削除する
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 新規作成モーダル */}
      <BankTransactionModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        formData={formData}
        onSuccess={() => router.refresh()}
      />

      {/* 編集モーダル */}
      {editEntry && (
        <BankTransactionModal
          open={!!editEntry}
          onOpenChange={(o) => {
            if (!o) setEditEntry(null);
          }}
          formData={formData}
          editEntry={editEntry}
          onSuccess={() => {
            setEditEntry(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
