"use client";

import { useState } from "react";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import {
  addOperatingCompany,
  updateOperatingCompany,
  deleteOperatingCompany,
} from "./actions";
import { BankAccountsModal } from "./bank-accounts-modal";
import { EmailsModal, CompanyEmail } from "./emails-modal";
import { LogoUploadModal } from "./logo-upload-modal";
import { Landmark, Mail, ImageIcon } from "lucide-react";

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
  isDefault: boolean;
};

type Props = {
  data: Record<string, unknown>[];
  canEdit: boolean;
};

const columns: ColumnDef[] = [
  { key: "id", header: "ID", editable: false, hidden: true },
  { key: "companyName", header: "法人名", type: "text", required: true, simpleMode: true },
  { key: "abbreviation", header: "略称", type: "text" },
  { key: "registrationNumber", header: "登録番号(T+13桁)", type: "text" },
  { key: "invoicePrefix", header: "請求書番号プレフィックス", type: "text" },
  {
    key: "paymentMonthOffset",
    header: "支払月",
    type: "select",
    options: [
      { value: "", label: "未設定" },
      { value: "0", label: "当月" },
      { value: "1", label: "翌月" },
      { value: "2", label: "翌々月" },
      { value: "3", label: "3ヶ月後" },
    ],
  },
  {
    key: "paymentDay",
    header: "支払日",
    type: "select",
    options: [
      { value: "", label: "未設定" },
      { value: "0", label: "末日" },
      { value: "5", label: "5日" },
      { value: "10", label: "10日" },
      { value: "15", label: "15日" },
      { value: "20", label: "20日" },
      { value: "25", label: "25日" },
    ],
  },
  { key: "cloudsignClientId", header: "クラウドサインAPI", type: "text" },
  { key: "emailList", header: "メール", editable: false, filterable: false },
  { key: "bankAccountList", header: "銀行口座", editable: false, filterable: false },
  { key: "representativeName", header: "代表者名", type: "text" },
  { key: "phone", header: "電話番号", type: "text" },
  { key: "postalCode", header: "郵便番号", type: "text" },
  { key: "address", header: "住所1", type: "text" },
  { key: "address2", header: "住所2", type: "text" },
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

  const [emailsModal, setEmailsModal] = useState<{
    open: boolean;
    companyId: number;
    companyName: string;
    emails: CompanyEmail[];
  }>({
    open: false,
    companyId: 0,
    companyName: "",
    emails: [],
  });

  const [logoModal, setLogoModal] = useState<{
    open: boolean;
    companyId: number;
    companyName: string;
    logoPath: string | null;
  }>({
    open: false,
    companyId: 0,
    companyName: "",
    logoPath: null,
  });

  const openBankAccountsModal = (row: Record<string, unknown>) => {
    setBankAccountsModal({
      open: true,
      companyId: row.id as number,
      companyName: row.companyName as string,
      bankAccounts: (row.bankAccounts as BankAccount[]) || [],
    });
  };

  const openEmailsModal = (row: Record<string, unknown>) => {
    setEmailsModal({
      open: true,
      companyId: row.id as number,
      companyName: row.companyName as string,
      emails: (row.emails as CompanyEmail[]) || [],
    });
  };

  const openLogoModal = (row: Record<string, unknown>) => {
    setLogoModal({
      open: true,
      companyId: row.id as number,
      companyName: row.companyName as string,
      logoPath: (row.logoPath as string) || null,
    });
  };

  const customRenderers: CustomRenderers = {
    emailList: (_value: unknown, row: Record<string, unknown>) => {
      const emails = (row.emails as CompanyEmail[]) || [];
      if (emails.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="space-y-1 py-1">
          {emails.map((e) => (
            <div key={e.id} className={`text-sm ${e.isDefault ? "font-bold" : ""}`}>
              {e.email}
            </div>
          ))}
        </div>
      );
    },
    bankAccountList: (_value: unknown, row: Record<string, unknown>) => {
      const accounts = (row.bankAccounts as BankAccount[]) || [];
      if (accounts.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="space-y-1 py-1">
          {accounts.map((ba) => (
            <div key={ba.id} className={`text-sm ${ba.isDefault ? "font-bold" : ""}`}>
              {ba.bankName} {ba.branchName} {ba.accountNumber}
            </div>
          ))}
        </div>
      );
    },
  };

  const customActions = [
    {
      label: "ロゴ",
      icon: <ImageIcon className="h-4 w-4" />,
      onClick: openLogoModal,
    },
    {
      label: "メール",
      icon: <Mail className="h-4 w-4" />,
      onClick: openEmailsModal,
    },
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
        customRenderers={customRenderers}
      />
      <BankAccountsModal
        open={bankAccountsModal.open}
        onOpenChange={(open) => setBankAccountsModal((prev) => ({ ...prev, open }))}
        companyId={bankAccountsModal.companyId}
        companyName={bankAccountsModal.companyName}
        bankAccounts={bankAccountsModal.bankAccounts}
        canEdit={canEdit}
      />
      <EmailsModal
        open={emailsModal.open}
        onOpenChange={(open) => setEmailsModal((prev) => ({ ...prev, open }))}
        companyId={emailsModal.companyId}
        companyName={emailsModal.companyName}
        emails={emailsModal.emails}
        canEdit={canEdit}
      />
      <LogoUploadModal
        open={logoModal.open}
        onOpenChange={(open) => setLogoModal((prev) => ({ ...prev, open }))}
        companyId={logoModal.companyId}
        companyName={logoModal.companyName}
        logoPath={logoModal.logoPath}
        canEdit={canEdit}
      />
    </>
  );
}
