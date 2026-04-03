"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, FileText, Link2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentContractHistory, Contract } from "@/types/master-contract";
import { statusLabels } from "@/types/master-contract";

// --- 代理店契約履歴の報酬サマリー ---
export function formatAgentCommissionSummary(h: AgentContractHistory): string {
  const lines: string[] = [];
  const mpParts: string[] = [];
  if (h.defaultMpInitialType === "fixed" && h.defaultMpInitialFixed != null) {
    mpParts.push(`初期¥${h.defaultMpInitialFixed.toLocaleString()}`);
  } else if (h.defaultMpInitialRate != null) {
    mpParts.push(`初期${h.defaultMpInitialRate}%`);
  }
  if (h.defaultMpMonthlyType === "rate" && h.defaultMpMonthlyRate != null) {
    mpParts.push(`月額${h.defaultMpMonthlyRate}%${h.defaultMpMonthlyDuration ? `(${h.defaultMpMonthlyDuration}ヶ月)` : ""}`);
  } else if (h.defaultMpMonthlyType === "fixed" && h.defaultMpMonthlyFixed != null) {
    mpParts.push(`月額¥${h.defaultMpMonthlyFixed.toLocaleString()}${h.defaultMpMonthlyDuration ? `(${h.defaultMpMonthlyDuration}ヶ月)` : ""}`);
  }
  if (mpParts.length > 0) lines.push(`MP: ${mpParts.join(" / ")}`);

  const ppParts: string[] = [];
  if (h.defaultPpInitialType === "fixed" && h.defaultPpInitialFixed != null) {
    ppParts.push(`初期¥${h.defaultPpInitialFixed.toLocaleString()}`);
  } else if (h.defaultPpInitialRate != null) {
    ppParts.push(`初期${h.defaultPpInitialRate}%`);
  }
  if (h.defaultPpPerfType === "rate" && h.defaultPpPerfRate != null) {
    ppParts.push(`成果${h.defaultPpPerfRate}%${h.defaultPpPerfDuration ? `(${h.defaultPpPerfDuration}ヶ月)` : ""}`);
  } else if (h.defaultPpPerfType === "fixed" && h.defaultPpPerfFixed != null) {
    ppParts.push(`成果¥${h.defaultPpPerfFixed.toLocaleString()}${h.defaultPpPerfDuration ? `(${h.defaultPpPerfDuration}ヶ月)` : ""}`);
  } else if (h.defaultPpPerfRate != null) {
    ppParts.push(`成果${h.defaultPpPerfRate}%${h.defaultPpPerfDuration ? `(${h.defaultPpPerfDuration}ヶ月)` : ""}`);
  }
  if (ppParts.length > 0) lines.push(`PP: ${ppParts.join(" / ")}`);
  return lines.join(" / ");
}

// --- 代理店契約履歴の行表示（契約書カード内） ---
export function AgentContractHistoryRow({
  history,
  onEdit,
  onDelete,
}: {
  history: AgentContractHistory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const commSummary = formatAgentCommissionSummary(history);
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={history.status === "active" ? "default" : "secondary"} className="text-[10px]">
            {statusLabels[history.status] || history.status}
          </Badge>
          <span className="text-xs text-gray-500">
            {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
            {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
          {history.initialFee != null && history.initialFee > 0 && <span>初期(経費): ¥{history.initialFee.toLocaleString()}</span>}
          {history.monthlyFee != null && history.monthlyFee > 0 && <span>月額(経費): ¥{history.monthlyFee.toLocaleString()}</span>}
          {commSummary && <span>{commSummary}</span>}
        </div>
        {history.note && <div className="text-xs text-gray-400 mt-0.5">{history.note}</div>}
      </div>
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
      </div>
    </div>
  );
}

// --- 代理店契約履歴カード（紐づかない履歴用） ---
export function AgentContractHistoryCard({
  history,
  onEdit,
  onDelete,
  contracts,
  onLink,
}: {
  history: AgentContractHistory;
  onEdit: () => void;
  onDelete: () => void;
  contracts: Contract[];
  onLink: (historyId: number, contractId: number) => void;
}) {
  const commSummary = formatAgentCommissionSummary(history);
  return (
    <div className="border rounded-lg hover:bg-gray-50 group p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={history.status === "契約済み" ? "default" : "secondary"} className="text-[10px]">
              {history.status}
            </Badge>
            <span className="text-xs text-gray-500">
              {new Date(history.contractStartDate).toLocaleDateString("ja-JP")}〜
              {history.contractEndDate ? new Date(history.contractEndDate).toLocaleDateString("ja-JP") : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            {history.initialFee != null && history.initialFee > 0 && <span>初期費用: ¥{history.initialFee.toLocaleString()}</span>}
            {history.monthlyFee != null && history.monthlyFee > 0 && <span>月額: ¥{history.monthlyFee.toLocaleString()}</span>}
            {commSummary && <span>{commSummary}</span>}
          </div>
          {history.note && <div className="text-xs text-gray-400 mt-0.5">{history.note}</div>}
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  <DropdownMenuItem key={c.id} onClick={() => onLink(history.id, c.id)}>
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
    </div>
  );
}
