"use client";

import { useState } from "react";
import Link from "next/link";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { addCompany, updateCompany, deleteCompany } from "./actions";
import { ContactsModal } from "./contacts-modal";
import { Building2 } from "lucide-react";

type Location = {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  note: string | null;
};

type Contact = {
  id: number;
  name: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  note: string | null;
};

type StaffOption = {
  value: string;
  label: string;
};

type Props = {
  data: Record<string, unknown>[];
  staffOptions: StaffOption[];
};

const createColumns = (staffOptions: StaffOption[]): ColumnDef[] => [
  { key: "companyCode", header: "企業コード", editable: false },
  { key: "name", header: "企業名", type: "text", required: true },
  { key: "staffId", header: "担当者", type: "select", options: staffOptions, searchable: true },
  { key: "industry", header: "業界", type: "text" },
  { key: "revenueScale", header: "売上規模", type: "text" },
  { key: "websiteUrl", header: "企業HP", type: "text" },
  // 拠点情報カラム
  { key: "locationName", header: "拠点名", editable: false, filterable: false },
  { key: "locationPhone", header: "拠点電話", editable: false, filterable: false },
  { key: "locationEmail", header: "拠点メール", editable: false, filterable: false },
  { key: "locationAddress", header: "拠点住所", editable: false, filterable: false },
  { key: "locationNote", header: "拠点備考", editable: false, filterable: false },
  // 担当者情報カラム
  { key: "contactName", header: "担当者名", editable: false, filterable: false },
  { key: "contactDepartment", header: "担当部署", editable: false, filterable: false },
  { key: "contactEmail", header: "担当者メール", editable: false, filterable: false },
  { key: "contactPhone", header: "担当者電話番号", editable: false, filterable: false },
  { key: "contactNote", header: "担当者備考", editable: false, filterable: false },
  // 企業メモ
  { key: "note", header: "メモ", type: "textarea" },
];

// 複数行表示用のヘルパーコンポーネント
function MultiLineCell({
  items,
  render,
}: {
  items: { isPrimary: boolean; value: React.ReactNode }[];
  render?: (item: { isPrimary: boolean; value: React.ReactNode }) => React.ReactNode;
}) {
  if (items.length === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="space-y-1 py-1">
      {items.map((item, index) => (
        <div
          key={index}
          className={`text-sm ${item.isPrimary ? "font-bold" : ""}`}
        >
          {render ? render(item) : item.value}
        </div>
      ))}
    </div>
  );
}

