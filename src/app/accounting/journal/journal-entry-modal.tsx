"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createJournalEntry,
  updateJournalEntry,
  type JournalEntryLineInput,
  type JournalFormData,
} from "./actions";

type JournalEntryForEdit = {
  id: number;
  journalDate: Date;
  description: string;
  invoiceGroupId: number | null;
  paymentGroupId: number | null;
  transactionId: number | null;
  lines: {
    id: number;
    side: string;
    accountId: number;
    amount: number;
    description: string | null;
  }[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: JournalFormData;
  editEntry?: JournalEntryForEdit | null;
  onSuccess?: () => void;
};

type LineFormState = {
  key: string;
  side: "debit" | "credit";
  accountId: string;
  amount: string;
  description: string;
};

function generateKey() {
  return Math.random().toString(36).substring(2, 9);
}

function createEmptyLine(side: "debit" | "credit"): LineFormState {
  return {
    key: generateKey(),
    side,
    accountId: "",
    amount: "",
    description: "",
  };
}

export function JournalEntryModal({
  open,
  onOpenChange,
  formData,
  editEntry,
  onSuccess,
}: Props) {
  const isEdit = !!editEntry;

  const [journalDate, setJournalDate] = useState(
    editEntry
      ? new Date(editEntry.journalDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [description, setDescription] = useState(
    editEntry?.description ?? ""
  );
  const [lines, setLines] = useState<LineFormState[]>(() => {
    if (editEntry?.lines && editEntry.lines.length > 0) {
      return editEntry.lines.map((l) => ({
        key: generateKey(),
        side: l.side as "debit" | "credit",
        accountId: String(l.accountId),
        amount: String(l.amount),
        description: l.description ?? "",
      }));
    }
    return [createEmptyLine("debit"), createEmptyLine("credit")];
  });
  const [submitting, setSubmitting] = useState(false);

  // 勘定科目オプション（カテゴリ別にグループ化）
  const accountOptions = useMemo(() => {
    const categoryLabels: Record<string, string> = {
      asset: "資産",
      liability: "負債",
      revenue: "収益",
      expense: "費用",
    };
    const grouped: Record<string, typeof formData.accounts> = {};
    for (const acc of formData.accounts) {
      if (!grouped[acc.category]) grouped[acc.category] = [];
      grouped[acc.category].push(acc);
    }
    return { grouped, categoryLabels };
  }, [formData.accounts]);

  // 借方・貸方の合計計算
  const { debitTotal, creditTotal, difference } = useMemo(() => {
    const dt = lines
      .filter((l) => l.side === "debit")
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    const ct = lines
      .filter((l) => l.side === "credit")
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    return { debitTotal: dt, creditTotal: ct, difference: dt - ct };
  }, [lines]);

  const updateLine = useCallback(
    (key: string, field: keyof LineFormState, value: string) => {
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
      );
    },
    []
  );

  const addLine = useCallback((side: "debit" | "credit") => {
    setLines((prev) => [...prev, createEmptyLine(side)]);
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((l) => l.key !== key);
    });
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const lineData: JournalEntryLineInput[] = lines.map((l) => ({
        side: l.side,
        accountId: Number(l.accountId),
        amount: Number(l.amount),
        description: l.description || undefined,
      }));

      const payload: Record<string, unknown> = {
        journalDate,
        description,
        lines: lineData,
        invoiceGroupId: editEntry?.invoiceGroupId ?? null,
        paymentGroupId: editEntry?.paymentGroupId ?? null,
        transactionId: editEntry?.transactionId ?? null,
      };

      if (isEdit && editEntry) {
        await updateJournalEntry(editEntry.id, payload);
        toast.success("仕訳を更新しました");
      } else {
        await createJournalEntry(payload);
        toast.success("仕訳を作成しました");
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = useCallback(() => {
    if (!editEntry) {
      setJournalDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setLines([createEmptyLine("debit"), createEmptyLine("credit")]);
    }
  }, [editEntry]);

  const debitLines = lines.filter((l) => l.side === "debit");
  const creditLines = lines.filter((l) => l.side === "credit");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "仕訳編集" : "新規仕訳作成"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* ヘッダー情報 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>仕訳日 *</Label>
              <Input
                type="date"
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>摘要 *</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="仕訳の摘要を入力"
                className="mt-1"
              />
            </div>
          </div>

          {/* 借方明細 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">借方（Debit）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addLine("debit")}
              >
                <Plus className="h-4 w-4 mr-1" />
                行追加
              </Button>
            </div>
            <div className="space-y-2">
              {debitLines.map((line) => (
                <JournalLineRow
                  key={line.key}
                  line={line}
                  accountOptions={accountOptions}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  canRemove={lines.length > 2}
                />
              ))}
            </div>
            <div className="text-right mt-1 text-sm font-medium">
              借方合計: ¥{debitTotal.toLocaleString()}
            </div>
          </div>

          {/* 貸方明細 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">貸方（Credit）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addLine("credit")}
              >
                <Plus className="h-4 w-4 mr-1" />
                行追加
              </Button>
            </div>
            <div className="space-y-2">
              {creditLines.map((line) => (
                <JournalLineRow
                  key={line.key}
                  line={line}
                  accountOptions={accountOptions}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  canRemove={lines.length > 2}
                />
              ))}
            </div>
            <div className="text-right mt-1 text-sm font-medium">
              貸方合計: ¥{creditTotal.toLocaleString()}
            </div>
          </div>

          {/* 差額表示 */}
          <div
            className={`p-3 rounded-lg text-center font-medium ${
              difference === 0
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {difference === 0
              ? `貸借一致 ¥${debitTotal.toLocaleString()}`
              : `差額: ¥${Math.abs(difference).toLocaleString()}（${
                  difference > 0 ? "借方超過" : "貸方超過"
                }）`}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || difference !== 0}
          >
            {submitting
              ? "保存中..."
              : isEdit
                ? "更新"
                : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// 仕訳明細行コンポーネント
// ============================================

function JournalLineRow({
  line,
  accountOptions,
  onUpdate,
  onRemove,
  canRemove,
}: {
  line: LineFormState;
  accountOptions: {
    grouped: Record<string, { id: number; code: string; name: string; category: string }[]>;
    categoryLabels: Record<string, string>;
  };
  onUpdate: (key: string, field: keyof LineFormState, value: string) => void;
  onRemove: (key: string) => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select
          value={line.accountId}
          onValueChange={(v) => onUpdate(line.key, "accountId", v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="勘定科目を選択" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(accountOptions.grouped).map(
              ([category, accounts]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {accountOptions.categoryLabels[category] ?? category}
                  </div>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </div>
              )
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="w-36">
        <Input
          type="number"
          value={line.amount}
          onChange={(e) => onUpdate(line.key, "amount", e.target.value)}
          placeholder="金額"
          className="h-9 text-right"
          min={1}
        />
      </div>
      <div className="w-40">
        <Input
          value={line.description}
          onChange={(e) =>
            onUpdate(line.key, "description", e.target.value)
          }
          placeholder="明細摘要（任意）"
          className="h-9"
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(line.key)}
        disabled={!canRemove}
        className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
