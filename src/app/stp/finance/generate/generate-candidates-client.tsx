"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  detectTransactionCandidates,
  generateTransactions,
  decideCandidateAction,
  convertHeldCandidate,
  reviveDismissedCandidate,
  acknowledgeReview,
  saveOverrideValues,
  type TransactionCandidate,
  type ActionResult,
} from "./actions";

// ============================================
// 定数
// ============================================

type StatusFilter = "active" | "held" | "dismissed" | "needsReview" | "all";

const HELD_REASONS = [
  { value: "price_undecided", label: "金額未定" },
  { value: "timing_undecided", label: "時期未定" },
  { value: "other", label: "その他" },
] as const;

const DISMISSED_REASONS = [
  { value: "duplicate", label: "重複" },
  { value: "cancelled", label: "キャンセル" },
  { value: "not_applicable", label: "対象外" },
  { value: "other", label: "その他" },
] as const;

// ============================================
// Override入力の型
// ============================================

type OverrideInput = {
  amount: string;
  taxRate: string;
  scheduledPaymentDate: string;
  memo: string;
  saving: boolean;
  saved: boolean;
};

const defaultOverrideInput = (): OverrideInput => ({
  amount: "",
  taxRate: "10",
  scheduledPaymentDate: "",
  memo: "",
  saving: false,
  saved: false,
});

// ============================================
// メインコンポーネント
// ============================================

