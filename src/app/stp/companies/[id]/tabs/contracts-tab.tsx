"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  ChevronDown,
  ChevronRight,
  ScrollText,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  getContractHistories,
  deleteContractHistory,
} from "../../contract-history-actions";
import { getMasterContracts } from "@/app/stp/master-contract-actions";
import { MasterContractModal } from "@/components/master-contract-modal";
import { ContractHistoryFormInline } from "./contract-history-form";

// ============================================
// 型定義
// ============================================

type ContractHistory = {
  id: number;
  companyId: number;
  industryType: string;
  contractPlan: string;
  jobMedia: string | null;
  contractStartDate: string;
  contractEndDate: string | null;
  initialFee: number;
  monthlyFee: number;
  performanceFee: number;
  salesStaffId: number | null;
  salesStaffName: string | null;
  operationStaffId: number | null;
  operationStaffName: string | null;
  status: string;
  note: string | null;
  operationStatus: string | null;
  accountId: string | null;
  accountPass: string | null;
  masterContractId: number | null;
  contractDate: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "契約中", color: "bg-green-50 text-green-700 border-green-200" },
  scheduled: { label: "契約予定", color: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelled: { label: "解約", color: "bg-red-50 text-red-700 border-red-200" },
  dormant: { label: "休眠", color: "bg-gray-50 text-gray-700 border-gray-200" },
};

const PLAN_LABELS: Record<string, string> = {
  monthly: "月額",
  performance: "成果報酬",
};

const INDUSTRY_LABELS: Record<string, string> = {
  general: "一般",
  dispatch: "派遣",
};

function formatCurrency(n: number): string {
  if (!n) return "-";
  return `¥${n.toLocaleString("ja-JP")}`;
}

type MasterContractSummary = {
  id: number;
  contractType: string | null;
  title: string | null;
  contractNumber: string | null;
  currentStatusName: string | null;
  signedDate: string | null;
  startDate: string | null;
  endDate: string | null;
  assignedTo: string | null;
  signingMethod: string | null;
  cloudsignDocumentId: string | null;
  cloudsignStatus: string | null;
  note: string | null;
  contractHistoryCount: number;
};

// ============================================
// メインコンポーネント
// ============================================

