"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CrudTable,
  type ColumnDef,
  type CustomFormFields,
  type CustomRenderers,
} from "@/components/crud-table";
import { updateContract, deleteContract } from "./actions";
import { FileUpload } from "@/components/file-upload";
import {
  FileText,
  ExternalLink,
  Plus,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContractAddModal } from "@/components/contract-add-modal";
import { ContractStatusModal } from "@/components/contract-status-management/contract-status-modal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractRowWithProgress, ContractTabType } from "@/lib/contract-status/types";
import {
  TERMINAL_STATUS_IDS,
  PROGRESS_STATUS_COUNT,
} from "@/lib/contract-status/constants";
import { cn } from "@/lib/utils";

type Props = {
  data: ContractRowWithProgress[];
  companyOptions: { value: string; label: string }[];
  statusOptions: {
    value: string;
    label: string;
    isTerminal?: boolean;
    displayOrder?: number;
  }[];
  staffOptions: { value: string; label: string }[];
  tabCounts: {
    inProgress: number;
    signed: number;
    discarded: number;
  };
};

export function ContractsTable({
  data,
  companyOptions,
  statusOptions,
  staffOptions,
  tabCounts,
}: Props) {
  const router = useRouter();
  // 契約書追加モーダルの状態
  const [addModalOpen, setAddModalOpen] = useState(false);
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
        return data.filter((c) => !c.currentStatusIsTerminal);
      case "signed":
        return data.filter(
          (c) => c.currentStatusId === TERMINAL_STATUS_IDS.SIGNED
        );
      case "discarded":
        return data.filter(
          (c) => c.currentStatusId === TERMINAL_STATUS_IDS.DISCARDED
        );
      default:
        return data;
    }
  }, [data, activeTab]);

  // 進捗バーをレンダリング
  const renderProgressBar = (row: ContractRowWithProgress) => {
    const { currentStatusDisplayOrder, currentStatusIsTerminal, currentStatusId } = row;

    // 終了ステータスの場合は進捗バーを表示しない
    if (currentStatusIsTerminal) {
      const isSigned = currentStatusId === TERMINAL_STATUS_IDS.SIGNED;
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

    // 進行中ステータスの場合は進捗バーを表示
    const currentOrder = currentStatusDisplayOrder ?? 0;
    const progress = Math.min(currentOrder / PROGRESS_STATUS_COUNT, 1);

    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentOrder}/{PROGRESS_STATUS_COUNT}
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
      key: "companyId",
      header: "企業",
      type: "select",
      options: companyOptions,
      required: true,
      searchable: true,
      simpleMode: true,
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
      type: "select",
      options: [
        { value: "新規契約", label: "新規契約" },
        { value: "更新契約", label: "更新契約" },
        { value: "追加契約", label: "追加契約" },
        { value: "変更契約", label: "変更契約" },
        { value: "解約", label: "解約" },
      ],
      required: true,
      simpleMode: true,
    },
    {
      key: "title",
      header: "契約書名",
      required: true,
      simpleMode: true,
    },
    {
      key: "contractNumber",
      header: "契約番号",
      editable: false,
    },
    {
      key: "currentStatusId",
      header: "ステータス選択",
      type: "select",
      options: statusOptions,
      searchable: true,
      simpleMode: true,
      hidden: true,
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
            simpleMode: true,
          },
          {
            key: "daysSinceStatusChange",
            header: "滞在日数",
            editable: false,
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
            type: "date" as const,
            simpleMode: true,
          },
        ]
      : []),
    {
      key: "startDate",
      header: "契約開始日",
      type: "date",
    },
    {
      key: "endDate",
      header: "契約終了日",
      type: "date",
    },
    ...(activeTab !== "signed"
      ? [
          {
            key: "signedDate",
            header: "締結日",
            type: "date" as const,
            hidden: true,
          },
        ]
      : []),
    {
      key: "signingMethod",
      header: "締結方法",
      type: "select",
      options: [
        { value: "cloudsign", label: "クラウドサイン" },
        { value: "paper", label: "紙" },
        { value: "other", label: "その他" },
      ],
    },
    {
      key: "assignedTo",
      header: "担当者選択",
      type: "multiselect",
      options: staffOptions,
      searchable: true,
      simpleMode: true,
      hidden: true,
    },
    {
      key: "assignedToName",
      header: "担当者",
      editable: false,
      simpleMode: true,
    },
    {
      key: "fileUpload",
      header: "契約書ファイル",
      editable: true,
    },
    {
      key: "filePath",
      header: "ファイルパス",
      hidden: true,
      editable: false,
    },
    {
      key: "fileName",
      header: "ファイル名",
      hidden: true,
      editable: false,
    },
    {
      key: "note",
      header: "備考",
      type: "textarea",
    },
    {
      key: "statusAction",
      header: "",
      editable: false,
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
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenStatusModal(row.id as number);
          }}
          title="ステータス管理"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      );
    },
  };

  // カスタムフォームフィールド（編集ダイアログ用）
  const customFormFields: CustomFormFields = {
    fileUpload: {
      render: (_value, _onChange, formData, setFormData) => {
        return (
          <FileUpload
            value={{
              filePath: formData.filePath as string | null,
              fileName: formData.fileName as string | null,
            }}
            onChange={(newValue) => {
              // setFormDataを使って複数フィールドを同時に更新
              setFormData({
                ...formData,
                filePath: newValue.filePath,
                fileName: newValue.fileName,
              });
            }}
            contractId={formData.id as number | undefined}
          />
        );
      },
    },
  };

  const handleUpdate = async (id: number, newData: Record<string, unknown>) => {
    await updateContract(id, newData);
  };

  const handleDelete = async (id: number) => {
    await deleteContract(id);
  };

  return (
    <>
      {/* タブ */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ContractTabType)}
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
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        customRenderers={customRenderers}
        customFormFields={customFormFields}
        customAddButton={
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            契約書を追加
          </Button>
        }
      />

      {/* 契約書追加モーダル */}
      <ContractAddModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        contractStatusOptions={statusOptions}
        staffOptions={staffOptions}
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
