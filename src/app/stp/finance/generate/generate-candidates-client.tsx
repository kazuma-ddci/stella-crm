"use client";

import { useState, useMemo } from "react";
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
  detectTransactionCandidates,
  generateTransactions,
  type TransactionCandidate,
} from "./actions";

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
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // フィルタ
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // フィルタリング済み候補
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      return true;
    });
  }, [candidates, typeFilter, sourceFilter]);

  // 統計
  const stats = useMemo(() => {
    const newCandidates = candidates.filter((c) => !c.alreadyGenerated);
    const revenue = newCandidates.filter((c) => c.type === "revenue");
    const expense = newCandidates.filter((c) => c.type === "expense");
    return {
      total: candidates.length,
      new: newCandidates.length,
      generated: candidates.length - newCandidates.length,
      revenue: revenue.length,
      expense: expense.length,
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
      // 新規（未生成）の候補を全て選択状態にする
      const newKeys = new Set(
        result.filter((c) => !c.alreadyGenerated).map((c) => c.key)
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
      (c) => !c.alreadyGenerated
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
      (c) => selectedKeys.has(c.key) && !c.alreadyGenerated
    );

    if (selected.length === 0) {
      setError("生成可能な候補が選択されていません");
      return;
    }

    if (
      !confirm(
        `${selected.length}件の取引レコードを生成します。よろしいですか？`
      )
    ) {
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateTransactions(selected);
      setResult(res);
      // 生成済みにマーク
      setCandidates((prev) =>
        prev.map((c) =>
          selectedKeys.has(c.key) ? { ...c, alreadyGenerated: true } : c
        )
      );
      setSelectedKeys(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "（変動）";
    return `¥${amount.toLocaleString()}`;
  };

  const selectableCandidates = filteredCandidates.filter(
    (c) => !c.alreadyGenerated
  );
  const allSelectableSelected =
    selectableCandidates.length > 0 &&
    selectableCandidates.every((c) => selectedKeys.has(c.key));

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
          {result.created}件の取引レコードを生成しました
          {result.skipped > 0 && `（${result.skipped}件はスキップ）`}
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
          </div>

          {/* フィルタ & アクション */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
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
                  ? "生成中..."
                  : `選択した${selectedKeys.size}件を生成`}
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.map((candidate) => (
                    <TableRow
                      key={candidate.key}
                      className={
                        candidate.alreadyGenerated
                          ? "opacity-50 bg-gray-50"
                          : ""
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys.has(candidate.key)}
                          onCheckedChange={() => toggleSelect(candidate.key)}
                          disabled={candidate.alreadyGenerated}
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
                        {formatAmount(candidate.amount)}
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
                        {candidate.alreadyGenerated ? (
                          <Badge
                            variant="outline"
                            className="text-gray-500 border-gray-300"
                          >
                            生成済み
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
