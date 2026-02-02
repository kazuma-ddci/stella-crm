"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomAction, CustomRenderers, DynamicOptionsMap } from "@/components/crud-table";
import { StageManagementModal } from "@/components/stage-management";
import { CompanyContactHistoryModal } from "./contact-history-modal";
import { ContractHistoryModal } from "./contract-history-modal";
import { MasterContractModal } from "@/components/master-contract-modal";
import { addStpCompany, updateStpCompany, deleteStpCompany } from "./actions";
import { BarChart3, MessageSquare, FileText, ScrollText } from "lucide-react";

type CustomerType = {
  id: number;
  name: string;
  projectId: number;
  displayOrder: number;
  project: {
    id: number;
    name: string;
    displayOrder: number;
  };
};

type Props = {
  data: Record<string, unknown>[];
  companyOptions: { value: string; label: string }[];
  stageOptions: { value: string; label: string }[];
  agentOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractStaffOptions: { value: string; label: string }[];
  leadSourceOptions: { value: string; label: string }[];
  communicationMethodOptions: { value: string; label: string }[];
  companyLocationOptions: Record<string, { value: string; label: string }[]>;
  companyContactOptions: Record<string, { value: string; label: string }[]>;
  billingAddressByCompany: Record<string, { value: string; label: string }[]>;
  billingContactByCompany: Record<string, { value: string; label: string }[]>;
  contactMethodOptions: { value: string; label: string }[];
  pendingStageId?: number;
  lostStageId?: number;
  masterContractStatusOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
};

