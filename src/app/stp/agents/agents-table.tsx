"use client";

import { useState } from "react";
import Link from "next/link";
import { CrudTable, ColumnDef, CustomAction, CustomRenderers } from "@/components/crud-table";
import { addAgent, updateAgent, deleteAgent } from "./actions";
import { ContractsModal } from "./contracts-modal";
import { ContactHistoryModal } from "./contact-history-modal";
import { MasterContractModal } from "@/components/master-contract-modal";
import { FileText, MessageSquare, ScrollText } from "lucide-react";

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
  companyOptions: { value: string; label: string; disabled?: boolean }[];
  referrerOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractStaffOptions: { value: string; label: string }[];
  contactMethodOptions: { value: string; label: string }[];
  masterContractStatusOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
};

// ステータス選択肢
const statusOptions = [
  { value: "アクティブ", label: "アクティブ" },
  { value: "休止", label: "休止" },
  { value: "解約", label: "解約" },
];

// 区分①選択肢
const category1Options = [
  { value: "代理店", label: "代理店" },
  { value: "顧問", label: "顧問" },
];

// 区分②選択肢
const category2Options = [
  { value: "法人", label: "法人" },
  { value: "個人", label: "個人" },
];

// 契約ステータス選択肢
const contractStatusOptions = [
  { value: "契約済み", label: "契約済み" },
  { value: "商談済み", label: "商談済み" },
  { value: "未商談", label: "未商談" },
  { value: "日程調整中", label: "日程調整中" },
];

export function AgentsTable({
  data,
  companyOptions,
  referrerOptions,
  staffOptions,
  contractStaffOptions,
  contactMethodOptions,
  masterContractStatusOptions,
  customerTypes,
  staffByProject,
}: Props) {
  const [contractsModalOpen, setContractsModalOpen] = useState(false);
  const [contactHistoryModalOpen, setContactHistoryModalOpen] = useState(false);
  const [masterContractModalOpen, setMasterContractModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Record<string, unknown> | null>(null);

  const columns: ColumnDef[] = [
    { key: "id", header: "代理店No.", editable: false },
    {
      key: "companyId",
      header: "代理店",
      type: "select",
      options: companyOptions,
      searchable: true,
      required: true,
      editableOnUpdate: false, // 編集時は変更不可
      hidden: true,
    },
    { key: "companyName", header: "代理店名", editable: false, filterable: true },
    { key: "companyEmail", header: "メールアドレス", editable: false },
    { key: "companyPhone", header: "電話番号", editable: false },
    {
      key: "status",
      header: "ステータス",
      type: "select",
      options: statusOptions,
      required: true,
    },
    {
      key: "category1",
      header: "区分①",
      type: "select",
      options: category1Options,
      required: true,
    },
    {
      key: "category2",
      header: "区分②",
      type: "select",
      options: category2Options,
      required: true,
    },
    { key: "meetingDate", header: "商談日", type: "date" },
    {
      key: "contractStatus",
      header: "契約ステータス",
      type: "select",
      options: contractStatusOptions,
    },
    { key: "contractNote", header: "契約内容メモ", type: "textarea" },
    {
      key: "staffAssignments",
      header: "担当者",
      type: "select",
      options: staffOptions,
      searchable: true,
      hidden: true,
    },
    { key: "staffNames", header: "担当者", editable: false },
    {
      key: "referrerCompanyId",
      header: "紹介者",
      type: "select",
      options: referrerOptions,
      searchable: true,
      hidden: true,
    },
    { key: "referrerCompanyName", header: "紹介者", editable: false },
    { key: "note", header: "代理店メモ", type: "textarea" },
    { key: "latestContactDate", header: "最終接触日", type: "date", editable: false },
    { key: "contractCount", header: "契約書", editable: false },
    { key: "createdAt", header: "作成日", type: "datetime", editable: false, hidden: true },
    { key: "updatedAt", header: "更新日", type: "datetime", editable: false, hidden: true },
  ];

  // カスタムレンダラー：担当者を縦並びで表示、代理店名・紹介者にリンク
  const customRenderers: CustomRenderers = {
    // 代理店名をクリックで全顧客マスタの詳細ページへ
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
    // 紹介者をクリックで全顧客マスタの詳細ページへ
    referrerCompanyName: (value, row) => {
      if (!value) return "-";
      const referrerCompanyId = row.referrerCompanyId as number | null;
      if (!referrerCompanyId) return String(value);
      return (
        <Link
          href={`/companies/${referrerCompanyId}`}
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {String(value)}
        </Link>
      );
    },
    staffNames: (value) => {
      if (!value || typeof value !== "string") return "-";
      const names = value.split(",").map((name) => name.trim()).filter((name) => name);
      if (names.length === 0) return "-";

      return (
        <div className="flex flex-col gap-1">
          {names.map((name, index) => (
            <div key={index} className="text-sm">{name}</div>
          ))}
        </div>
      );
    },
  };

  const customActions: CustomAction[] = [
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "接触履歴",
      onClick: (item) => {
        setSelectedAgent(item);
        setContactHistoryModalOpen(true);
      },
    },
    {
      icon: <ScrollText className="h-4 w-4" />,
      label: "契約書",
      onClick: (item) => {
        setSelectedAgent(item);
        setMasterContractModalOpen(true);
      },
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: "旧契約書",
      onClick: (item) => {
        setSelectedAgent(item);
        setContractsModalOpen(true);
      },
    },
  ];

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="代理店"
        onAdd={addAgent}
        onUpdate={updateAgent}
        onDelete={deleteAgent}
        emptyMessage="代理店が登録されていません"
        customActions={customActions}
        customRenderers={customRenderers}
      />

      {selectedAgent && (
        <>
          <ContractsModal
            open={contractsModalOpen}
            onOpenChange={setContractsModalOpen}
            agentId={selectedAgent.id as number}
            agentName={selectedAgent.companyName as string}
            contracts={(selectedAgent.contracts as Record<string, unknown>[]) || []}
          />
          <ContactHistoryModal
            open={contactHistoryModalOpen}
            onOpenChange={setContactHistoryModalOpen}
            agentId={selectedAgent.id as number}
            agentName={selectedAgent.companyName as string}
            contactHistories={(selectedAgent.contactHistories as Record<string, unknown>[]) || []}
            contactMethodOptions={contactMethodOptions}
            staffOptions={staffOptions}
            customerTypes={customerTypes}
            staffByProject={staffByProject}
          />
          <MasterContractModal
            open={masterContractModalOpen}
            onOpenChange={setMasterContractModalOpen}
            companyId={selectedAgent.companyId as number}
            companyName={selectedAgent.companyName as string}
            contracts={(selectedAgent.masterContracts as Array<{
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
        </>
      )}
    </>
  );
}
