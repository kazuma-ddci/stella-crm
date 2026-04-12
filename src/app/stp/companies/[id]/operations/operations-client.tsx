"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Upload,
  Plus,
  BarChart3,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getMediaAds,
  getContractsForCompany,
  deleteMediaAd,
  type ContractWithAds,
  type MediaAdSummary,
} from "./actions";
import { CsvUploadDialog } from "./csv-upload-dialog";
import { AdFormDialog } from "./ad-form-dialog";
import { AdDetailView } from "./ad-detail-view";

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  active: { label: "配信中", variant: "bg-green-50 text-green-700 border-green-200" },
  ended: { label: "終了", variant: "bg-gray-50 text-gray-700 border-gray-200" },
  preparing: { label: "準備中", variant: "bg-blue-50 text-blue-700 border-blue-200" },
  paused: { label: "停止中", variant: "bg-yellow-50 text-yellow-700 border-yellow-200" },
};

type ContractInfo = {
  id: number;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  status: string;
  contractPlan: string;
};

export function OperationsClient({
  stpCompanyId,
  companyName,
}: {
  stpCompanyId: number;
  companyName: string;
}) {
  const [contractsWithAds, setContractsWithAds] = useState<ContractWithAds[]>([]);
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdId, setSelectedAdId] = useState<number | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [adFormOpen, setAdFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<MediaAdSummary | null>(null);
  const [collapsedContracts, setCollapsedContracts] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [adsResult, contractsResult] = await Promise.all([
        getMediaAds(stpCompanyId),
        getContractsForCompany(stpCompanyId),
      ]);
      if (adsResult.ok) setContractsWithAds(adsResult.data);
      if (contractsResult.ok) setContracts(contractsResult.data);
    } catch {
      toast.error("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [stpCompanyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteAd = async (ad: MediaAdSummary) => {
    if (!confirm(`広告「${ad.adName}」(#${ad.adNumber})を削除しますか？\n関連する日別データ・求人データもすべて削除されます。`)) {
      return;
    }
    const result = await deleteMediaAd(ad.id);
    if (result.ok) {
      toast.success("広告を削除しました");
      fetchData();
    } else {
      toast.error(result.error);
    }
  };

  const handleEditAd = (ad: MediaAdSummary) => {
    setEditingAd(ad);
    setAdFormOpen(true);
  };

  const toggleContract = (contractId: number) => {
    setCollapsedContracts((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId);
      else next.add(contractId);
      return next;
    });
  };

  // 広告詳細ビュー
  if (selectedAdId) {
    return (
      <div className="p-6">
        <AdDetailView
          adId={selectedAdId}
          onBack={() => setSelectedAdId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダ */}
      <div>
        <Link href="/stp/companies">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="mr-1 h-4 w-4" />
            企業一覧に戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{companyName} - 運用管理</h1>
      </div>

      {/* アクションボタン */}
      <div className="flex gap-2">
        <Button onClick={() => setCsvDialogOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          CSVアップロード
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setEditingAd(null);
            setAdFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          広告を追加
        </Button>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* 契約ごとの広告一覧 */}
      {!loading && contractsWithAds.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p>契約履歴がありません</p>
          <p className="text-sm mt-1">
            先に企業情報の契約管理から契約を追加してください
          </p>
        </div>
      )}

      {!loading &&
        contractsWithAds.map((contract) => {
          const isCollapsed = collapsedContracts.has(contract.id);
          return (
            <div key={contract.id} className="space-y-3">
              {/* 契約ヘッダ */}
              <button
                className="flex items-center gap-2 w-full text-left"
                onClick={() => toggleContract(contract.id)}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
                <h3 className="font-semibold text-gray-700">
                  {contract.jobMedia || "媒体未設定"}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    （{contract.contractStartDate}〜
                    {contract.contractEndDate || ""}）
                  </span>
                </h3>
                <Badge variant="outline" className="text-xs">
                  {contract.contractPlan === "monthly" ? "月額" : "成果報酬"}
                </Badge>
                {contract.ads.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {contract.ads.length}件の広告
                  </span>
                )}
              </button>

              {/* 広告リスト */}
              {!isCollapsed && (
                <div className="ml-6 space-y-2">
                  {contract.ads.length === 0 ? (
                    <p className="text-sm text-gray-400 py-3">
                      まだ広告データなし
                    </p>
                  ) : (
                    contract.ads.map((ad) => {
                      const statusInfo =
                        STATUS_LABELS[ad.status] || STATUS_LABELS.active;
                      return (
                        <Card
                          key={ad.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedAdId(ad.id)}
                        >
                          <CardContent className="py-3 px-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  <span className="font-medium truncate">
                                    {ad.adName}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    #{ad.adNumber}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${statusInfo.variant}`}
                                  >
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                                  {ad.startDate && (
                                    <span>
                                      期間: {ad.startDate}
                                      {ad.endDate ? `〜${ad.endDate}` : "〜"}
                                    </span>
                                  )}
                                  {ad.budgetLimit && (
                                    <span>
                                      予算: ¥
                                      {ad.budgetLimit.toLocaleString()}
                                    </span>
                                  )}
                                  <span>
                                    日別: {ad.dailyMetricCount}件
                                  </span>
                                  <span>
                                    求人: {ad.jobPostingCount}件
                                  </span>
                                  {ad.lastDataDate && (
                                    <span>
                                      最終更新: {ad.lastDataDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 ml-2 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditAd(ad);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAd(ad);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

      {/* CSVアップロードダイアログ */}
      <CsvUploadDialog
        open={csvDialogOpen}
        onOpenChange={setCsvDialogOpen}
        contracts={contracts}
        stpCompanyId={stpCompanyId}
        onSuccess={fetchData}
      />

      {/* 広告追加/編集ダイアログ */}
      {adFormOpen && (
        <AdFormDialog
          open={adFormOpen}
          onOpenChange={(v) => {
            setAdFormOpen(v);
            if (!v) setEditingAd(null);
          }}
          contracts={contracts}
          editingAd={editingAd}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
