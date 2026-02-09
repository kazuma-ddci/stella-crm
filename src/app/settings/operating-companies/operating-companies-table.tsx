"use client";

import { useState } from "react";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import {
  addOperatingCompany,
  updateOperatingCompany,
  deleteOperatingCompany,
} from "./actions";
import { BankAccountsModal } from "./bank-accounts-modal";
import { Landmark } from "lucide-react";

type BankAccount = {
  id: number;
  operatingCompanyId: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountHolderName: string;
  note: string | null;
};

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "companyName", header: "法人名", type: "text", required: true, simpleMode: true },
  { key: "registrationNumber", header: "登録番号(T+13桁)", type: "text" },
  { key: "representativeName", header: "代表者名", type: "text" },
  { key: "phone", header: "電話番号", type: "text" },
  { key: "postalCode", header: "郵便番号", type: "text" },
  { key: "address", header: "住所", type: "text" },
];

export function OperatingCompaniesTable({ data, canEdit }: Props) {
  const [bankAccountsModal, setBankAccountsModal] = useState<{
    open: boolean;
    companyId: number;
    companyName: string;
    bankAccounts: BankAccount[];
  }>({
    open: false,
    companyId: 0,
    companyName: "",
    bankAccounts: [],
  });

  const openBankAccountsModal = (row: Record<string, unknown>) => {
    setBankAccountsModal({
      open: true,
      companyId: row.id as number,
      companyName: row.companyName as string,
      bankAccounts: (row.bankAccounts as BankAccount[]) || [],
    });
  };

  const customActions = [
    {
      label: "銀行情報",
      icon: <Landmark className="h-4 w-4" />,
      onClick: openBankAccountsModal,
    },
  ];

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="運営法人"
        onAdd={canEdit ? addOperatingCompany : undefined}
        onUpdate={canEdit ? updateOperatingCompany : undefined}
        onDelete={canEdit ? deleteOperatingCompany : undefined}
        emptyMessage="運営法人が登録されていません"
        customActions={customActions}
      />
      <BankAccountsModal
        open={bankAccountsModal.open}
        onOpenChange={(open) => setBankAccountsModal((prev) => ({ ...prev, open }))}
        companyId={bankAccountsModal.companyId}
        companyName={bankAccountsModal.companyName}
        bankAccounts={bankAccountsModal.bankAccounts}
        canEdit={canEdit}
      />
    </>
  );
}
