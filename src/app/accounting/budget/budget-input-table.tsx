"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Copy, Zap, Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgetMonth,
  previewBudgetFromRecurring,
  generateBudgetFromRecurring,
} from "./actions";
import type { BudgetFormData, BudgetRow, RecurringBudgetPreviewItem } from "./actions";

type Props = {
  budgets: BudgetRow[];
  formData: BudgetFormData;
  fiscalYear: number;
  costCenterId: number | null | undefined;
};

const MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

export function BudgetInputTable({
  budgets,
  formData,
  fiscalYear,
  costCenterId,
}: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<BudgetRow | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [recurringPreview, setRecurringPreview] = useState<RecurringBudgetPreviewItem[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 新規追加フォーム
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newTargetMonth, setNewTargetMonth] = useState("0");
  const [newBudgetAmount, setNewBudgetAmount] = useState("");
  const [newMemo, setNewMemo] = useState("");

  // 編集フォーム
  const [editCategoryLabel, setEditCategoryLabel] = useState("");
  const [editAccountId, setEditAccountId] = useState("");
  const [editBudgetAmount, setEditBudgetAmount] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // コピーフォーム
  const [copySourceMonth, setCopySourceMonth] = useState("0");
  const [copyTargetMonth, setCopyTargetMonth] = useState("1");

  // カテゴリ別×月でグループ化
  const grouped = new Map<
    string,
    Map<number, BudgetRow>
  >();

  for (const b of budgets) {
    const key = `${b.categoryLabel}`;
    if (!grouped.has(key)) {
      grouped.set(key, new Map());
    }
    const monthIdx = new Date(b.targetMonth).getMonth();
    grouped.get(key)!.set(monthIdx, b);
  }

  const categories = Array.from(grouped.keys()).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );

  const resetAddForm = useCallback(() => {
    setNewCategoryLabel("");
    setNewAccountId("");
    setNewTargetMonth("0");
    setNewBudgetAmount("");
    setNewMemo("");
  }, []);

  const handleAdd = async () => {
    setSubmitting(true);
    const result = await createBudget({
      categoryLabel: newCategoryLabel,
      accountId: newAccountId || null,
      targetMonth: new Date(fiscalYear, Number(newTargetMonth), 1).toISOString(),
      budgetAmount: Number(newBudgetAmount),
      costCenterId: costCenterId ?? null,
      memo: newMemo || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("予算を追加しました");
    setAddOpen(false);
    resetAddForm();
    router.refresh();
  };

  const handleEdit = async () => {
    if (!editBudget) return;
    setSubmitting(true);
    const result = await updateBudget(editBudget.id, {
      categoryLabel: editCategoryLabel,
      accountId: editAccountId || null,
      budgetAmount: Number(editBudgetAmount),
      memo: editMemo || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("予算を更新しました");
    setEditBudget(null);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この予算を削除しますか？")) return;
    const result = await deleteBudget(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("予算を削除しました");
    router.refresh();
  };

  const handleCopy = async () => {
    setSubmitting(true);
    const result = await copyBudgetMonth(
      costCenterId ?? null,
      fiscalYear,
      Number(copySourceMonth),
      fiscalYear,
      Number(copyTargetMonth)
    );
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.data.copied}件コピーしました（${result.data.skipped}件はスキップ）`
    );
    setCopyOpen(false);
    router.refresh();
  };

  const handlePreviewRecurring = async () => {
    setSubmitting(true);
    const result = await previewBudgetFromRecurring(
      fiscalYear,
      costCenterId ?? null
    );
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRecurringPreview(result.data);
  };

  const handleConfirmGenerate = async () => {
    setSubmitting(true);
    const result = await generateBudgetFromRecurring(
      fiscalYear,
      costCenterId ?? null
    );
    setSubmitting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.data.created}件生成しました（${result.data.skipped}件はスキップ）`
    );
    setRecurringPreview(null);
    router.refresh();
  };

  const openEdit = (budget: BudgetRow) => {
    setEditBudget(budget);
    setEditCategoryLabel(budget.categoryLabel);
    setEditAccountId(budget.accountId?.toString() ?? "");
    setEditBudgetAmount(budget.budgetAmount.toString());
    setEditMemo(budget.memo ?? "");
  };

  return (
    <div className="space-y-4">
      {/* アクションボタン */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          予算追加
        </Button>
        <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
          <Copy className="h-4 w-4 mr-1" />
          月コピー
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handlePreviewRecurring}
          disabled={submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Zap className="h-4 w-4 mr-1" />
          )}
          定期取引から自動入力
        </Button>
      </div>

      {/* 予算テーブル（カテゴリ×月マトリクス） */}
      {categories.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          予算データがありません。「予算追加」または「定期取引から自動入力」で追加してください。
        </p>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10 min-w-[160px]">
                  カテゴリ
                </th>
                {MONTHS.map((m, idx) => (
                  <th
                    key={idx}
                    className="px-3 py-2 text-right font-medium min-w-[100px]"
                  >
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium min-w-[120px]">
                  年計
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => {
                const monthMap = grouped.get(cat)!;
                let yearTotal = 0;
                return (
                  <tr
                    key={cat}
                    className="border-b hover:bg-muted/50 group/row"
                  >
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white group-hover/row:bg-muted/50 z-10">
                      {cat}
                    </td>
                    {MONTHS.map((_, idx) => {
                      const budget = monthMap.get(idx);
                      if (budget) yearTotal += budget.budgetAmount;
                      return (
                        <td
                          key={idx}
                          className="px-3 py-2 text-right whitespace-nowrap"
                        >
                          {budget ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>
                                ¥{budget.budgetAmount.toLocaleString()}
                              </span>
                              <button
                                onClick={() => openEdit(budget)}
                                className="opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(budget.id)}
                                className="opacity-0 group-hover/row:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      ¥{yearTotal.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
              {/* 合計行 */}
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10">
                  合計
                </td>
                {MONTHS.map((_, idx) => {
                  let monthTotal = 0;
                  for (const [, monthMap] of grouped) {
                    const b = monthMap.get(idx);
                    if (b) monthTotal += b.budgetAmount;
                  }
                  return (
                    <td key={idx} className="px-3 py-2 text-right whitespace-nowrap">
                      ¥{monthTotal.toLocaleString()}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  ¥
                  {budgets
                    .reduce((sum, b) => sum + b.budgetAmount, 0)
                    .toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 新規追加ダイアログ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予算追加</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>カテゴリラベル</Label>
              <Input
                value={newCategoryLabel}
                onChange={(e) => setNewCategoryLabel(e.target.value)}
                placeholder="例: 外注費、サブスク費、家賃"
              />
            </div>
            <div>
              <Label>勘定科目（任意）</Label>
              <Select value={newAccountId} onValueChange={setNewAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選択なし</SelectItem>
                  {formData.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>対象月</Label>
              <Select value={newTargetMonth} onValueChange={setNewTargetMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {fiscalYear}年{m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>予算額</Label>
              <Input
                type="number"
                value={newBudgetAmount}
                onChange={(e) => setNewBudgetAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>メモ（任意）</Label>
              <Input
                value={newMemo}
                onChange={(e) => setNewMemo(e.target.value)}
                placeholder="補足メモ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog
        open={!!editBudget}
        onOpenChange={(open) => {
          if (!open) setEditBudget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>予算編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>カテゴリラベル</Label>
              <Input
                value={editCategoryLabel}
                onChange={(e) => setEditCategoryLabel(e.target.value)}
              />
            </div>
            <div>
              <Label>勘定科目（任意）</Label>
              <Select value={editAccountId} onValueChange={setEditAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択なし" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">選択なし</SelectItem>
                  {formData.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id.toString()}>
                      {a.code} {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>予算額</Label>
              <Input
                type="number"
                value={editBudgetAmount}
                onChange={(e) => setEditBudgetAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>メモ（任意）</Label>
              <Input
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudget(null)}>
              キャンセル
            </Button>
            <Button onClick={handleEdit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 月コピーダイアログ */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月コピー</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            コピー元の月の予算をコピー先にコピーします。既存のカテゴリがある場合はスキップされます。
          </p>
          <div className="space-y-4">
            <div>
              <Label>コピー元</Label>
              <Select
                value={copySourceMonth}
                onValueChange={setCopySourceMonth}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {fiscalYear}年{m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>コピー先</Label>
              <Select
                value={copyTargetMonth}
                onValueChange={setCopyTargetMonth}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, idx) => (
                    <SelectItem key={idx} value={idx.toString()}>
                      {fiscalYear}年{m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCopy} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              コピー実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 定期取引自動生成 差分レビューダイアログ */}
      <Dialog
        open={recurringPreview !== null}
        onOpenChange={(open) => {
          if (!open) setRecurringPreview(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>定期取引からの自動生成 — 差分レビュー</DialogTitle>
          </DialogHeader>
          {recurringPreview && (
            <>
              <div className="flex gap-3 text-sm">
                <Badge variant="default">
                  新規作成: {recurringPreview.filter((p) => p.status === "create").length}件
                </Badge>
                <Badge variant="secondary">
                  スキップ（既存）: {recurringPreview.filter((p) => p.status === "skip").length}件
                </Badge>
              </div>
              <div className="overflow-auto flex-1 min-h-0 border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">状態</th>
                      <th className="px-3 py-2 text-left font-medium">カテゴリ</th>
                      <th className="px-3 py-2 text-left font-medium">対象月</th>
                      <th className="px-3 py-2 text-right font-medium">金額</th>
                      <th className="px-3 py-2 text-left font-medium">定期取引名</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurringPreview.map((item, idx) => (
                      <tr
                        key={idx}
                        className={`border-b ${
                          item.status === "skip" ? "bg-muted/30 text-muted-foreground" : ""
                        }`}
                      >
                        <td className="px-3 py-1.5">
                          <Badge
                            variant={item.status === "create" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {item.status === "create" ? "新規" : "スキップ"}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5">{item.categoryLabel}</td>
                        <td className="px-3 py-1.5">
                          {new Date(item.targetMonth).getFullYear()}年
                          {new Date(item.targetMonth).getMonth() + 1}月
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          ¥{item.budgetAmount.toLocaleString()}
                        </td>
                        <td className="px-3 py-1.5">{item.recurringName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recurringPreview.filter((p) => p.status === "create").length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  新規作成対象がありません。すべて既存のカテゴリ・月と重複しています。
                </p>
              ) : null}
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurringPreview(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmGenerate}
              disabled={
                submitting ||
                !recurringPreview ||
                recurringPreview.filter((p) => p.status === "create").length === 0
              }
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              生成実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
