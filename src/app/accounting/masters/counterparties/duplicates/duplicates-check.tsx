"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Merge, RefreshCw, X } from "lucide-react";
import type { DuplicatePair, MergeImpact } from "../actions";
import {
  detectDuplicates,
  getCounterpartyMergeImpact,
  mergeCounterparties,
} from "../actions";

const TYPE_LABELS: Record<string, string> = {
  customer: "顧客",
  vendor: "仕入先",
  service: "サービス",
  other: "その他",
};

type Props = {
  initialPairs: DuplicatePair[];
};

export function DuplicatesCheck({ initialPairs }: Props) {
  const router = useRouter();
  const [pairs, setPairs] = useState<DuplicatePair[]>(initialPairs);
  const [dismissedPairs, setDismissedPairs] = useState<Set<string>>(new Set());
  const [isRefreshing, startRefresh] = useTransition();
  const [impactDialog, setImpactDialog] = useState<{
    open: boolean;
    impact: MergeImpact | null;
    loading: boolean;
    sourceId: number;
    targetId: number;
  }>({
    open: false,
    impact: null,
    loading: false,
    sourceId: 0,
    targetId: 0,
  });
  const [isMerging, setIsMerging] = useState(false);

  const pairKey = (id1: number, id2: number) =>
    `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;

  const visiblePairs = pairs.filter(
    (p) => !dismissedPairs.has(pairKey(p.id1, p.id2))
  );

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        const newPairs = await detectDuplicates();
        setPairs(newPairs);
        setDismissedPairs(new Set());
        toast.success("重複チェックを再実行しました");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "重複チェックに失敗しました"
        );
      }
    });
  };

  const handleDismiss = (id1: number, id2: number) => {
    setDismissedPairs((prev) => new Set(prev).add(pairKey(id1, id2)));
    toast.info("このペアを「別物」として除外しました");
  };

  const handleMergeClick = async (sourceId: number, targetId: number) => {
    setImpactDialog({
      open: true,
      impact: null,
      loading: true,
      sourceId,
      targetId,
    });

    try {
      const result = await getCounterpartyMergeImpact(sourceId, targetId);
      if (!result.ok) {
        toast.error(result.error);
        setImpactDialog({
          open: false,
          impact: null,
          loading: false,
          sourceId: 0,
          targetId: 0,
        });
        return;
      }
      setImpactDialog((prev) => ({ ...prev, impact: result.data, loading: false }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "影響範囲の確認に失敗しました"
      );
      setImpactDialog({
        open: false,
        impact: null,
        loading: false,
        sourceId: 0,
        targetId: 0,
      });
    }
  };

  const handleMergeExecute = async () => {
    if (!impactDialog.impact) return;
    setIsMerging(true);

    try {
      const result = await mergeCounterparties(
        impactDialog.sourceId,
        impactDialog.targetId
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `統合が完了しました（${result.data.totalUpdated}件のレコードを付替え）`
      );
      setImpactDialog({
        open: false,
        impact: null,
        loading: false,
        sourceId: 0,
        targetId: 0,
      });
      // ペア一覧を更新
      const newPairs = await detectDuplicates();
      setPairs(newPairs);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "統合に失敗しました"
      );
    } finally {
      setIsMerging(false);
    }
  };

  const { impact } = impactDialog;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            正規化名（全角/半角、カタカナ/ひらがな統一）で比較し、類似する取引先ペアを表示します。
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            再チェック
          </Button>
        </div>

        {visiblePairs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            重複候補は見つかりませんでした
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>取引先A</TableHead>
                <TableHead>種別A</TableHead>
                <TableHead>CRM企業A</TableHead>
                <TableHead>取引先B</TableHead>
                <TableHead>種別B</TableHead>
                <TableHead>CRM企業B</TableHead>
                <TableHead className="text-right">アクション</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePairs.map((pair) => (
                <TableRow key={pairKey(pair.id1, pair.id2)}>
                  <TableCell className="font-medium">
                    {pair.name1}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (#{pair.id1})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABELS[pair.type1] ?? pair.type1}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pair.companyName1 ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {pair.name2}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (#{pair.id2})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {TYPE_LABELS[pair.type2] ?? pair.type2}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pair.companyName2 ?? (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMergeClick(pair.id1, pair.id2)}
                        title={`「${pair.name1}」を「${pair.name2}」に統合`}
                      >
                        <Merge className="mr-1 h-3.5 w-3.5" />
                        統合
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(pair.id1, pair.id2)}
                        title="別物として扱う"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        別物
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 統合前 影響範囲確認ダイアログ */}
      <Dialog
        open={impactDialog.open}
        onOpenChange={(open) => {
          if (!open && !isMerging) {
            setImpactDialog({
              open: false,
              impact: null,
              loading: false,
              sourceId: 0,
              targetId: 0,
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>取引先の統合</DialogTitle>
            <DialogDescription>
              統合前に影響範囲を確認してください
            </DialogDescription>
          </DialogHeader>

          {impactDialog.loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                影響範囲を確認中...
              </span>
            </div>
          ) : impact ? (
            <div className="space-y-4">
              {/* 統合方向の表示 */}
              <div className="flex items-center justify-center gap-3 rounded-lg bg-muted p-4">
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">統合元</div>
                  <div className="font-medium">{impact.source.name}</div>
                  <Badge variant="outline" className="mt-1">
                    {TYPE_LABELS[impact.source.counterpartyType] ??
                      impact.source.counterpartyType}
                  </Badge>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-center">
                  <div className="text-sm text-muted-foreground">統合先</div>
                  <div className="font-medium">{impact.target.name}</div>
                  <Badge variant="outline" className="mt-1">
                    {TYPE_LABELS[impact.target.counterpartyType] ??
                      impact.target.counterpartyType}
                  </Badge>
                </div>
              </div>

              {/* 統合方向切替ボタン */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleMergeClick(impactDialog.targetId, impactDialog.sourceId)
                  }
                  disabled={isMerging}
                >
                  統合方向を逆にする
                </Button>
              </div>

              {/* 影響件数テーブル */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>対象テーブル</TableHead>
                    <TableHead className="text-right">影響件数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>取引（Transaction）</TableCell>
                    <TableCell className="text-right">
                      {impact.transactionCount}件
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>定期取引（RecurringTransaction）</TableCell>
                    <TableCell className="text-right">
                      {impact.recurringTransactionCount}件
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>自動仕訳ルール（AutoJournalRule）</TableCell>
                    <TableCell className="text-right">
                      {impact.autoJournalRuleCount}件
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>請求（InvoiceGroup）</TableCell>
                    <TableCell className="text-right">
                      {impact.invoiceGroupCount}件
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>支払（PaymentGroup）</TableCell>
                    <TableCell className="text-right">
                      {impact.paymentGroupCount}件
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell>合計</TableCell>
                    <TableCell className="text-right">
                      {impact.totalAffected}件
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* 重複ルール警告 */}
              {impact.duplicateRuleWarning && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>自動仕訳ルールの重複</AlertTitle>
                  <AlertDescription>
                    統合元・統合先の両方に自動仕訳ルールが設定されています。統合後にルールの重複が発生する可能性があります。統合後に確認してください。
                  </AlertDescription>
                </Alert>
              )}

              {impact.totalAffected > 0 && (
                <p className="text-sm text-muted-foreground">
                  上記{impact.totalAffected}
                  件のレコードの取引先が「{impact.source.name}」から「
                  {impact.target.name}」に付け替えられます。統合元の「
                  {impact.source.name}」は論理削除されます。
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setImpactDialog({
                  open: false,
                  impact: null,
                  loading: false,
                  sourceId: 0,
                  targetId: 0,
                })
              }
              disabled={isMerging}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={handleMergeExecute}
              disabled={isMerging || impactDialog.loading || !impact}
            >
              {isMerging ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  統合実行中...
                </>
              ) : (
                "統合を実行"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
