"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, ChevronDown, ChevronRight, FileText, Link2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContractHistory, Contract } from "@/types/master-contract";
import { planLabels, industryLabels, statusLabels } from "@/types/master-contract";

// --- 契約履歴の詳細表示 ---
export function ContractHistoryDetail({
  history,
  onEdit,
  onDelete,
}: {
  history: ContractHistory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs px-1">
        <div>
          <span className="text-gray-400">業種区分:</span>{" "}
          <span className="text-gray-700">{industryLabels[history.industryType] || history.industryType}</span>
        </div>
        <div>
          <span className="text-gray-400">契約プラン:</span>{" "}
          <span className="text-gray-700">{planLabels[history.contractPlan] || history.contractPlan}</span>
        </div>
        <div>
          <span className="text-gray-400">求人媒体:</span>{" "}
          <span className="text-gray-700">{history.jobMedia || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">ステータス:</span>{" "}
          <span className="text-gray-700">{statusLabels[history.status] || history.status}</span>
        </div>
        <div>
          <span className="text-gray-400">契約開始日:</span>{" "}
          <span className="text-gray-700">{new Date(history.contractStartDate).toLocaleDateString("ja-JP")}</span>
        </div>
        <div>
          <span className="text-gray-400">契約終了日:</span>{" "}
          <span className="text-gray-700">{history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">契約日:</span>{" "}
          <span className="text-gray-700">{history.contractDate ? new Date(history.contractDate).toLocaleDateString("ja-JP") : "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">初期費用:</span>{" "}
          <span className="text-gray-700">{history.initialFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">月額:</span>{" "}
          <span className="text-gray-700">{history.monthlyFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">成果報酬単価:</span>{" "}
          <span className="text-gray-700">{history.performanceFee.toLocaleString()}円</span>
        </div>
        <div>
          <span className="text-gray-400">担当営業:</span>{" "}
          <span className="text-gray-700">{history.salesStaffName || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">担当運用:</span>{" "}
          <span className="text-gray-700">{history.operationStaffName || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">運用ステータス:</span>{" "}
          <span className="text-gray-700">{history.operationStatus || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">アカウントID:</span>{" "}
          <span className="text-gray-700">{history.accountId || "-"}</span>
        </div>
        <div>
          <span className="text-gray-400">アカウントPASS:</span>{" "}
          <span className="text-gray-700">{history.accountPass || "-"}</span>
        </div>
        {history.note && (
          <div className="col-span-2">
            <span className="text-gray-400">備考:</span>{" "}
            <span className="text-gray-700 whitespace-pre-wrap">{history.note}</span>
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          編集
        </Button>
        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          削除
        </Button>
      </div>
    </div>
  );
}

// --- ContractHistoryRow ---
export function ContractHistoryRow({
  history,
  onEdit,
  onDelete,
}: {
  history: ContractHistory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // 金額サマリーを構築
  const priceParts: string[] = [];
  if (history.monthlyFee > 0) priceParts.push(`月額${history.monthlyFee.toLocaleString()}円`);
  if (history.initialFee > 0) priceParts.push(`初期${history.initialFee.toLocaleString()}円`);
  if (history.performanceFee > 0) priceParts.push(`成果${history.performanceFee.toLocaleString()}円`);

  return (
    <div>
      <div
        className="px-4 py-2 flex items-center gap-2 hover:bg-gray-50 group cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button type="button" className="w-4 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Badge variant={history.status === "active" ? "default" : "secondary"} className="text-[10px] shrink-0">
          {statusLabels[history.status] || history.status}
        </Badge>
        <span className="text-xs text-gray-500 shrink-0">
          {planLabels[history.contractPlan] || history.contractPlan}
        </span>
        <span className="text-[10px] text-gray-300 shrink-0">|</span>
        <span className="text-xs text-gray-500 shrink-0">
          {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
          {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
        </span>
        {priceParts.length > 0 && (
          <>
            <span className="text-[10px] text-gray-300 shrink-0">|</span>
            <span className="text-xs text-gray-500 truncate">{priceParts.join(" / ")}</span>
          </>
        )}
        <div className="flex gap-1 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-3 pt-1 ml-7 border-l-2 border-gray-100">
          <ContractHistoryDetail history={history} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

// --- ContractHistoryCard (for unlinked histories) ---
export function ContractHistoryCard({
  history,
  onEdit,
  onDelete,
  contracts,
  onLink,
}: {
  history: ContractHistory & { companyId?: number };
  onEdit: () => void;
  onDelete: () => void;
  contracts: Contract[];
  onLink: (historyId: number, contractId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const priceParts: string[] = [];
  if (history.monthlyFee > 0) priceParts.push(`月額${history.monthlyFee.toLocaleString()}円`);
  if (history.initialFee > 0) priceParts.push(`初期${history.initialFee.toLocaleString()}円`);
  if (history.performanceFee > 0) priceParts.push(`成果${history.performanceFee.toLocaleString()}円`);

  return (
    <div className="border rounded-lg hover:bg-gray-50 group">
      <div
        className="px-3 py-2 flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <button type="button" className="w-4 shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <Badge variant={history.status === "active" ? "default" : "secondary"} className="text-[10px] shrink-0">
          {statusLabels[history.status] || history.status}
        </Badge>
        <span className="text-xs text-gray-500 shrink-0">
          {planLabels[history.contractPlan] || history.contractPlan}
        </span>
        <span className="text-[10px] text-gray-300 shrink-0">|</span>
        <span className="text-xs text-gray-500 shrink-0">
          {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
          {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
        </span>
        {priceParts.length > 0 && (
          <>
            <span className="text-[10px] text-gray-300 shrink-0">|</span>
            <span className="text-xs text-gray-500 truncate">{priceParts.join(" / ")}</span>
          </>
        )}
        <div className="flex gap-1 shrink-0 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          {contracts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" title="契約書に紐づける">
                  <Link2 className="h-3.5 w-3.5 text-blue-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-2 py-1.5 text-xs font-medium text-gray-500">契約書に紐づける</div>
                <DropdownMenuSeparator />
                {contracts.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => onLink(history.id, c.id)}
                  >
                    <FileText className="h-3.5 w-3.5 mr-2 text-gray-400" />
                    <span className="truncate">{c.contractNumber} {c.contractType} - {c.title}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-1 ml-7 border-t border-gray-100">
          <ContractHistoryDetail history={history} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