export function StpCompaniesTable({
  data,
  companyOptions,
  stageOptions,
  agentOptions,
  staffOptions,
  contractStaffOptions,
  leadSourceOptions,
  communicationMethodOptions,
  billingAddressByCompany,
  billingContactByCompany,
  contactMethodOptions,
  pendingStageId,
  lostStageId,
  masterContractStatusOptions,
  customerTypes,
  staffByProject,
}: Props) {
  const router = useRouter();
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [contactHistoryModalOpen, setContactHistoryModalOpen] = useState(false);
  const [contractHistoryModalOpen, setContractHistoryModalOpen] = useState(false);
  const [masterContractModalOpen, setMasterContractModalOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Record<string, unknown> | null>(null);

  // 動的選択肢のマッピング
  const dynamicOptions: DynamicOptionsMap = {
    billingAddress: billingAddressByCompany,
    billingContactIds: billingContactByCompany,
  };

  const columns: ColumnDef[] = [
    // プロジェクトNo.（STP企業ID）
    { key: "id", header: "プロジェクトNo.", editable: false },
    // 企業ID（全顧客マスタから選択）
    { key: "companyId", header: "企業ID", type: "select", options: companyOptions, required: true, searchable: true, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    // 企業名
    { key: "companyName", header: "企業名", editable: false },
    // 企業メモ
    { key: "note", header: "企業メモ", type: "textarea", simpleMode: true },
    // リード獲得日
    { key: "leadAcquiredDate", header: "リード獲得日", type: "date", simpleMode: true },
    // 初回商談日
    { key: "meetingDate", header: "初回商談日", type: "date", simpleMode: true },
    // 最新接触日（後でロジック構築）
    { key: "latestContactDate", header: "最終接触日", type: "date", editable: false },
    // 現在ステージ（IDは非表示、名前のみ表示）
    { key: "currentStageId", header: "現在ステージ（選択）", type: "select", options: stageOptions, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    { key: "currentStageName", header: "現在ステージ", editable: false },
    // ネクストステージ（IDは非表示、名前のみ表示）
    { key: "nextTargetStageId", header: "ネクストステージ（選択）", type: "select", options: stageOptions, simpleMode: true, editableOnCreate: true, editableOnUpdate: false, hidden: true },
    { key: "nextTargetStageName", header: "ネクストステージ", editable: false },
    // 次回商談日コミット
    { key: "nextTargetDate", header: "次回商談日コミット", type: "date", simpleMode: true, editableOnCreate: true, editableOnUpdate: false },
    // ヨミ
    { key: "forecast", header: "ヨミ", type: "select", options: [
      { value: "MIN", label: "MIN" },
      { value: "落とし", label: "落とし" },
      { value: "MAX", label: "MAX" },
      { value: "来月", label: "来月" },
      { value: "辞退", label: "辞退" },
    ]},
    // 契約メモ
    { key: "contractNote", header: "契約メモ", type: "textarea" },
    // 業種区分
    { key: "industryType", header: "業種区分", type: "select", options: [
      { value: "一般", label: "一般" },
      { value: "派遣", label: "派遣" },
    ]},
    // 採用予定人数
    { key: "plannedHires", header: "採用予定人数", type: "number" },
    // 契約プラン（後でロジック構築・自動入力）
    { key: "contractPlan", header: "契約プラン", type: "text", editable: false },
    // 媒体
    { key: "media", header: "媒体", type: "text" },
    // 契約開始日（後でロジック構築・自動入力）
    { key: "contractStartDate", header: "契約開始日", type: "date", editable: false },
    // 契約終了日（後でロジック構築・自動入力）
    { key: "contractEndDate", header: "契約終了日", type: "date", editable: false },
    // 初期費用
    { key: "initialFee", header: "初期費用", type: "select", options: [
      { value: "0", label: "¥0" },
      { value: "100000", label: "¥100,000" },
      { value: "150000", label: "¥150,000" },
    ]},
    // 月額
    { key: "monthlyFee", header: "月額", type: "number" },
    // 成果報酬単価
    { key: "performanceFee", header: "成果報酬単価", type: "number" },
    // 担当営業（IDは非表示）
    { key: "salesStaffId", header: "担当営業（選択）", type: "select", options: staffOptions, searchable: true, hidden: true },
    { key: "salesStaffName", header: "担当営業", editable: false },
    // 担当運用（複数選択）
    { key: "operationStaffList", header: "担当運用", type: "select", options: [
      { value: "indeed", label: "indeed" },
      { value: "運用2", label: "運用2" },
      { value: "indeed,運用2", label: "indeed,運用2" },
    ]},
    // 代理店ID（非表示）
    { key: "agentId", header: "代理店（選択）", type: "select", options: agentOptions, searchable: true, hidden: true },
    // 代理店名
    { key: "agentName", header: "代理店名", editable: false },
    // 業界（全顧客マスタから表示）
    { key: "industry", header: "業界", editable: false },
    // 売上規模（全顧客マスタから表示）
    { key: "revenueScale", header: "売上規模", editable: false },
    // 企業HP（全顧客マスタから表示、リンククリック可能）
    { key: "websiteUrl", header: "企業HP", editable: false },
    // 初回KO日
    { key: "firstKoDate", header: "初回KO日", type: "date" },
    // 運用ステータス
    { key: "operationStatus", header: "運用ステータス", type: "select", options: [
      { value: "テスト1", label: "テスト1" },
      { value: "テスト2", label: "テスト2" },
    ]},
    // アカウントID
    { key: "accountId", header: "アカウントID", type: "text" },
    // アカウントPASS
    { key: "accountPass", header: "アカウントPASS", type: "text" },
    // 求人掲載開始日
    { key: "jobPostingStartDate", header: "求人掲載開始日", type: "text" },
    // 請求先住所（選択した企業の拠点住所から複数選択）
    { key: "billingAddress", header: "請求先住所", type: "multiselect", dynamicOptionsKey: "billingAddress", dependsOn: "companyId" },
    // 請求先担当者（選択用、非表示）
    { key: "billingContactIds", header: "請求先担当者（選択）", type: "multiselect", dynamicOptionsKey: "billingContactIds", dependsOn: "companyId", hidden: true },
    // 請求先担当者名（表示用）
    { key: "billingContactNames", header: "請求先担当者名", editable: false },
    // 請求先担当者メール（表示用）
    { key: "billingContactEmails", header: "請求先担当者メール", editable: false },
    // 支払いサイト
    { key: "paymentTerms", header: "支払いサイト", type: "text" },
    // 連絡方法（IDは非表示）
    { key: "communicationMethodId", header: "連絡方法（選択）", type: "select", options: communicationMethodOptions, hidden: true },
    { key: "communicationMethodName", header: "連絡方法", editable: false },
    // 検討理由（検討中ステージ以外はグレーアウト）
    { key: "pendingReason", header: "検討理由", type: "textarea" },
    // 失注理由（失注ステージ以外はグレーアウト）
    { key: "lostReason", header: "失注理由", type: "textarea" },
    // 流入経路（IDは非表示）
    { key: "leadSourceId", header: "流入経路（選択）", type: "select", options: leadSourceOptions, hidden: true },
    { key: "leadSourceName", header: "流入経路", editable: false },
  ];

  // カスタムレンダラー：企業HPをリンクとして表示、検討理由・失注理由をグレーアウト
  const customRenderers: CustomRenderers = {
    // 企業名をクリックで全顧客マスタの詳細ページへ
    companyName: (value, row) => {
      if (!value) return "-";
      const companyId = row.companyId as number;
      return (
        <Link
          href={`/companies/${companyId}`}
          className="hover:underline font-medium"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </Link>
      );
    },
    // 代理店名をクリックで全顧客マスタの詳細ページへ
    agentName: (value, row) => {
      if (!value) return "-";
      const agentCompanyId = row.agentCompanyId as number | null;
      if (!agentCompanyId) return String(value);
      return (
        <Link
          href={`/companies/${agentCompanyId}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </Link>
      );
    },
    websiteUrl: (value) => {
      if (!value || typeof value !== "string") return "-";
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      );
    },
    // 検討理由：検討中ステージ以外はグレーアウト
    pendingReason: (value, row) => {
      const currentStageId = row.currentStageId as number | null;
      const isDisabled = currentStageId !== pendingStageId;

      if (!value) {
        return (
          <span className={isDisabled ? "text-gray-300" : "text-gray-500"}>
            {isDisabled ? "(該当なし)" : "-"}
          </span>
        );
      }

      return (
        <span className={isDisabled ? "text-gray-300" : ""}>
          {String(value)}
        </span>
      );
    },
    // 失注理由：失注ステージ以外はグレーアウト
    lostReason: (value, row) => {
      const currentStageId = row.currentStageId as number | null;
      const isDisabled = currentStageId !== lostStageId;

      if (!value) {
        return (
          <span className={isDisabled ? "text-gray-300" : "text-gray-500"}>
            {isDisabled ? "(該当なし)" : "-"}
          </span>
        );
      }

      return (
        <span className={isDisabled ? "text-gray-300" : ""}>
          {String(value)}
        </span>
      );
    },
    // 請求先担当者名：縦並びで表示
    billingContactNames: (value) => {
      if (!value || typeof value !== "string") return "-";
      const names = value.split(",").filter((name) => name.trim());
      if (names.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {names.map((name, index) => (
            <div key={index} className="text-sm">{name.trim()}</div>
          ))}
        </div>
      );
    },
    // 請求先担当者メール：縦並びで表示
    billingContactEmails: (value) => {
      if (!value || typeof value !== "string") return "-";
      const emails = value.split(",").filter((email) => email.trim());
      if (emails.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {emails.map((email, index) => (
            <div key={index} className="text-sm">{email.trim()}</div>
          ))}
        </div>
      );
    },
  };

  const handleOpenStageModal = (item: Record<string, unknown>) => {
    setSelectedCompanyId(item.id as number);
    setStageModalOpen(true);
  };

  const handleOpenContactHistoryModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setContactHistoryModalOpen(true);
  };

  const handleOpenContractHistoryModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setContractHistoryModalOpen(true);
  };

  const handleOpenMasterContractModal = (item: Record<string, unknown>) => {
    setSelectedCompany(item);
    setMasterContractModalOpen(true);
  };

  const handleUpdateSuccess = () => {
    router.refresh();
  };

  const customActions: CustomAction[] = [
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "接触履歴",
      onClick: handleOpenContactHistoryModal,
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      label: "契約書",
      onClick: handleOpenMasterContractModal,
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: "契約履歴",
      onClick: handleOpenContractHistoryModal,
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      label: "ステージ管理",
      onClick: handleOpenStageModal,
    },
  ];

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="STP企業"
        onAdd={addStpCompany}
        onUpdate={updateStpCompany}
        onDelete={deleteStpCompany}
        emptyMessage="企業が登録されていません"
        enableInputModeToggle={true}
        customActions={customActions}
        customRenderers={customRenderers}
        dynamicOptions={dynamicOptions}
      />

      <StageManagementModal
        open={stageModalOpen}
        onOpenChange={setStageModalOpen}
        stpCompanyId={selectedCompanyId}
        onUpdateSuccess={handleUpdateSuccess}
      />

      {selectedCompany && (
        <CompanyContactHistoryModal
          open={contactHistoryModalOpen}
          onOpenChange={setContactHistoryModalOpen}
          stpCompanyId={selectedCompany.id as number}
          companyName={selectedCompany.companyName as string}
          contactHistories={(selectedCompany.contactHistories as Record<string, unknown>[]) || []}
          contactMethodOptions={contactMethodOptions}
          staffOptions={staffOptions}
          customerTypes={customerTypes}
          staffByProject={staffByProject}
        />
      )}

      {selectedCompany && (
        <ContractHistoryModal
          open={contractHistoryModalOpen}
          onOpenChange={setContractHistoryModalOpen}
          companyId={selectedCompany.companyId as number}
          companyName={selectedCompany.companyName as string}
        />
      )}

      {selectedCompany && (
        <MasterContractModal
          open={masterContractModalOpen}
          onOpenChange={setMasterContractModalOpen}
          companyId={selectedCompany.companyId as number}
          companyName={selectedCompany.companyName as string}
          contracts={(selectedCompany.masterContracts as Array<{
            id: number;
            contractType: string;
            title: string;
            contractNumber?: string | null;
            startDate?: string | null;
            endDate?: string | null;
            currentStatusId?: number | null;
            currentStatusName?: string | null;
            targetDate?: string | null;
            signedDate?: string | null;
            signingMethod?: string | null;
            filePath?: string | null;
            fileName?: string | null;
            assignedTo?: string | null;
            note?: string | null;
          }>) || []}
          contractStatusOptions={masterContractStatusOptions}
          staffOptions={contractStaffOptions}
        />
      )}
    </>
  );
}