export function GenerateCandidatesClient() {
  const router = useRouter();

  // 対象月の初期値: 当月
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [targetMonth, setTargetMonth] = useState(defaultMonth);
  const [candidates, setCandidates] = useState<TransactionCandidate[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [detecting, setDetecting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [detected, setDetected] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    updated: number;
    skippedNoAmount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // フィルタ
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  // 判定モーダル
  const [decisionModal, setDecisionModal] = useState<{
    open: boolean;
    candidate: TransactionCandidate | null;
    action: "held" | "dismissed";
  }>({ open: false, candidate: null, action: "held" });
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionMemo, setDecisionMemo] = useState("");
  const [decidingKey, setDecidingKey] = useState<string | null>(null);

  // Override入力
  const [overrideInputs, setOverrideInputs] = useState<
    Map<string, OverrideInput>
  >(new Map());

  // Override入力ヘルパー
  const getOverrideInput = useCallback(
    (key: string): OverrideInput => {
      return overrideInputs.get(key) ?? defaultOverrideInput();
    },
    [overrideInputs]
  );

  const updateOverrideInput = useCallback(
    (key: string, field: keyof OverrideInput, value: string | boolean) => {
      setOverrideInputs((prev) => {
        const next = new Map(prev);
        const current = next.get(key) ?? defaultOverrideInput();
        next.set(key, { ...current, [field]: value, saved: false });
        return next;
      });
    },
    []
  );

  // フィルタリング済み候補
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;

      // ステータスフィルタ
      switch (statusFilter) {
        case "active":
          return (
            !c.decisionStatus ||
            c.decisionStatus === "pending" ||
            c.decisionStatus === "converted"
          );
        case "held":
          return c.decisionStatus === "held";
        case "dismissed":
          return c.decisionStatus === "dismissed";
        case "needsReview":
          return c.decisionNeedsReview;
        case "all":
          return true;
        default:
          return true;
      }
    });
  }, [candidates, typeFilter, sourceFilter, statusFilter]);

  // 統計
  const stats = useMemo(() => {
    const newCandidates = candidates.filter(
      (c) => !c.alreadyGenerated && c.decisionStatus !== "dismissed"
    );
    const revenue = newCandidates.filter((c) => c.type === "revenue");
    const expense = newCandidates.filter((c) => c.type === "expense");
    const held = candidates.filter((c) => c.decisionStatus === "held");
    const dismissed = candidates.filter(
      (c) => c.decisionStatus === "dismissed"
    );
    const needsReview = candidates.filter((c) => c.decisionNeedsReview);
    return {
      total: candidates.length,
      new: newCandidates.length,
      generated: candidates.filter((c) => c.alreadyGenerated).length,
      revenue: revenue.length,
      expense: expense.length,
      held: held.length,
      dismissed: dismissed.length,
      needsReview: needsReview.length,
    };
  }, [candidates]);

  // 候補検出
  const handleDetect = async () => {
    setDetecting(true);
    setError(null);
    setResult(null);
    setCandidates([]);
    setSelectedKeys(new Set());
    setDetected(false);
    setOverrideInputs(new Map());

    try {
      const result = await detectTransactionCandidates(targetMonth);
      setCandidates(result);
      // 新規（未生成 & dismissed でない）+ ソースデータ変更ありの候補を全て選択
      const newKeys = new Set(
        result
          .filter(
            (c) =>
              (!c.alreadyGenerated || c.sourceDataChanged) &&
              c.decisionStatus !== "dismissed" &&
              c.decisionStatus !== "held"
          )
          .map((c) => c.key)
      );
      setSelectedKeys(newKeys);
      setDetected(true);

      // 既存のoverride値をinputに反映
      const inputs = new Map<string, OverrideInput>();
      for (const c of result) {
        if (c.overrideAmount != null) {
          inputs.set(c.key, {
            amount: String(c.overrideAmount),
            taxRate: String(c.overrideTaxRate ?? 10),
            scheduledPaymentDate: c.overrideScheduledPaymentDate ?? "",
            memo: c.overrideMemo ?? "",
            saving: false,
            saved: true,
          });
        }
      }
      setOverrideInputs(inputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "検出に失敗しました");
    } finally {
      setDetecting(false);
    }
  };

  // チェック操作
  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const selectableCandidates = filteredCandidates.filter(
      (c) =>
        (!c.alreadyGenerated || c.sourceDataChanged) &&
        c.decisionStatus !== "dismissed" &&
        c.decisionStatus !== "held"
    );
    const allSelected = selectableCandidates.every((c) =>
      selectedKeys.has(c.key)
    );

    if (allSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        selectableCandidates.forEach((c) => next.delete(c.key));
        return next;
      });
    } else {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        selectableCandidates.forEach((c) => next.add(c.key));
        return next;
      });
    }
  };

  // 判定モーダル操作
  const openDecisionModal = (
    candidate: TransactionCandidate,
    action: "held" | "dismissed"
  ) => {
    setDecisionModal({ open: true, candidate, action });
    setDecisionReason("");
    setDecisionMemo("");
  };

  const handleDecision = async () => {
    if (!decisionModal.candidate) return;
    const { candidate, action } = decisionModal;

    setDecidingKey(candidate.key);
    try {
      const result = await decideCandidateAction(
        candidate.key,
        targetMonth,
        action,
        decisionReason || undefined,
        decisionMemo || undefined
      );
      if (result.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? {
                  ...c,
                  decisionStatus: action,
                  decisionReasonType: decisionReason || null,
                  decisionMemo: decisionMemo || null,
                  decisionNeedsReview: false,
                }
              : c
          )
        );
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          next.delete(candidate.key);
          return next;
        });
      } else {
        setError(result.error ?? "判定に失敗しました");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "判定に失敗しました");
    } finally {
      setDecidingKey(null);
      setDecisionModal({ open: false, candidate: null, action: "held" });
    }
  };

  // 保留→取引化可能状態に戻す
  const handleConvertHeld = async (candidate: TransactionCandidate) => {
    setDecidingKey(candidate.key);
    try {
      const result = await convertHeldCandidate(candidate.key, targetMonth);
      if (result.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? { ...c, decisionStatus: "pending", decisionNeedsReview: false }
              : c
          )
        );
      } else {
        setError(result.error ?? "操作に失敗しました");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました");
    } finally {
      setDecidingKey(null);
    }
  };

  // 不要→保留に戻す
  const handleRevive = async (candidate: TransactionCandidate) => {
    setDecidingKey(candidate.key);
    try {
      const result = await reviveDismissedCandidate(
        candidate.key,
        targetMonth
      );
      if (result.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? { ...c, decisionStatus: "held", decisionNeedsReview: false }
              : c
          )
        );
      } else {
        setError(result.error ?? "操作に失敗しました");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました");
    } finally {
      setDecidingKey(null);
    }
  };

  // 確認済みにする
  const handleAcknowledge = async (candidate: TransactionCandidate) => {
    setDecidingKey(candidate.key);
    try {
      const result = await acknowledgeReview(candidate.key, targetMonth);
      if (result.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? { ...c, decisionNeedsReview: false }
              : c
          )
        );
      } else {
        setError(result.error ?? "操作に失敗しました");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました");
    } finally {
      setDecidingKey(null);
    }
  };

  // Override保存
  const handleSaveOverride = async (candidate: TransactionCandidate) => {
    const input = getOverrideInput(candidate.key);
    const amount = parseInt(input.amount, 10);
    if (!amount || amount <= 0) {
      setError("金額は1円以上を入力してください");
      return;
    }

    updateOverrideInput(candidate.key, "saving", true);
    try {
      const result = await saveOverrideValues(candidate.key, targetMonth, {
        amount,
        taxRate: parseInt(input.taxRate, 10) || undefined,
        memo: input.memo || undefined,
        scheduledPaymentDate: input.scheduledPaymentDate || undefined,
      });
      if (result.success) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? {
                  ...c,
                  overrideAmount: amount,
                  overrideTaxRate: parseInt(input.taxRate, 10) || null,
                  overrideMemo: input.memo || null,
                  overrideScheduledPaymentDate:
                    input.scheduledPaymentDate || null,
                }
              : c
          )
        );
        setOverrideInputs((prev) => {
          const next = new Map(prev);
          const current = next.get(candidate.key) ?? defaultOverrideInput();
          next.set(candidate.key, { ...current, saving: false, saved: true });
          return next;
        });
      } else {
        setError(result.error ?? "保存に失敗しました");
        updateOverrideInput(candidate.key, "saving", false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      updateOverrideInput(candidate.key, "saving", false);
    }
  };

  // 個別取引化
  const handleGenerateSingle = async (candidate: TransactionCandidate) => {
    if (candidate.amount === null && candidate.overrideAmount === null) {
      setError("変動金額候補は金額を入力してから取引化してください");
      return;
    }

    setDecidingKey(candidate.key);
    setError(null);
    setResult(null);

    try {
      const res = await generateTransactions([candidate]);
      setResult(res);
      if (res.created > 0 || res.updated > 0) {
        setCandidates((prev) =>
          prev.map((c) =>
            c.key === candidate.key
              ? {
                  ...c,
                  alreadyGenerated: true,
                  sourceDataChanged: false,
                  decisionStatus: "converted" as const,
                }
              : c
          )
        );
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          next.delete(candidate.key);
          return next;
        });
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "取引化に失敗しました");
    } finally {
      setDecidingKey(null);
    }
  };

  // 一括取引化
  const handleGenerate = async () => {
    if (selectedKeys.size === 0) return;

    const selected = candidates.filter(
      (c) =>
        selectedKeys.has(c.key) &&
        (!c.alreadyGenerated || c.sourceDataChanged) &&
        c.decisionStatus !== "dismissed" &&
        c.decisionStatus !== "held"
    );

    if (selected.length === 0) {
      setError("取引化可能な候補が選択されていません");
      return;
    }

    // 変動金額で未入力の候補チェック
    const variableNoAmount = selected.filter(
      (c) => c.amount === null && c.overrideAmount === null
    );
    if (variableNoAmount.length > 0) {
      const msg = `変動金額の候補が${variableNoAmount.length}件、金額未入力です。未入力分はスキップされます。続行しますか？`;
      if (!confirm(msg)) return;
    }

    const newCount = selected.filter((c) => !c.alreadyGenerated).length;
    const updateCount = selected.filter(
      (c) => c.alreadyGenerated && c.sourceDataChanged
    ).length;
    const confirmMsg =
      updateCount > 0
        ? `${newCount}件の新規取引化、${updateCount}件の金額更新を行います。よろしいですか？`
        : `${selected.length}件を取引化します。よろしいですか？`;

    if (!confirm(confirmMsg)) return;

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateTransactions(selected);
      setResult(res);
      setCandidates((prev) =>
        prev.map((c) =>
          selectedKeys.has(c.key)
            ? {
                ...c,
                alreadyGenerated: true,
                sourceDataChanged: false,
                decisionStatus: "converted" as const,
              }
            : c
        )
      );
      setSelectedKeys(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "取引化に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "（変動）";
    return `¥${amount.toLocaleString()}`;
  };

  const selectableCandidates = filteredCandidates.filter(
    (c) =>
      (!c.alreadyGenerated || c.sourceDataChanged) &&
      c.decisionStatus !== "dismissed" &&
      c.decisionStatus !== "held"
  );
  const allSelectableSelected =
    selectableCandidates.length > 0 &&
    selectableCandidates.every((c) => selectedKeys.has(c.key));

  // 行の背景色
  const getRowClassName = (candidate: TransactionCandidate) => {
    if (candidate.decisionStatus === "dismissed") return "opacity-40 bg-gray-50";
    if (candidate.decisionStatus === "held") return "bg-yellow-50/50";
    if (candidate.decisionNeedsReview) return "bg-orange-50/50";
    if (candidate.alreadyGenerated && !candidate.sourceDataChanged)
      return "opacity-50 bg-gray-50";
    if (candidate.sourceDataChanged) return "bg-amber-50/50";
    return "";
  };

  return (
    <div className="space-y-4">
      {/* 対象月選択 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">対象月:</label>
          <Input
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={handleDetect} disabled={detecting || !targetMonth}>
          {detecting ? "検出中..." : "候補を検出"}
        </Button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 生成結果 */}
      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {result.created}件を取引化しました
          {result.updated > 0 && `（${result.updated}件を更新）`}
          {result.skipped > 0 && `（${result.skipped}件はスキップ）`}
          {result.skippedNoAmount > 0 &&
            `（${result.skippedNoAmount}件は金額未入力のためスキップ）`}
        </div>
      )}

      {/* 検出結果 */}
      {detected && (
        <>
          {/* 統計サマリー */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">検出合計</div>
              <div className="text-lg font-bold">{stats.total}件</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">新規候補</div>
              <div className="text-lg font-bold text-blue-600">
                {stats.new}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">生成済み</div>
              <div className="text-lg font-bold text-gray-400">
                {stats.generated}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">売上候補</div>
              <div className="text-lg font-bold text-emerald-600">
                {stats.revenue}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">経費候補</div>
              <div className="text-lg font-bold text-rose-600">
                {stats.expense}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">保留</div>
              <div className="text-lg font-bold text-yellow-600">
                {stats.held}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">不要</div>
              <div className="text-lg font-bold text-gray-500">
                {stats.dismissed}件
              </div>
            </div>
            {stats.needsReview > 0 && (
              <div className="rounded-md border border-orange-300 bg-orange-50 p-3">
                <div className="text-xs text-orange-600">要再確認</div>
                <div className="text-lg font-bold text-orange-600">
                  {stats.needsReview}件
                </div>
              </div>
            )}
          </div>

          {/* フィルタ & アクション */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="種別" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="revenue">売上</SelectItem>
                  <SelectItem value="expense">経費</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="ソース" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="crm">CRM契約</SelectItem>
                  <SelectItem value="recurring">定期取引</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="ステータス" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">アクティブ</SelectItem>
                  <SelectItem value="held">保留のみ</SelectItem>
                  <SelectItem value="dismissed">不要を表示</SelectItem>
                  <SelectItem value="needsReview">要再確認のみ</SelectItem>
                  <SelectItem value="all">すべて</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedKeys.size}件選択中
              </span>
              <Button
                onClick={handleGenerate}
                disabled={generating || selectedKeys.size === 0}
              >
                {generating
                  ? "取引化中..."
                  : `選択した${selectedKeys.size}件を取引化`}
              </Button>
            </div>
          </div>

          {/* 候補テーブル */}
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              候補が見つかりませんでした
            </div>
          ) : (
            <div className="border rounded-lg" style={{ overflow: "auto" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelectableSelected}
                        onCheckedChange={toggleSelectAll}
                        disabled={selectableCandidates.length === 0}
                      />
                    </TableHead>
                    <TableHead className="w-20">種別</TableHead>
                    <TableHead className="w-24">ソース</TableHead>
                    <TableHead>取引先</TableHead>
                    <TableHead>費目</TableHead>
                    <TableHead className="text-right">金額</TableHead>
                    <TableHead className="text-right">税額</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>プロジェクト</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-24">状態</TableHead>
                    <TableHead className="w-40">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => {
                    const isDisabled =
                      (candidate.alreadyGenerated &&
                        !candidate.sourceDataChanged) ||
                      candidate.decisionStatus === "dismissed" ||
                      candidate.decisionStatus === "held";
                    const isVariableAmount = candidate.amount === null;
                    const overrideInput = getOverrideInput(candidate.key);
                    const isProcessing = decidingKey === candidate.key;

                    return (
                      <TableRow
                        key={candidate.key}
                        className={getRowClassName(candidate)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedKeys.has(candidate.key)}
                            onCheckedChange={() => toggleSelect(candidate.key)}
                            disabled={isDisabled}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              candidate.type === "revenue"
                                ? "default"
                                : "secondary"
                            }
                            className={
                              candidate.type === "revenue"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                            }
                          >
                            {candidate.type === "revenue" ? "売上" : "経費"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {candidate.source === "crm"
                              ? "CRM契約"
                              : "定期取引"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {candidate.counterpartyName}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          {candidate.expenseCategoryName}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {candidate.sourceDataChanged ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-muted-foreground line-through">
                                {formatAmount(candidate.previousAmount)}
                              </span>
                              <span className="text-amber-700 font-medium">
                                {formatAmount(candidate.amount)}
                              </span>
                            </div>
                          ) : isVariableAmount && candidate.overrideAmount ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-muted-foreground">
                                （変動）
                              </span>
                              <span className="text-blue-700 font-medium">
                                ¥{candidate.overrideAmount.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            formatAmount(candidate.amount)
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {candidate.taxAmount !== null
                            ? `¥${candidate.taxAmount.toLocaleString()}`
                            : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {candidate.periodFrom === candidate.periodTo
                            ? candidate.periodFrom
                            : `${candidate.periodFrom} 〜 ${candidate.periodTo}`}
                        </TableCell>
                        <TableCell className="max-w-[100px] truncate">
                          {candidate.costCenterName ??
                            candidate.allocationTemplateName ??
                            "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {candidate.note}
                        </TableCell>
                        <TableCell>
                          {candidate.decisionNeedsReview && (
                            <Badge
                              variant="outline"
                              className="text-orange-600 border-orange-400 bg-orange-50 mb-1"
                            >
                              要再確認
                            </Badge>
                          )}
                          {candidate.decisionStatus === "dismissed" ? (
                            <Badge
                              variant="outline"
                              className="text-gray-500 border-gray-300"
                            >
                              不要
                            </Badge>
                          ) : candidate.decisionStatus === "held" ? (
                            <Badge
                              variant="outline"
                              className="text-yellow-600 border-yellow-400 bg-yellow-50"
                            >
                              保留
                            </Badge>
                          ) : candidate.decisionStatus === "converted" ? (
                            <Badge
                              variant="outline"
                              className="text-green-600 border-green-400"
                            >
                              取引化済
                            </Badge>
                          ) : candidate.sourceDataChanged ? (
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-400 bg-amber-50"
                            >
                              変更あり
                            </Badge>
                          ) : candidate.alreadyGenerated ? (
                            <Badge
                              variant="outline"
                              className="text-gray-500 border-gray-300"
                            >
                              生成済み
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-blue-600 border-blue-400"
                            >
                              新規
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {candidate.decisionStatus === "dismissed" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRevive(candidate)}
                                disabled={isProcessing}
                                className="text-xs h-7 px-2"
                              >
                                保留に戻す
                              </Button>
                            ) : candidate.decisionStatus === "held" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConvertHeld(candidate)}
                                disabled={isProcessing}
                                className="text-xs h-7 px-2"
                              >
                                取引化可能に
                              </Button>
                            ) : (
                              <>
                                {!candidate.alreadyGenerated &&
                                  candidate.decisionStatus !== "converted" && (
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() =>
                                          handleGenerateSingle(candidate)
                                        }
                                        disabled={
                                          isProcessing ||
                                          (candidate.amount === null &&
                                            candidate.overrideAmount === null)
                                        }
                                        className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-700"
                                      >
                                        取引化
                                      </Button>
                                      <div className="flex flex-col gap-0.5">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            openDecisionModal(candidate, "held")
                                          }
                                          disabled={isProcessing}
                                          className="text-[11px] h-[15px] px-1.5 border-yellow-400 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700 rounded-sm"
                                        >
                                          保留
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            openDecisionModal(
                                              candidate,
                                              "dismissed"
                                            )
                                          }
                                          disabled={isProcessing}
                                          className="text-[11px] h-[15px] px-1.5 border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-sm"
                                        >
                                          不要
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                              </>
                            )}
                            {candidate.decisionNeedsReview && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAcknowledge(candidate)}
                                disabled={isProcessing}
                                className="text-xs h-7 px-2.5 border-orange-400 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                              >
                                確認済み
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* 変動金額候補の入力エリア */}
          {candidates.some(
            (c) =>
              c.amount === null &&
              c.decisionStatus !== "dismissed" &&
              c.decisionStatus !== "converted"
          ) && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-sm">
                変動金額候補の金額入力
              </h3>
              <p className="text-xs text-muted-foreground">
                変動金額の候補は、金額を入力してから取引化してください。未入力のまま生成するとスキップされます。
              </p>
              {candidates
                .filter(
                  (c) =>
                    c.amount === null &&
                    c.decisionStatus !== "dismissed" &&
                    c.decisionStatus !== "converted"
                )
                .map((candidate) => {
                  const input = getOverrideInput(candidate.key);
                  return (
                    <div
                      key={candidate.key}
                      className="border rounded-md p-3 space-y-2 bg-gray-50"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Badge
                          variant={
                            candidate.type === "revenue"
                              ? "default"
                              : "secondary"
                          }
                          className={
                            candidate.type === "revenue"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }
                        >
                          {candidate.type === "revenue" ? "売上" : "経費"}
                        </Badge>
                        <span className="font-medium">
                          {candidate.counterpartyName}
                        </span>
                        <span className="text-muted-foreground">
                          {candidate.note}
                        </span>
                        {input.saved && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-400"
                          >
                            保存済み
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs">金額（税抜）</Label>
                          <Input
                            type="number"
                            min="1"
                            value={input.amount}
                            onChange={(e) =>
                              updateOverrideInput(
                                candidate.key,
                                "amount",
                                e.target.value
                              )
                            }
                            placeholder="0"
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">税率 (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={input.taxRate}
                            onChange={(e) =>
                              updateOverrideInput(
                                candidate.key,
                                "taxRate",
                                e.target.value
                              )
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">支払予定日</Label>
                          <Input
                            type="date"
                            value={input.scheduledPaymentDate}
                            onChange={(e) =>
                              updateOverrideInput(
                                candidate.key,
                                "scheduledPaymentDate",
                                e.target.value
                              )
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">メモ</Label>
                          <Input
                            value={input.memo}
                            onChange={(e) =>
                              updateOverrideInput(
                                candidate.key,
                                "memo",
                                e.target.value
                              )
                            }
                            placeholder="任意"
                            className="h-8"
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveOverride(candidate)}
                        disabled={input.saving || !input.amount}
                        className="h-7"
                      >
                        {input.saving ? "保存中..." : "金額を保存"}
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* 判定モーダル */}
      <Dialog
        open={decisionModal.open}
        onOpenChange={(open) =>
          !open &&
          setDecisionModal({ open: false, candidate: null, action: "held" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionModal.action === "held"
                ? "候補を保留にする"
                : "候補を不要にする"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {decisionModal.candidate && (
              <div className="text-sm text-muted-foreground">
                {decisionModal.candidate.counterpartyName} -{" "}
                {decisionModal.candidate.note}
              </div>
            )}
            <div className="space-y-2">
              <Label>理由</Label>
              <Select value={decisionReason} onValueChange={setDecisionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="理由を選択" />
                </SelectTrigger>
                <SelectContent>
                  {(decisionModal.action === "held"
                    ? HELD_REASONS
                    : DISMISSED_REASONS
                  ).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>メモ（任意）</Label>
              <Textarea
                value={decisionMemo}
                onChange={(e) => setDecisionMemo(e.target.value)}
                placeholder="補足情報があれば入力してください"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDecisionModal({
                  open: false,
                  candidate: null,
                  action: "held",
                })
              }
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDecision}
              disabled={decidingKey !== null}
              variant={
                decisionModal.action === "dismissed"
                  ? "destructive"
                  : "default"
              }
            >
              {decidingKey !== null
                ? "処理中..."
                : decisionModal.action === "held"
                  ? "保留にする"
                  : "不要にする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
