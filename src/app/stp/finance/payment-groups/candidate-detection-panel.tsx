"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  Pause,
  X,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  detectTransactionCandidates,
  generateTransactions,
  decideCandidateAction,
  convertHeldCandidate,
  type TransactionCandidate,
} from "../generate/actions";

type Props = {
  expenseCategories: { id: number; name: string; type: string }[];
  onClose: () => void;
};

const TYPE_LABELS: Record<string, string> = {
  revenue: "売上",
  expense: "経費",
};

const SOURCE_LABELS: Record<string, string> = {
  crm: "CRM契約",
  recurring: "定期取引",
};

const REVENUE_TYPE_LABELS: Record<string, string> = {
  initial: "初期費用",
  monthly: "月額",
  performance: "成果報酬",
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  agent_initial: "代理店初期",
  agent_monthly: "代理店月額",
  commission_initial: "紹介報酬(初期)",
  commission_monthly: "紹介報酬(月額)",
  commission_performance: "紹介報酬(成果)",
};

function getSubTypeLabel(candidate: TransactionCandidate): string | null {
  if (candidate.stpRevenueType) {
    return REVENUE_TYPE_LABELS[candidate.stpRevenueType] ?? candidate.stpRevenueType;
  }
  if (candidate.stpExpenseType) {
    return EXPENSE_TYPE_LABELS[candidate.stpExpenseType] ?? candidate.stpExpenseType;
  }
  return null;
}