export function CompaniesTable({ data, staffOptions }: Props) {
  const columns = createColumns(staffOptions);
  const [contactsModal, setContactsModal] = useState<{
    open: boolean;
    companyId: number;
    companyName: string;
    locations: Record<string, unknown>[];
    contacts: Record<string, unknown>[];
  }>({
    open: false,
    companyId: 0,
    companyName: "",
    locations: [],
    contacts: [],
  });

  const openContactsModal = (row: Record<string, unknown>) => {
    setContactsModal({
      open: true,
      companyId: row.id as number,
      companyName: row.name as string,
      locations: (row.locations as Record<string, unknown>[]) || [],
      contacts: (row.contacts as Record<string, unknown>[]) || [],
    });
  };

  const customActions = [
    {
      label: "連絡先管理",
      icon: <Building2 className="h-4 w-4" />,
      onClick: openContactsModal,
    },
  ];

  // カスタムレンダラー
  const customRenderers = {
    // 企業コードをクリックで詳細ページへ
    companyCode: (value: unknown, row: Record<string, unknown>) => {
      if (!value) return "-";
      const id = row.id as number;
      return (
        <Link
          href={`/companies/${id}`}
          className="hover:underline font-mono"
        >
          {String(value)}
        </Link>
      );
    },
    // 企業名をクリックで詳細ページへ
    name: (value: unknown, row: Record<string, unknown>) => {
      if (!value) return "-";
      const id = row.id as number;
      return (
        <Link
          href={`/companies/${id}`}
          className="hover:underline font-medium"
        >
          {String(value)}
        </Link>
      );
    },
    staffId: (value: unknown) => {
      if (!value) return <span className="text-muted-foreground">-</span>;
      const option = staffOptions.find((o) => o.value === String(value));
      return option?.label || "-";
    },
    websiteUrl: (value: unknown) => {
      if (!value) return "-";
      const url = value as string;
      return (
        <a
          href={url.startsWith("http") ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline truncate max-w-[150px] block"
        >
          {url}
        </a>
      );
    },
    // 拠点名
    locationName: (_value: unknown, row: Record<string, unknown>) => {
      const locations = (row.locations as Location[]) || [];
      const items = locations.map((loc) => ({
        isPrimary: loc.isPrimary,
        value: loc.name,
      }));
      return <MultiLineCell items={items} />;
    },
    // 拠点電話
    locationPhone: (_value: unknown, row: Record<string, unknown>) => {
      const locations = (row.locations as Location[]) || [];
      const items = locations.map((loc) => ({
        isPrimary: loc.isPrimary,
        value: loc.phone || <span className="text-muted-foreground">-</span>,
      }));
      return <MultiLineCell items={items} />;
    },
    // 拠点メール
    locationEmail: (_value: unknown, row: Record<string, unknown>) => {
      const locations = (row.locations as Location[]) || [];
      const items = locations.map((loc) => ({
        isPrimary: loc.isPrimary,
        value: loc.email ? (
          <a href={`mailto:${loc.email}`} className="hover:underline">
            {loc.email}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      }));
      return <MultiLineCell items={items} />;
    },
    // 拠点住所
    locationAddress: (_value: unknown, row: Record<string, unknown>) => {
      const locations = (row.locations as Location[]) || [];
      const items = locations.map((loc) => ({
        isPrimary: loc.isPrimary,
        value: loc.address ? (
          <span className="truncate max-w-[150px] block" title={loc.address}>
            {loc.address}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      }));
      return <MultiLineCell items={items} />;
    },
    // 拠点備考
    locationNote: (_value: unknown, row: Record<string, unknown>) => {
      const locations = (row.locations as Location[]) || [];
      const items = locations.map((loc) => ({
        isPrimary: loc.isPrimary,
        value: loc.note ? (
          <span className="truncate max-w-[100px] block text-muted-foreground" title={loc.note}>
            {loc.note}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      }));
      return <MultiLineCell items={items} />;
    },
    // 担当者名
    contactName: (_value: unknown, row: Record<string, unknown>) => {
      const contacts = (row.contacts as Contact[]) || [];
      const items = contacts.map((contact) => ({
        isPrimary: contact.isPrimary,
        value: contact.name,
      }));
      return <MultiLineCell items={items} />;
    },
    // 担当部署
    contactDepartment: (_value: unknown, row: Record<string, unknown>) => {
      const contacts = (row.contacts as Contact[]) || [];
      const items = contacts.map((contact) => ({
        isPrimary: contact.isPrimary,
        value: contact.department || <span className="text-muted-foreground">-</span>,
      }));
      return <MultiLineCell items={items} />;
    },
    // 担当者メール
    contactEmail: (_value: unknown, row: Record<string, unknown>) => {
      const contacts = (row.contacts as Contact[]) || [];
      const items = contacts.map((contact) => ({
        isPrimary: contact.isPrimary,
        value: contact.email ? (
          <a href={`mailto:${contact.email}`} className="hover:underline">
            {contact.email}
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      }));
      return <MultiLineCell items={items} />;
    },
    // 担当者電話
    contactPhone: (_value: unknown, row: Record<string, unknown>) => {
      const contacts = (row.contacts as Contact[]) || [];
      const items = contacts.map((contact) => ({
        isPrimary: contact.isPrimary,
        value: contact.phone || <span className="text-muted-foreground">-</span>,
      }));
      return <MultiLineCell items={items} />;
    },
    // 担当者備考
    contactNote: (_value: unknown, row: Record<string, unknown>) => {
      const contacts = (row.contacts as Contact[]) || [];
      const items = contacts.map((contact) => ({
        isPrimary: contact.isPrimary,
        value: contact.note ? (
          <span className="truncate max-w-[100px] block text-muted-foreground" title={contact.note}>
            {contact.note}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      }));
      return <MultiLineCell items={items} />;
    },
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="顧客"
        onAdd={addCompany}
        onUpdate={updateCompany}
        onDelete={deleteCompany}
        emptyMessage="顧客が登録されていません"
        customActions={customActions}
        customRenderers={customRenderers}
      />
      <ContactsModal
        open={contactsModal.open}
        onOpenChange={(open) => setContactsModal((prev) => ({ ...prev, open }))}
        companyId={contactsModal.companyId}
        companyName={contactsModal.companyName}
        locations={contactsModal.locations}
        contacts={contactsModal.contacts}
      />
    </>
  );
}