export function ContractsTab({
  companyId,
  companyName,
  staffOptions,
  contractStatusOptions = [],
  contractTypeOptions = [],
}: {
  companyId: number;
  companyName: string;
  staffOptions: { value: string; label: string }[];
  contractStatusOptions?: { value: string; label: string }[];
  contractTypeOptions?: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [histories, setHistories] = useState<ContractHistory[]>([]);
  const [masterContracts, setMasterContracts] = useState<MasterContractSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<ContractHistory | null>(null);
  const [masterContractModalOpen, setMasterContractModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [historyData, contractData] = await Promise.all([
        getContractHistories(companyId),
        getMasterContracts(companyId),
      ]);
      setHistories(historyData);
      setMasterContracts(
        contractData.map((c) => ({
          id: c.id,
          contractType: c.contractType,
          title: c.title,
          contractNumber: c.contractNumber,
          currentStatusName: c.currentStatusName,
          signedDate: c.signedDate ? c.signedDate.split("T")[0] : null,
          startDate: c.startDate ? c.startDate.split("T")[0] : null,
          endDate: c.endDate ? c.endDate.split("T")[0] : null,
          assignedTo: c.assignedTo,
          signingMethod: c.signingMethod,
          cloudsignDocumentId: c.cloudsignDocumentId,
          cloudsignStatus: c.cloudsignStatus,
          note: c.note,
          contractHistoryCount: c.contractHistories?.length || 0,
        }))
      );
    } catch {
      toast.error("契約データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: number) => {
    if (!confirm("この契約履歴を削除しますか？")) return;
    const result = await deleteContractHistory(id);
    if (result.success) {
      toast.success("契約履歴を削除しました");
      fetchData();
      router.refresh();
    } else {
      toast.error(result.error || "削除に失敗しました");
    }
  };

  const handleAdd = () => {
    setEditingHistory(null);
    setFormOpen(true);
  };

  const handleEdit = (h: ContractHistory) => {
    setEditingHistory(h);
    setFormOpen(true);
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingHistory(null);
    fetchData();
    router.refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 契約書セクション */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              契約書
              <Badge variant="secondary">{masterContracts.length}件</Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMasterContractModalOpen(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              契約書を管理
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {masterContracts.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">
              契約書がありません
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>契約番号</TableHead>
                    <TableHead>契約種別</TableHead>
                    <TableHead>タイトル</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>署名方法</TableHead>
                    <TableHead>署名日</TableHead>
                    <TableHead>開始日</TableHead>
                    <TableHead>終了日</TableHead>
                    <TableHead className="text-right">紐づく契約条件</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {masterContracts.map((mc) => (
                    <TableRow key={mc.id}>
                      <TableCell className="font-mono text-sm">{mc.contractNumber || "-"}</TableCell>
                      <TableCell>{mc.contractType || "-"}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={mc.title || ""}>
                        {mc.title || "-"}
                      </TableCell>
                      <TableCell>
                        {mc.currentStatusName ? (
                          <Badge variant="outline">{mc.currentStatusName}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {mc.signingMethod === "cloudsign" ? (
                          <span className="flex items-center gap-1 text-sm">
                            <LinkIcon className="h-3 w-3" />
                            CloudSign
                          </span>
                        ) : mc.signingMethod === "wet" ? "紙" : mc.signingMethod || "-"}
                      </TableCell>
                      <TableCell>{mc.signedDate || "-"}</TableCell>
                      <TableCell>{mc.startDate || "-"}</TableCell>
                      <TableCell>{mc.endDate || "-"}</TableCell>
                      <TableCell className="text-right">{mc.contractHistoryCount}件</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 契約履歴セクション */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          契約条件・履歴
          <Badge variant="secondary">{histories.length}件</Badge>
        </h3>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          契約条件を追加
        </Button>
      </div>

      {histories.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          契約履歴がありません
        </div>
      ) : (
        <>
          {/* テーブル表示 */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>求人媒体</TableHead>
                      <TableHead>契約プラン</TableHead>
                      <TableHead>契約開始日</TableHead>
                      <TableHead>契約終了日</TableHead>
                      <TableHead className="text-right">月額</TableHead>
                      <TableHead className="text-right">初期費用</TableHead>
                      <TableHead className="text-right">成果報酬</TableHead>
                      <TableHead>担当営業</TableHead>
                      <TableHead>担当運用</TableHead>
                      <TableHead className="w-20">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histories.map((h) => {
                      const statusInfo = STATUS_LABELS[h.status] || STATUS_LABELS.active;
                      const isExpanded = expandedId === h.id;
                      return (
                        <Fragment key={h.id}>
                          <TableRow
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => setExpandedId(isExpanded ? null : h.id)}
                          >
                            <TableCell className="p-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{h.jobMedia || "-"}</TableCell>
                            <TableCell>{PLAN_LABELS[h.contractPlan] || h.contractPlan}</TableCell>
                            <TableCell>{h.contractStartDate}</TableCell>
                            <TableCell>{h.contractEndDate || "-"}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(h.monthlyFee)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(h.initialFee)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(h.performanceFee)}</TableCell>
                            <TableCell>{h.salesStaffName || "-"}</TableCell>
                            <TableCell>{h.operationStaffName || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(h)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-700"
                                  onClick={() => handleDelete(h.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow key={`${h.id}-detail`}>
                              <TableCell colSpan={12} className="bg-gray-50/50 p-4">
                                <div className="grid gap-3 md:grid-cols-4 text-sm">
                                  <DetailItem label="業種区分" value={INDUSTRY_LABELS[h.industryType] || h.industryType} />
                                  <DetailItem label="運用ステータス" value={h.operationStatus} />
                                  <DetailItem label="アカウントID" value={h.accountId} />
                                  <DetailItem label="アカウントPASS" value={h.accountPass} />
                                  <DetailItem label="契約日（署名日）" value={h.contractDate} />
                                  <DetailItem label="備考" value={h.note} className="md:col-span-3" />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 追加・編集ダイアログ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingHistory ? "契約履歴を編集" : "契約履歴を追加"}
            </DialogTitle>
          </DialogHeader>
          <ContractHistoryFormInline
            companyId={companyId}
            editingHistory={editingHistory}
            staffOptions={staffOptions}
            onSuccess={handleFormSuccess}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 契約書管理モーダル（既存のフル機能版） */}
      <MasterContractModal
        open={masterContractModalOpen}
        onOpenChange={(v) => {
          setMasterContractModalOpen(v);
          if (!v) fetchData();
        }}
        companyId={companyId}
        companyName={companyName}
        contractStatusOptions={contractStatusOptions}
        staffOptions={staffOptions}
        contractTypeOptions={contractTypeOptions}
      />
    </div>
  );
}

// ============================================
// 詳細表示用ヘルパー
// ============================================

function DetailItem({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="text-xs text-gray-500">{label}</span>
      <div className="font-medium">{value || <span className="text-gray-400">-</span>}</div>
    </div>
  );
}
