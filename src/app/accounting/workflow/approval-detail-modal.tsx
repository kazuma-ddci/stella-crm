"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
import { AlertTriangle, Search } from "lucide-react";
import {
  getPendingApprovalDetail,
  updateAndApprovePaymentGroup,
  rejectPaymentGroup,
  type PendingApprovalDetail,
} from "./actions";

type Props = {
  groupId: number | null;
  open: boolean;
  onClose: () => void;
};

function formatDate(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function ApprovalDetailModal({ groupId, open, onClose }: Props) {
  const [detail, setDetail] = useState<PendingApprovalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 編集state
  const [counterpartyId, setCounterpartyId] = useState<number | null>(null);
  const [counterpartySearch, setCounterpartySearch] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState(10);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // データロード
  useEffect(() => {
    if (!open || !groupId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    getPendingApprovalDetail(groupId)
      .then((d) => {
        setDetail(d);
        if (d) {
          setCounterpartyId(d.counterpartyId);
          setExpenseCategoryId(d.transaction?.expenseCategoryId ?? null);
          setPaymentMethodId(d.transaction?.paymentMethodId ?? null);
          setAmount(d.transaction?.amount?.toString() ?? "");
          setTaxRate(d.transaction?.taxRate ?? 10);
          setNote(d.transaction?.note ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [open, groupId]);

  const computedTaxAmount = useMemo(() => {
    const amt = Number(amount);
    if (!amt || !taxRate) return 0;
    return Math.floor(amt - amt / (1 + taxRate / 100));
  }, [amount, taxRate]);

  const filteredCounterparties = useMemo(() => {
    if (!detail) return [];
    const q = counterpartySearch.toLowerCase();
    if (!q) return detail.counterparties;
    return detail.counterparties.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.displayId && c.displayId.toLowerCase().includes(q)) ||
        (c.companyCode && c.companyCode.toLowerCase().includes(q))
    );
  }, [detail, counterpartySearch]);

  const handleApprove = () => {
    if (!detail) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateAndApprovePaymentGroup(detail.id, {
          counterpartyId: counterpartyId ?? undefined,
          expenseCategoryId,
          paymentMethodId,
          amount: amount ? Number(amount) : undefined,
          taxAmount: amount ? computedTaxAmount : undefined,
          taxRate,
          note: note.trim() || null,
        });
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "承認に失敗しました");
      }
    });
  };

  const handleReject = () => {
    if (!detail) return;
    setError(null);
    startTransition(async () => {
      try {
        await rejectPaymentGroup(detail.id, rejectReason.trim() || undefined);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "差し戻しに失敗しました");
      }
    });
  };

  const hasCustomCounterparty = !!detail?.customCounterpartyName;
  const missingCategory = !expenseCategoryId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            経費承認 {detail?.referenceCode ?? ""}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="text-center py-8 text-muted-foreground">読み込み中...</p>}
        {!loading && !detail && <p className="text-center py-8 text-muted-foreground">データが見つかりません</p>}

        {detail && (
          <div className="space-y-5">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>
            )}

            {/* 警告 */}
            {(hasCustomCounterparty || missingCategory) && (
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
                {hasCustomCounterparty && (
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    取引先が手入力です（「{detail.customCounterpartyName}」）。マスタの取引先を選択してください。
                  </div>
                )}
                {missingCategory && (
                  <div className="flex items-center gap-2 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    勘定科目（費目）が未設定です。設定してください。
                  </div>
                )}
              </div>
            )}

            {/* 基本情報（読み取り） */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">事業部:</span>{" "}
                <span className="font-medium">{detail.projectName ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">支払元法人:</span>{" "}
                <span className="font-medium">{detail.operatingCompanyName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">申請者:</span>{" "}
                <span className="font-medium">{detail.createdByName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">申請日:</span>{" "}
                <span className="font-medium">{formatDate(detail.createdAt)}</span>
              </div>
              {detail.transaction?.expenseOwners && detail.transaction.expenseOwners.length > 0 && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">担当者:</span>{" "}
                  <span className="font-medium">
                    {detail.transaction.expenseOwners
                      .map((o) => o.staffName || o.customName || "-")
                      .join(", ")}
                  </span>
                </div>
              )}
              {detail.transaction && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">発生期間:</span>{" "}
                  <span className="font-medium">
                    {formatDate(detail.transaction.periodFrom)} 〜 {formatDate(detail.transaction.periodTo)}
                  </span>
                </div>
              )}
            </div>

            <hr />

            {/* 編集可能フィールド */}
            <div className="space-y-4">
              {/* 取引先 */}
              <div className="space-y-1.5">
                <Label>
                  取引先
                  {hasCustomCounterparty && (
                    <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200">要確認</Badge>
                  )}
                </Label>
                <div className="border rounded-lg p-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="取引先検索..."
                      value={counterpartySearch}
                      onChange={(e) => setCounterpartySearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {filteredCounterparties.slice(0, 50).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`w-full text-left px-2 py-1 text-sm rounded hover:bg-blue-50 ${
                          counterpartyId === c.id ? "bg-blue-50 border-l-2 border-l-blue-500 font-medium" : ""
                        }`}
                        onClick={() => setCounterpartyId(c.id)}
                      >
                        <span className="text-muted-foreground font-mono text-xs mr-1.5">
                          {c.companyCode || c.displayId || "---"}
                        </span>
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 勘定科目 */}
              <div>
                <Label>
                  勘定科目（費目）
                  {missingCategory && (
                    <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200">未設定</Badge>
                  )}
                </Label>
                <Select
                  value={expenseCategoryId?.toString() ?? ""}
                  onValueChange={(v) => setExpenseCategoryId(v ? Number(v) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択..." />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.expenseCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 支払方法 */}
              <div>
                <Label>支払方法</Label>
                <Select
                  value={paymentMethodId?.toString() ?? ""}
                  onValueChange={(v) => setPaymentMethodId(v ? Number(v) : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 金額 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>金額（税込）</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>税率 (%)</Label>
                  <Input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>消費税額</Label>
                  <Input value={computedTaxAmount} readOnly className="bg-muted" />
                </div>
              </div>

              {/* 摘要 */}
              <div>
                <Label>摘要・メモ</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <hr />

            {/* 差し戻し */}
            <div>
              <Label className="text-sm text-muted-foreground">差し戻す場合は理由を入力:</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={2}
                placeholder="差し戻し理由（任意）"
              />
            </div>

            {/* アクションボタン */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={onClose} disabled={isPending}>
                キャンセル
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleReject}
                disabled={isPending}
              >
                差し戻し
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={isPending}
              >
                {isPending ? "処理中..." : "確認して承認"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
