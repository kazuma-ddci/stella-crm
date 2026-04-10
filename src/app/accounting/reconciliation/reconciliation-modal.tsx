"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createReconciliation } from "./actions";
import type {
  UnmatchedBankTransaction,
  UnmatchedJournalEntry,
  ReconciliationFormData,
} from "./actions";

type DifferenceLine = {
  key: string;
  side: "debit" | "credit";
  accountId: string;
  amount: string;
  description: string;
};

type DifferenceType =
  | "none"
  | "partial_payment"
  | "transfer_fee"
  | "discount"
  | "manual";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankTransaction: UnmatchedBankTransaction;
  journalEntry: UnmatchedJournalEntry;
  formData: ReconciliationFormData;
  onSuccess: () => void;
};

export function ReconciliationModal({
  open,
  onOpenChange,
  bankTransaction,
  journalEntry,
  formData,
  onSuccess,
}: Props) {
  const bankRemaining =
    bankTransaction.amount - bankTransaction.reconciledAmount;
  const journalRemaining =
    journalEntry.debitTotal - journalEntry.reconciledAmount;

  // 消込金額のデフォルト: 入出金残額と仕訳残額の小さい方
  const defaultAmount = Math.min(bankRemaining, journalRemaining);

  const [amount, setAmount] = useState(String(defaultAmount));
  const [differenceType, setDifferenceType] = useState<DifferenceType>("none");
  const [differenceLines, setDifferenceLines] = useState<DifferenceLine[]>([
    {
      key: "1",
      side: "debit",
      accountId: "",
      amount: "",
      description: "",
    },
    {
      key: "2",
      side: "credit",
      accountId: "",
      amount: "",
      description: "",
    },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [showRulePrompt, setShowRulePrompt] = useState(false);

  // 差額計算
  const amountNum = Number(amount) || 0;
  const difference = useMemo(() => {
    // 入出金残額と仕訳残額の差額
    if (amountNum === bankRemaining && amountNum === journalRemaining) {
      return 0; // 完全一致
    }
    // 消込金額と仕訳残額の差（仕訳側の未消込部分がどれだけ残るか）
    return journalRemaining - amountNum;
  }, [amountNum, bankRemaining, journalRemaining]);

  // 金額不一致かどうか
  const hasAmountMismatch = bankRemaining !== journalRemaining;

  // 差額処理が必要かどうか
  const needsDifferenceHandling =
    hasAmountMismatch && differenceType === "none";

  // 差額仕訳ライン操作
  const handleAddLine = useCallback(() => {
    const lastLine = differenceLines[differenceLines.length - 1];
    const newSide = lastLine?.side === "debit" ? "credit" : "debit";
    setDifferenceLines([
      ...differenceLines,
      {
        key: Math.random().toString(36).substring(2, 9),
        side: newSide,
        accountId: "",
        amount: "",
        description: "",
      },
    ]);
  }, [differenceLines]);

  const handleRemoveLine = useCallback(
    (key: string) => {
      setDifferenceLines(differenceLines.filter((l) => l.key !== key));
    },
    [differenceLines]
  );

  const updateLine = useCallback(
    (key: string, field: keyof DifferenceLine, value: string) => {
      setDifferenceLines(
        differenceLines.map((l) =>
          l.key === key ? { ...l, [field]: value } : l
        )
      );
    },
    [differenceLines]
  );

  // 差額処理タイプ変更時の初期値設定
  const handleDifferenceTypeChange = useCallback(
    (type: DifferenceType) => {
      setDifferenceType(type);

      if (type === "none" || type === "partial_payment" || type === "manual") {
        // 差額仕訳不要
        setDifferenceLines([
          {
            key: "1",
            side: "debit",
            accountId: "",
            amount: "",
            description: "",
          },
          {
            key: "2",
            side: "credit",
            accountId: "",
            amount: "",
            description: "",
          },
        ]);
        return;
      }

      const diffAmount = Math.abs(journalRemaining - bankRemaining);

      if (type === "transfer_fee") {
        // 振込手数料: 借方=支払手数料、貸方=売掛金
        setDifferenceLines([
          {
            key: "1",
            side: "debit",
            accountId: "",
            amount: String(diffAmount),
            description: "振込手数料",
          },
          {
            key: "2",
            side: "credit",
            accountId: "",
            amount: String(diffAmount),
            description: "振込手数料（売掛金減額）",
          },
        ]);
      } else if (type === "discount") {
        // 値引き: 借方=売上値引、貸方=売掛金
        setDifferenceLines([
          {
            key: "1",
            side: "debit",
            accountId: "",
            amount: String(diffAmount),
            description: "値引き",
          },
          {
            key: "2",
            side: "credit",
            accountId: "",
            amount: String(diffAmount),
            description: "値引き（売掛金減額）",
          },
        ]);
      }
    },
    [journalRemaining, bankRemaining]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data: Record<string, unknown> = {
        journalEntryId: journalEntry.id,
        bankTransactionId: bankTransaction.id,
        amount: amountNum,
      };

      // 差額処理がある場合
      if (
        differenceType !== "none" &&
        differenceType !== "partial_payment" &&
        differenceType !== "manual"
      ) {
        data.differenceType = differenceType;
        data.differenceLines = differenceLines.map((l) => ({
          side: l.side,
          accountId: Number(l.accountId),
          amount: Number(l.amount),
          description: l.description || undefined,
        }));
      } else if (differenceType === "partial_payment") {
        data.differenceType = "partial_payment";
      } else if (differenceType === "manual") {
        data.differenceType = "manual";
      }

      const result = await createReconciliation(data);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (differenceType === "manual") {
        toast.success("消込を実行しました", {
          description: "差額の仕訳を手動で作成してください",
          action: {
            label: "仕訳画面へ",
            onClick: () => window.open("/accounting/journal", "_blank"),
          },
        });
      } else {
        toast.success("消込を実行しました");
      }

      // ルール追加提案
      if (
        differenceType === "transfer_fee" ||
        differenceType === "discount"
      ) {
        setShowRulePrompt(true);
      } else {
        onSuccess();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "消込に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRulePromptClose = () => {
    setShowRulePrompt(false);
    onSuccess();
  };

  // ルール追加提案表示中
  if (showRulePrompt) {
    return (
      <Dialog open={open} onOpenChange={handleRulePromptClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ルールに追加しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            このパターンを自動仕訳ルールに追加すると、今後同様の差額が発生した場合に自動で仕訳が提案されます。
          </p>
          <p className="text-sm mt-2">
            ルールの追加は「マスタ管理 &gt; 自動仕訳ルール」から行えます。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleRulePromptClose}>
              今はしない
            </Button>
            <Button
              onClick={() => {
                handleRulePromptClose();
                // 自動仕訳ルール画面への導線
                window.open("/accounting/masters/auto-journal", "_blank");
              }}
            >
              ルール管理を開く
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>消込実行</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 選択された入出金と仕訳の概要 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 入出金 */}
            <div className="border rounded-lg p-3 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                入出金
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    bankTransaction.direction === "incoming"
                      ? "default"
                      : "destructive"
                  }
                  className="text-xs"
                >
                  {bankTransaction.direction === "incoming" ? "入金" : "出金"}
                </Badge>
                <span className="font-semibold">
                  ¥{bankTransaction.amount.toLocaleString()}
                </span>
              </div>
              <div className="text-sm">
                {bankTransaction.counterparty?.name ?? "-"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(bankTransaction.transactionDate).toLocaleDateString(
                  "ja-JP"
                )}{" "}
                / {bankTransaction.paymentMethod.name}
              </div>
              {bankTransaction.reconciledAmount > 0 && (
                <div className="text-xs text-orange-600">
                  消込済: ¥{bankTransaction.reconciledAmount.toLocaleString()} /
                  残: ¥{bankRemaining.toLocaleString()}
                </div>
              )}
            </div>

            {/* 仕訳 */}
            <div className="border rounded-lg p-3 space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                仕訳
              </div>
              <div className="font-semibold">
                ¥{journalEntry.debitTotal.toLocaleString()}
              </div>
              <div className="text-sm truncate">{journalEntry.description}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(journalEntry.journalDate).toLocaleDateString("ja-JP")}
              </div>
              <div className="text-xs text-muted-foreground">
                {journalEntry.lines
                  .filter((l) => l.side === "debit")
                  .map((l) => `${l.account.code} ${l.account.name}`)
                  .join(", ")}
              </div>
              {journalEntry.reconciledAmount > 0 && (
                <div className="text-xs text-orange-600">
                  消込済: ¥{journalEntry.reconciledAmount.toLocaleString()} /
                  残: ¥{journalRemaining.toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {/* 金額不一致警告 */}
          {hasAmountMismatch && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800">
                  金額が一致しません
                </div>
                <div className="text-yellow-700 mt-1">
                  入出金残額: ¥{bankRemaining.toLocaleString()} / 仕訳残額: ¥
                  {journalRemaining.toLocaleString()} （差額: ¥
                  {Math.abs(bankRemaining - journalRemaining).toLocaleString()}
                  ）
                </div>
                <div className="text-yellow-700 mt-1">
                  差額処理方法を選択してください。
                </div>
              </div>
            </div>
          )}

          {/* 消込金額 */}
          <div>
            <Label htmlFor="amount">消込金額</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              required
              className="mt-1"
            />
            {difference > 0 && amountNum > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                消込後の仕訳未消込残: ¥{difference.toLocaleString()}
              </p>
            )}
          </div>

          {/* 差額処理タイプ選択（金額不一致時のみ表示） */}
          {hasAmountMismatch && (
            <div>
              <Label>差額処理</Label>
              <Select
                value={differenceType}
                onValueChange={(v) =>
                  handleDifferenceTypeChange(v as DifferenceType)
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="差額処理方法を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選択してください</SelectItem>
                  <SelectItem value="partial_payment">
                    一部入金（残額は未消込のまま）
                  </SelectItem>
                  <SelectItem value="transfer_fee">
                    振込手数料（差額仕訳を自動生成）
                  </SelectItem>
                  <SelectItem value="discount">
                    値引き（差額仕訳を自動生成）
                  </SelectItem>
                  <SelectItem value="manual">
                    手動対応（後で差額仕訳を作成）
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 差額仕訳プレビュー（振込手数料・値引きの場合） */}
          {(differenceType === "transfer_fee" ||
            differenceType === "discount") && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  差額仕訳プレビュー
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  行追加
                </Button>
              </div>

              <div className="space-y-2">
                {differenceLines.map((line) => (
                  <div key={line.key} className="flex gap-2 items-end">
                    <div className="w-20">
                      <Select
                        value={line.side}
                        onValueChange={(side) =>
                          updateLine(line.key, "side", side)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">借方</SelectItem>
                          <SelectItem value="credit">貸方</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Select
                        value={line.accountId}
                        onValueChange={(id) =>
                          updateLine(line.key, "accountId", id)
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="科目選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {formData.accounts.map((acc) => (
                            <SelectItem key={acc.id} value={String(acc.id)}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        value={line.amount}
                        onChange={(e) =>
                          updateLine(line.key, "amount", e.target.value)
                        }
                        placeholder="金額"
                        className="h-9"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.key, "description", e.target.value)
                        }
                        placeholder="摘要（任意）"
                        className="h-9"
                      />
                    </div>
                    {differenceLines.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        onClick={() => handleRemoveLine(line.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* 差額仕訳の借方/貸方合計 */}
              <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t">
                <span>
                  借方合計: ¥
                  {differenceLines
                    .filter((l) => l.side === "debit")
                    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
                    .toLocaleString()}
                </span>
                <span>
                  貸方合計: ¥
                  {differenceLines
                    .filter((l) => l.side === "credit")
                    .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                amountNum <= 0 ||
                needsDifferenceHandling
              }
            >
              {submitting ? "処理中..." : "消込を実行"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