export function CandidateDetectionPanel({ onClose }: Props) {
  const router = useRouter();
  const now = new Date();
  const [targetMonth, setTargetMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [candidates, setCandidates] = useState<TransactionCandidate[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [detected, setDetected] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    skippedNoAmount: number;
  } | null>(null);
  const [holdingKey, setHoldingKey] = useState<string | null>(null);

  const changeMonth = (delta: number) => {
    const [y, m] = targetMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setTargetMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
    setCandidates([]);
    setDetected(false);
    setResult(null);
    setSelectedKeys(new Set());
  };

  const handleDetect = async () => {
    setIsDetecting(true);
    setResult(null);
    try {
      const results = await detectTransactionCandidates(targetMonth);
      setCandidates(results);
      setDetected(true);
      // 自動的に生成可能な候補を選択
      const selectableKeys = new Set<string>();
      for (const c of results) {
        if (isSelectable(c)) {
          selectableKeys.add(c.key);
        }
      }
      setSelectedKeys(selectableKeys);
    } catch (e) {
      alert(e instanceof Error ? e.message : "検出エラー");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleGenerate = async () => {
    const selected = candidates.filter((c) => selectedKeys.has(c.key));
    if (selected.length === 0) return;

    setIsGenerating(true);
    try {
      const res = await generateTransactions(selected);
      setResult(res);
      // 再検出して画面更新
      const results = await detectTransactionCandidates(targetMonth);
      setCandidates(results);
      setSelectedKeys(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "生成エラー");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHold = async (candidate: TransactionCandidate) => {
    setHoldingKey(candidate.key);
    try {
      await decideCandidateAction(
        candidate.key,
        targetMonth,
        "held",
        "timing_undecided",
        undefined
      );
      const results = await detectTransactionCandidates(targetMonth);
      setCandidates(results);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(candidate.key);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setHoldingKey(null);
    }
  };

  const handleUnhold = async (candidate: TransactionCandidate) => {
    setHoldingKey(candidate.key);
    try {
      await convertHeldCandidate(candidate.key, targetMonth);
      const results = await detectTransactionCandidates(targetMonth);
      setCandidates(results);
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラー");
    } finally {
      setHoldingKey(null);
    }
  };

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
    const selectable = candidates.filter(isSelectable);
    if (selectedKeys.size === selectable.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(selectable.map((c) => c.key)));
    }
  };

  // 生成可能な候補のみ
  const activeCandidates = candidates.filter(
    (c) =>
      !c.alreadyGenerated &&
      c.decisionStatus !== "converted" &&
      c.decisionStatus !== "dismissed"
  );
  const heldCandidates = candidates.filter(
    (c) => c.decisionStatus === "held"
  );
  const generatedCandidates = candidates.filter(
    (c) => c.alreadyGenerated || c.decisionStatus === "converted"
  );
  const pendingCandidates = activeCandidates.filter(
    (c) => c.decisionStatus !== "held"
  );

  const [y, m] = targetMonth.split("-");
  const monthLabel = `${y}年${Number(m)}月`;

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-500" />
            契約から取引候補を検出
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 月選択 + 検出ボタン */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-24 text-center">
              {monthLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleDetect}
            disabled={isDetecting}
          >
            {isDetecting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-1 h-4 w-4" />
            )}
            候補を検出
          </Button>
        </div>

        {/* 結果メッセージ */}
        {result && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            {result.created}件の取引を作成しました
            {result.updated > 0 && `（${result.updated}件更新）`}
            {result.skippedNoAmount > 0 &&
              `（金額未定: ${result.skippedNoAmount}件スキップ）`}
          </div>
        )}

        {/* 検出結果 */}
        {detected && candidates.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {monthLabel}の候補はありません
          </div>
        )}

        {detected && pendingCandidates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                新規候補（{pendingCandidates.length}件）
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={toggleSelectAll}
                >
                  {selectedKeys.size === pendingCandidates.filter(isSelectable).length
                    ? "全解除"
                    : "全選択"}
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleGenerate}
                  disabled={isGenerating || selectedKeys.size === 0}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-1 h-3 w-3" />
                  )}
                  {selectedKeys.size}件を取引化
                </Button>
              </div>
            </div>

            <div className="border rounded-lg divide-y bg-white">
              {pendingCandidates.map((c) => (
                <CandidateRow
                  key={c.key}
                  candidate={c}
                  selected={selectedKeys.has(c.key)}
                  onToggle={() => toggleSelect(c.key)}
                  onHold={() => handleHold(c)}
                  isHolding={holdingKey === c.key}
                />
              ))}
            </div>
          </div>
        )}

        {/* 保留中の候補 */}
        {detected && heldCandidates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              保留中（{heldCandidates.length}件）
            </h4>
            <div className="border rounded-lg divide-y bg-white">
              {heldCandidates.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center gap-3 px-4 py-2.5 bg-gray-50/50"
                >
                  <div className="flex-1 min-w-0">
                    <CandidateInfo candidate={c} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleUnhold(c)}
                    disabled={holdingKey === c.key}
                  >
                    {holdingKey === c.key ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    保留解除
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 生成済みの候補 */}
        {detected && generatedCandidates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              生成済み（{generatedCandidates.length}件）
            </h4>
            <div className="border rounded-lg divide-y bg-white">
              {generatedCandidates.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center gap-3 px-4 py-2.5 opacity-60"
                >
                  <div className="flex-1 min-w-0">
                    <CandidateInfo candidate={c} />
                  </div>
                  <span className="text-xs text-green-600 font-medium">
                    <Check className="inline h-3 w-3 mr-0.5" />
                    生成済み
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function isSelectable(c: TransactionCandidate): boolean {
  return (
    !c.alreadyGenerated &&
    c.decisionStatus !== "converted" &&
    c.decisionStatus !== "dismissed" &&
    c.decisionStatus !== "held" &&
    c.counterpartyId !== null &&
    !c.warningType
  );
}

function CandidateRow({
  candidate,
  selected,
  onToggle,
  onHold,
  isHolding,
}: {
  candidate: TransactionCandidate;
  selected: boolean;
  onToggle: () => void;
  onHold: () => void;
  isHolding: boolean;
}) {
  const selectable = isSelectable(candidate);
  const hasAmount = candidate.amount !== null || candidate.overrideAmount !== null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        disabled={!selectable || !hasAmount}
        className="h-4 w-4 rounded border-gray-300"
      />
      <div className="flex-1 min-w-0">
        <CandidateInfo candidate={candidate} />
        {!hasAmount && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            金額未定（取引化後に編集してください）
          </div>
        )}
        {candidate.warningType && (
          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            {candidate.warningMessage}
          </div>
        )}
      </div>
      <div className="text-right text-sm mr-2">
        <div className="font-medium">
          {candidate.overrideAmount != null
            ? `¥${candidate.overrideAmount.toLocaleString()}`
            : candidate.amount != null
            ? `¥${candidate.amount.toLocaleString()}`
            : "—"}
        </div>
        {(candidate.amount != null || candidate.overrideAmount != null) && (
          <div className="text-xs text-muted-foreground">
            税{candidate.taxRate}%
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground hover:text-amber-600"
        onClick={onHold}
        disabled={isHolding}
        title="保留"
      >
        {isHolding ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Pause className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
}

function CandidateInfo({ candidate }: { candidate: TransactionCandidate }) {
  const subType = getSubTypeLabel(candidate);

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            candidate.type === "revenue"
              ? "bg-blue-100 text-blue-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {TYPE_LABELS[candidate.type]}
        </span>
        <span className="text-sm font-medium">
          {candidate.counterpartyName || "（取引先未設定）"}
        </span>
        {subType && (
          <span className="text-xs text-muted-foreground">
            {subType}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {SOURCE_LABELS[candidate.source]}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
        <span>{candidate.expenseCategoryName}</span>
        <span>
          {candidate.periodFrom} 〜 {candidate.periodTo}
        </span>
      </div>
      {candidate.contractTitle && (
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {candidate.contractTitle}
        </div>
      )}
    </div>
  );
}
