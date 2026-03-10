"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CrudTable,
  type ColumnDef,
  type CustomRenderers,
} from "@/components/crud-table";
import { CompanyCodeLabel } from "@/components/company-code-label";
import {
  FileText,
  ExternalLink,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractStatusModal } from "@/components/contract-status-management/contract-status-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractRowWithProgress, ContractTabType } from "@/lib/contract-status/types";
import { getProgressStatusCount } from "@/lib/contract-status/constants";
import { cn } from "@/lib/utils";

type Props = {
  data: ContractRowWithProgress[];
  tabCounts: {
    inProgress: number;
    signed: number;
    discarded: number;
  };
  progressStatusCount: number;
};

export function ContractsTable({
  data,
  tabCounts,
  progressStatusCount,
}: Props) {
  const router = useRouter();
  // ステータス管理モーダルの状態
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(
    null
  );
  // 現在のタブ
  const [activeTab, setActiveTab] = useState<ContractTabType>("in_progress");

  // タブに応じてデータをフィルタリング
  const filteredData = useMemo(() => {
    switch (activeTab) {
      case "in_progress":
        return data.filter(
          (c) => c.currentStatusType === "progress" || c.currentStatusType === "pending" || (!c.currentStatusType && !c.currentStatusIsTerminal)
        );
      case "signed":
        return data.filter((c) => c.currentStatusType === "signed");
      case "discarded":
        return data.filter((c) => c.currentStatusType === "discarded");
      default:
        return data;
    }
  }, [data, activeTab]);

  // 進捗バーをレンダリング
  const renderProgressBar = (row: ContractRowWithProgress) => {
    const { currentStatusDisplayOrder, currentStatusType } = row;

    // 終了ステータスの場合は進捗バーを表示しない
    if (currentStatusType === "signed" || currentStatusType === "discarded") {
      const isSigned = currentStatusType === "signed";
      return (
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            isSigned ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}
        >
          {isSigned ? "締結済み" : "破棄"}
        </span>
      );
    }

    // 保留ステータスの場合
    if (currentStatusType === "pending") {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
          保留中
        </span>
      );
    }

    // 進行中ステータスの場合は進捗バーを表示
    const currentOrder = currentStatusDisplayOrder ?? 0;
    const progress = progressStatusCount > 0 ? Math.min(currentOrder / progressStatusCount, 1) : 0;

    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentOrder}/{progressStatusCount}
        </span>
      </div>
    );
  };

  // ステータス管理ボタン
  const handleOpenStatusModal = (contractId: number) => {
    setSelectedContractId(contractId);
    setStatusModalOpen(true);
  };

  // ステータス更新成功時のコールバック
  const handleStatusUpdateSuccess = () => {
    router.refresh();
  };

  const columns: ColumnDef[] = [
    {
      key: "id",
      header: "ID",
      editable: false,
      hidden: true,
    },
    {
      key: "companyName",
      header: "企業名",
      editable: false,
      simpleMode: true,
    },
    {
      key: "contractType",
      header: "契約種別",
      editable: false,
      simpleMode: true,
    },
    {
      key: "title",
      header: "契約書名",
      editable: false,
      simpleMode: true,
    },
    {
      key: "contractNumber",
      header: "契約番号",
      editable: false,
    },
    {
      key: "currentStatusName",
      header: "ステータス",
      editable: false,
      simpleMode: true,
    },
    // 進行中タブのみ進捗を表示
    ...(activeTab === "in_progress"
      ? [
          {
            key: "progress",
            header: "進捗",
            editable: false,
            filterable: false,
            simpleMode: true,
          },
          {
            key: "daysSinceStatusChange",
            header: "滞在日数",
            editable: false,
            filterable: false,
            simpleMode: true,
          },
        ]
      : []),
    // 締結済みタブのみ締結日を表示
    ...(activeTab === "signed"
      ? [
          {
            key: "signedDate",
            header: "締結日",
            editable: false,
            simpleMode: true,
          },
        ]
      : []),
    {
      key: "assignedToName",
      header: "担当者",
      editable: false,
      simpleMode: true,
    },
    {
      key: "fileUpload",
      header: "契約書ファイル",
      editable: false,
      filterable: false,
    },
    {
      key: "note",
      header: "備考",
      editable: false,
    },
    {
      key: "statusAction",
      header: "ステータス変更",
      editable: false,
      filterable: false,
      simpleMode: true,
    },
    {
      key: "createdAt",
      header: "作成日",
      editable: false,
    },
    {
      key: "updatedAt",
      header: "更新日",
      editable: false,
    },
  ];

  // カスタムレンダラー（テーブル表示用）
  const customRenderers: CustomRenderers = {
    companyName: (value, row) => {
      if (!value) return "-";
      const companyCode = row.companyCode as string;
      return companyCode
        ? <CompanyCodeLabel code={companyCode} name={String(value)} />
        : String(value);
    },
    fileUpload: (_value, row) => {
      const filePath = row.filePath as string | null;
      const fileName = row.fileName as string | null;
      if (!filePath || !fileName) return "-";
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(filePath, "_blank")}
          className="flex items-center gap-1"
        >
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="max-w-[120px] truncate">{fileName}</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      );
    },
    progress: (_value, row) => {
      return renderProgressBar(row as unknown as ContractRowWithProgress);
    },
    daysSinceStatusChange: (_value, row) => {
      const contractRow = row as unknown as ContractRowWithProgress;
      const { daysSinceStatusChange, hasStaleAlert } = contractRow;

      if (daysSinceStatusChange === null) return "-";

      return (
        <div className="flex items-center gap-1">
          {hasStaleAlert && (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          )}
          <span
            className={cn(
              "text-sm",
              hasStaleAlert && "text-yellow-600 font-medium"
            )}
          >
            {daysSinceStatusChange}日
          </span>
        </div>
      );
    },
    statusAction: (_value, row) => {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenStatusModal(row.id as number);
          }}
          className="flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          <span className="text-xs">変更</span>
        </Button>
      );
    },
  };

  return (
    <>
      {/* タブ */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ContractTabType)}
        idBase="stp-contracts-tabs"
        className="mb-4"
      >
        <TabsList>
          <TabsTrigger value="in_progress">
            進行中
            <span className="ml-1 text-muted-foreground">
              ({tabCounts.inProgress})
            </span>
          </TabsTrigger>
          <TabsTrigger value="signed">
            締結済み
            <span className="ml-1 text-muted-foreground">
              ({tabCounts.signed})
            </span>
          </TabsTrigger>
          <TabsTrigger value="discarded">
            破棄
            <span className="ml-1 text-muted-foreground">
              ({tabCounts.discarded})
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <CrudTable
        data={filteredData as unknown as Record<string, unknown>[]}
        columns={columns}
        customRenderers={customRenderers}
      />

      {/* ステータス管理モーダル */}
      <ContractStatusModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        contractId={selectedContractId}
        onUpdateSuccess={handleStatusUpdateSuccess}
      />
    </>
  );
}
