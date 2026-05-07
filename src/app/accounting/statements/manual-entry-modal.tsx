"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addManualStatementEntry } from "./actions";

function parseYenInput(value: string): number | null {
  const normalized = value.replace(/[，,￥¥\s]/g, "").trim();
  if (normalized === "") return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.trunc(n);
}

export function ManualEntryModal({
  open,
  onOpenChange,
  operatingCompanyId,
  operatingCompanyBankAccountId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  operatingCompanyId: number | null;
  operatingCompanyBankAccountId: number | null;
}) {
  const router = useRouter();
  const [transactionDate, setTransactionDate] = useState("");
  const [description, setDescription] = useState("");
  const [incomingAmount, setIncomingAmount] = useState("");
  const [outgoingAmount, setOutgoingAmount] = useState("");
  const [balance, setBalance] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || saving) return;
    setTransactionDate("");
    setDescription("");
    setIncomingAmount("");
    setOutgoingAmount("");
    setBalance("");
    setMemo("");
  }, [open, saving]);

  const handleClose = () => {
    if (saving) return;
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!operatingCompanyId || !operatingCompanyBankAccountId) {
      toast.error("法人と銀行口座を選択してください");
      return;
    }

    const incoming = parseYenInput(incomingAmount);
    const outgoing = parseYenInput(outgoingAmount);
    const parsedBalance = parseYenInput(balance);
    if (Number.isNaN(incoming) || Number.isNaN(outgoing) || Number.isNaN(parsedBalance)) {
      toast.error("金額は数値で入力してください");
      return;
    }

    setSaving(true);
    try {
      const res = await addManualStatementEntry({
        operatingCompanyId,
        operatingCompanyBankAccountId,
        transactionDate,
        description,
        incomingAmount: incoming,
        outgoingAmount: outgoing,
        balance: parsedBalance,
        csvMemo: memo,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("入出金履歴を1件追加しました");
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>入出金履歴を手動追加</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            CSVを作るほどではない少数の取引を、選択中の法人・銀行口座へ直接追加します。
            入金と出金はどちらか一方だけ入力してください。
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>日付</Label>
              <DatePicker
                value={transactionDate}
                onChange={setTransactionDate}
                disabled={saving}
                placeholder="取引日を選択"
              />
            </div>
            <div className="space-y-1">
              <Label>摘要</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
                placeholder="例: 通帳から転記"
              />
            </div>
            <div className="space-y-1">
              <Label>入金</Label>
              <Input
                inputMode="numeric"
                value={incomingAmount}
                onChange={(e) => setIncomingAmount(e.target.value)}
                disabled={saving}
                placeholder="例: 10000"
              />
            </div>
            <div className="space-y-1">
              <Label>出金</Label>
              <Input
                inputMode="numeric"
                value={outgoingAmount}
                onChange={(e) => setOutgoingAmount(e.target.value)}
                disabled={saving}
                placeholder="例: 3000"
              />
            </div>
            <div className="space-y-1">
              <Label>残高</Label>
              <Input
                inputMode="numeric"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                disabled={saving}
                placeholder="任意"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>メモ</Label>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                disabled={saving}
                placeholder="任意"
                className="min-h-20 resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            閉じる
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                追加中...
              </>
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                追加
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
