"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  detectTransactionCandidates,
  generateTransactions,
  decideCandidateAction,
  convertHeldCandidate,
  reviveDismissedCandidate,
  acknowledgeReview,
  saveOverrideValues,
  type TransactionCandidate,
} from "./actions";

// 判定理由プリセット
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

type DecisionModalState = {
  open: boolean;
  candidateKey: string;
  targetMonth: string;
  action: "held" | "dismissed";
};

// ステータスフィルタの選択肢
type StatusFilter = "active" | "held" | "dismissed" | "needs_review" | "all";

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // override入力値（変動金額候補用）: candidateKey → values
  const [overrideInputs, setOverrideInputs] = useState<
    Record<
      string,
      {
        amount: string;
        taxRate: string;
        taxAmount: string;
        scheduledPaymentDate: string;
        memo: string;
      }
    >
  >({});
  const [overrideSaving, setOverrideSaving] = useState<string | null>(null);

  // フィルタ
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  // 判定モーダル
  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({
    open: false,
    candidateKey: "",
    targetMonth: "",
    action: "held",
  });
  const [decisionReasonType, setDecisionReasonType] = useState<string>("");
  const [decisionMemo, setDecisionMemo] = useState<string>("");

  // フィルタリング済み候補
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;

      // ステータスフィルタ
      switch (statusFilter) {
        case "active":
          // デフォルト: pending + held + needsReview（dismissed を除外）
          if (c.decisionStatus === "dismissed") return false;
          return true;
        case "held":
          return c.decisionStatus === "held";
        case "dismissed":
          return c.decisionStatus === "dismissed";
        case "needs_review":
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
      (c) => !c.alreadyGenerated && c.decisionStatus !== "dismissed" && c.decisionStatus !== "converted"
    );
    const held = candidates.filter((c) => c.decisionStatus === "held");
    const dismissed = candidates.filter((c) => c.decisionStatus === "dismissed");
    const needsReview = candidates.filter((c) => c.decisionNeedsReview);
    return {
      total: candidates.length,
      new: newCandidates.length,
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

    try {
      const result = await detectTransactionCandidates(targetMonth);
      setCandidates(result);
      // 新規（未生成・dismissed/converted でない）+ ソースデータ変更ありの候補を全て選択状態にする
      const newKeys = new Set(
        result
          .filter(
            (c) =>
              (!c.alreadyGenerated && c.decisionStatus !== "dismissed" && c.decisionStatus !== "converted") ||
              c.sourceDataChanged
          )
          .map((c) => c.key)
      );
      setSelectedKeys(newKeys);
      setDetected(true);
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
        c.decisionStatus !== "converted"
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

  // 一括生成
  const handleGenerate = async () => {
    if (selectedKeys.size === 0) return;

    const selected = candidates.filter(
      (c) =>
        selectedKeys.has(c.key) &&
        (!c.alreadyGenerated || c.sourceDataChanged) &&
        c.decisionStatus !== "dismissed" &&
        c.decisionStatus !== "converted"
    );

    if (selected.length === 0) {
      setError("確定可能な候補が選択されていません");
      return;
    }

    const newCount = selected.filter((c) => !c.alreadyGenerated).length;
    const updateCount = selected.filter(
      (c) => c.alreadyGenerated && c.sourceDataChanged
    ).length;
    const variableNoAmount = selected.filter(
      (c) => c.amount === null && (c.overrideAmount == null || c.overrideAmount <= 0)
    ).length;
    const variableWarning = variableNoAmount > 0
      ? `\n※ ${variableNoAmount}件は金額未入力のためスキップされます。`
      : "";
    const confirmMsg =
      updateCount > 0
        ? `${newCount}件を取引化し、${updateCount}件の既存取引の金額を更新します。よろしいですか？${variableWarning}`
        : `${selected.length}件を取引化します。よろしいですか？${variableWarning}`;

    if (!confirm(confirmMsg)) {
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateTransactions(selected);
      setResult(res);
      // 生成済みにマーク & ソースデータ変更フラグをリセット & decision を converted に
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
      setError(e instanceof Error ? e.message : "取引の確定に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  // 判定モーダルを開く
  const openDecisionModal = useCallback(
    (candidateKey: string, action: "held" | "dismissed") => {
      setDecisionModal({
        open: true,
        candidateKey,
        targetMonth,
        action,
      });
      setDecisionReasonType("");
      setDecisionMemo("");
    },
    [targetMonth]
  );

  // 判定を保存
  const handleDecide = async () => {
    if (!decisionReasonType) {
      setError("理由を選択してください");
      return;
    }

    setActionLoading(decisionModal.candidateKey);
    setError(null);

    try {
      const result = await decideCandidateAction(
        decisionModal.candidateKey,
        decisionModal.targetMonth,
        decisionModal.action,
        decisionReasonType,
        decisionMemo || undefined
      );

      if (!result.success) {
        setError(result.error ?? "判定の保存に失敗しました");
        return;
      }

      // ローカル状態を更新
      setCandidates((prev) =>
        prev.map((c) =>
          c.key === decisionModal.candidateKey
            ? {
                ...c,
                decisionStatus: decisionModal.action,
                decisionReasonType: decisionReasonType,
                decisionMemo: decisionMemo || null,
              }
            : c
        )
      );

      // 選択から外す
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(decisionModal.candidateKey);
        return next;
      });

      setDecisionModal((prev) => ({ ...prev, open: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "判定の保存に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  // 保留→取引化
  const handleConvertHeld = async (candidateKey: string) => {
    // 変動金額候補のoverride未入力チェック
    const target = candidates.find((c) => c.key === candidateKey);
    if (target && target.amount === null && (target.overrideAmount == null || target.overrideAmount <= 0)) {
      setError("変動金額候補は金額を入力してから取引化してください");
      return;
    }
    if (!confirm("この候補を取引化しますか？")) return;

    setActionLoading(candidateKey);
    setError(null);

    try {
      const result = await convertHeldCandidate(candidateKey, targetMonth);
      if (!result.success) {
        setError(result.error ?? "取引化に失敗しました");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.key === candidateKey
            ? { ...c, decisionStatus: "converted" as const, alreadyGenerated: true }
            : c
        )
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "取引化に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  // 不要→保留に戻す
  const handleRevive = async (candidateKey: string) => {
    setActionLoading(candidateKey);
    setError(null);

    try {
      const result = await reviveDismissedCandidate(candidateKey, targetMonth);
      if (!result.success) {
        setError(result.error ?? "復帰に失敗しました");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.key === candidateKey
            ? { ...c, decisionStatus: "held" as const, decisionReasonType: null, decisionMemo: null }
            : c
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "復帰に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  // 要再確認→確認済み
  const handleAcknowledge = async (candidateKey: string) => {
    setActionLoading(candidateKey);
    setError(null);

    try {
      const result = await acknowledgeReview(candidateKey, targetMonth);
      if (!result.success) {
        setError(result.error ?? "確認に失敗しました");
        return;
      }

      setCandidates((prev) =>
        prev.map((c) =>
          c.key === candidateKey
            ? { ...c, decisionNeedsReview: false }
            : c
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "確認に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  // override入力値の取得（DB保存済みの値をデフォルトとして使用）
  const getOverrideInput = useCallback(
    (candidate: TransactionCandidate) => {
      const existing = overrideInputs[candidate.key];
      if (existing) return existing;
      // DB保存済みの値をデフォルトとして返す
      if (candidate.overrideAmount != null) {
        return {
          amount: String(candidate.overrideAmount),
          taxRate: String(candidate.overrideTaxRate ?? 10),
          taxAmount: String(candidate.overrideTaxAmount ?? ""),
          scheduledPaymentDate: candidate.overrideScheduledPaymentDate ?? "",
          memo: candidate.overrideMemo ?? "",
        };
      }
      return {
        amount: "",
        taxRate: "10",
        taxAmount: "",
        scheduledPaymentDate: "",
        memo: "",
      };
    },
    [overrideInputs]
  );

  // override入力値の更新
  const updateOverrideInput = useCallback(
    (key: string, field: string, value: string) => {
      setOverrideInputs((prev) => {
        const current = prev[key] ?? {
          amount: "",
          taxRate: "10",
          taxAmount: "",
          scheduledPaymentDate: "",
          memo: "",
        };
        return { ...prev, [key]: { ...current, [field]: value } };
      });
    },
    []
  );

  // override値の保存
  const handleSaveOverride = async (candidate: TransactionCandidate) => {
    const input = getOverrideInput(candidate);
    const amount = parseInt(input.amount, 10);
    if (isNaN(amount) || amount <= 0) {
      setError("金額は1円以上で入力してください");
      return;
    }

    setOverrideSaving(candidate.key);
    setError(null);

    try {
      const taxRate = parseInt(input.taxRate, 10) as 0 | 8 | 10;
      const taxAmount = input.taxAmount ? parseInt(input.taxAmount, 10) : undefined;

      const result = await saveOverrideValues(candidate.key, targetMonth, {
        amount,
        taxRate: isNaN(taxRate) ? undefined : taxRate,
        taxAmount: isNaN(taxAmount as number) ? undefined : taxAmount,
        scheduledPaymentDate: input.scheduledPaymentDate || null,
        memo: input.memo || null,
      });

      if (!result.success) {
        setError(result.error ?? "保存に失敗しました");
        return;
      }

      // ローカル状態を更新
      setCandidates((prev) =>
        prev.map((c) =>
          c.key === candidate.key
            ? {
                ...c,
                overrideAmount: amount,
                overrideTaxAmount: taxAmount ?? Math.round((amount * taxRate) / (100 + taxRate)),
                overrideTaxRate: taxRate,
                overrideMemo: input.memo || null,
                overrideScheduledPaymentDate: input.scheduledPaymentDate || null,
              }
            : c
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setOverrideSaving(null);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "（変動）";
    return `¥${amount.toLocaleString()}`;
  };

  const isSelectable = (c: TransactionCandidate) =>
    (!c.alreadyGenerated || c.sourceDataChanged) &&
    c.decisionStatus !== "dismissed" &&
    c.decisionStatus !== "converted";

  const selectableCandidates = filteredCandidates.filter(isSelectable);
  const allSelectableSelected =
    selectableCandidates.length > 0 &&
    selectableCandidates.every((c) => selectedKeys.has(c.key));

  const reasonPresets =
    decisionModal.action === "held" ? HELD_REASONS : DISMISSED_REASONS;

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
          {result.skippedNoAmount > 0 && (
            <span className="text-amber-600">
              （{result.skippedNoAmount}件は金額未入力のためスキップ）
            </span>
          )}
        </div>
      )}

      {/* 検出結果 */}
      {detected && (
        <>
          {/* 統計サマリー */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
              <div className="text-xs text-muted-foreground">保留</div>
              <div className="text-lg font-bold text-yellow-600">
                {stats.held}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">不要</div>
              <div className="text-lg font-bold text-gray-400">
                {stats.dismissed}件
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">要再確認</div>
              <div className="text-lg font-bold text-orange-600">
                {stats.needsReview}件
              </div>
            </div>
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
                  <SelectValue placeholder="判定状態" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">アクティブ</SelectItem>
                  <SelectItem value="held">保留のみ</SelectItem>
                  <SelectItem value="dismissed">不要を表示</SelectItem>
                  <SelectItem value="needs_review">要再確認のみ</SelectItem>
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
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-28">状態</TableHead>
                    <TableHead className="w-44">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => {
                    const isDismissed = candidate.decisionStatus === "dismissed";
                    const isHeld = candidate.decisionStatus === "held";
                    const isConverted = candidate.decisionStatus === "converted";
                    const isLoading = actionLoading === candidate.key;

                    return (
                      <TableRow
                        key={candidate.key}
                        className={
                          isDismissed
                            ? "opacity-40 bg-gray-50"
                            : isConverted || (candidate.alreadyGenerated && !candidate.sourceDataChanged)
                              ? "opacity-50 bg-gray-50"
                              : isHeld
                                ? "bg-yellow-50/50"
                                : candidate.decisionNeedsReview
                                  ? "bg-orange-50/50"
                                  : candidate.sourceDataChanged
                                    ? "bg-amber-50/50"
                                    : ""
                        }
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedKeys.has(candidate.key)}
                            onCheckedChange={() => toggleSelect(candidate.key)}
                            disabled={!isSelectable(candidate)}
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
                          {candidate.amount === null &&
                           !isDismissed &&
                           !isConverted &&
                           !(candidate.alreadyGenerated && !candidate.sourceDataChanged) ? (
                            (() => {
                              const ov = getOverrideInput(candidate);
                              const isSaving = overrideSaving === candidate.key;
                              return (
                                <div className="flex flex-col gap-1 items-end min-w-[140px]">
                                  <Input
                                    type="number"
                                    placeholder="金額"
                                    className="w-28 h-7 text-xs text-right"
                                    value={ov.amount}
                                    onChange={(e) =>
                                      updateOverrideInput(candidate.key, "amount", e.target.value)
                                    }
                                  />
                                  <Select
                                    value={ov.taxRate}
                                    onValueChange={(v) =>
                                      updateOverrideInput(candidate.key, "taxRate", v)
                                    }
                                  >
                                    <SelectTrigger className="w-28 h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="10">税率 10%</SelectItem>
                                      <SelectItem value="8">税率 8%</SelectItem>
                                      <SelectItem value="0">非課税</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="date"
                                    placeholder="予定日"
                                    className="w-28 h-7 text-xs"
                                    value={ov.scheduledPaymentDate}
                                    onChange={(e) =>
                                      updateOverrideInput(
                                        candidate.key,
                                        "scheduledPaymentDate",
                                        e.target.value
                                      )
                                    }
                                  />
                                  <Input
                                    type="text"
                                    placeholder="メモ"
                                    className="w-28 h-7 text-xs"
                                    value={ov.memo}
                                    onChange={(e) =>
                                      updateOverrideInput(candidate.key, "memo", e.target.value)
                                    }
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => handleSaveOverride(candidate)}
                                    disabled={isSaving || !ov.amount}
                                  >
                                    {isSaving ? "保存中..." : candidate.overrideAmount ? "更新" : "保存"}
                                  </Button>
                                  {candidate.overrideAmount != null && (
                                    <span className="text-[10px] text-emerald-600">
                                      保存済: ¥{candidate.overrideAmount.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              );
                            })()
                          ) : candidate.sourceDataChanged ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-muted-foreground line-through">
                                {formatAmount(candidate.previousAmount)}
                              </span>
                              <span className="text-amber-700 font-medium">
                                {formatAmount(candidate.amount)}
                              </span>
                            </div>
                          ) : candidate.amount === null && candidate.overrideAmount != null ? (
                            <div className="flex flex-col items-end">
                              <span className="text-xs text-muted-foreground">（変動）</span>
                              <span className="font-medium">
                                ¥{candidate.overrideAmount.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            formatAmount(candidate.amount)
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {candidate.amount === null && candidate.overrideTaxAmount != null
                            ? `¥${candidate.overrideTaxAmount.toLocaleString()}`
                            : candidate.taxAmount !== null
                              ? `¥${candidate.taxAmount.toLocaleString()}`
                              : "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {candidate.periodFrom === candidate.periodTo
                            ? candidate.periodFrom
                            : `${candidate.periodFrom} 〜 ${candidate.periodTo}`}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                          {candidate.note}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {candidate.decisionNeedsReview && (
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-400 bg-orange-50"
                              >
                                要再確認
                              </Badge>
                            )}
                            {isDismissed ? (
                              <Badge
                                variant="outline"
                                className="text-gray-500 border-gray-300"
                              >
                                不要
                              </Badge>
                            ) : isHeld ? (
                              <Badge
                                variant="outline"
                                className="text-yellow-600 border-yellow-400 bg-yellow-50"
                              >
                                保留
                              </Badge>
                            ) : isConverted || candidate.alreadyGenerated ? (
                              <Badge
                                variant="outline"
                                className="text-gray-500 border-gray-300"
                              >
                                確定済み
                              </Badge>
                            ) : candidate.sourceDataChanged ? (
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-400 bg-amber-50"
                              >
                                変更あり
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-blue-600 border-blue-400"
                              >
                                新規
                              </Badge>
                            )}
                            {(isHeld || isDismissed) &&
                              candidate.decisionReasonType && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                  {candidate.decisionReasonType === "price_undecided"
                                    ? "金額未定"
                                    : candidate.decisionReasonType === "timing_undecided"
                                      ? "時期未定"
                                      : candidate.decisionReasonType === "duplicate"
                                        ? "重複"
                                        : candidate.decisionReasonType === "cancelled"
                                          ? "キャンセル"
                                          : candidate.decisionReasonType === "not_applicable"
                                            ? "対象外"
                                            : candidate.decisionMemo || "その他"}
                                </span>
                              )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {candidate.decisionNeedsReview && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-orange-600"
                                onClick={() => handleAcknowledge(candidate.key)}
                                disabled={isLoading}
                              >
                                確認済み
                              </Button>
                            )}
                            {isDismissed ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleRevive(candidate.key)}
                                disabled={isLoading}
                              >
                                保留に戻す
                              </Button>
                            ) : isHeld ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-blue-600"
                                  onClick={() => handleConvertHeld(candidate.key)}
                                  disabled={isLoading}
                                >
                                  取引化
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-gray-500"
                                  onClick={() => openDecisionModal(candidate.key, "dismissed")}
                                  disabled={isLoading}
                                >
                                  不要
                                </Button>
                              </>
                            ) : isConverted || (candidate.alreadyGenerated && !candidate.sourceDataChanged) ? null : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-yellow-600"
                                  onClick={() => openDecisionModal(candidate.key, "held")}
                                  disabled={isLoading}
                                >
                                  保留
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs text-gray-500"
                                  onClick={() => openDecisionModal(candidate.key, "dismissed")}
                                  disabled={isLoading}
                                >
                                  不要
                                </Button>
                              </>
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
        </>
      )}

      {/* 判定理由入力モーダル */}
      <Dialog
        open={decisionModal.open}
        onOpenChange={(open) =>
          setDecisionModal((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {decisionModal.action === "held" ? "保留にする" : "不要にする"}
            </DialogTitle>
            <DialogDescription>
              理由を選択してください。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">理由</label>
              <Select
                value={decisionReasonType}
                onValueChange={setDecisionReasonType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="理由を選択" />
                </SelectTrigger>
                <SelectContent>
                  {reasonPresets.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">メモ（任意）</label>
              <Textarea
                value={decisionMemo}
                onChange={(e) => setDecisionMemo(e.target.value)}
                placeholder="補足情報があれば入力"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDecisionModal((prev) => ({ ...prev, open: false }))
              }
            >
              キャンセル
            </Button>
            <Button
              onClick={handleDecide}
              disabled={!decisionReasonType || actionLoading !== null}
              variant={decisionModal.action === "dismissed" ? "destructive" : "default"}
            >
              {actionLoading
                ? "保存中..."
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
