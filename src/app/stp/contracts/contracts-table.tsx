"use client";

import { CrudTable, type ColumnDef } from "@/components/crud-table";
import { addContract, updateContract, deleteContract } from "./actions";

type ContractRow = {
  id: number;
  companyId: number;
  companyName: string;
  contractType: string;
  title: string;
  contractNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  currentStatusId: number | null;
  currentStatusName: string | null;
  targetDate: string | null;
  signedDate: string | null;
  signingMethod: string | null;
  filePath: string | null;
  fileName: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  data: ContractRow[];
  companyOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
};

export function ContractsTable({
  data,
  companyOptions,
  statusOptions,
  staffOptions,
}: Props) {
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
    {
      key: "targetDate",
      header: "目標日",
      type: "date",
    },
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
    {
      key: "signedDate",
      header: "締結日",
      type: "date",
    },
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
      key: "filePath",
      header: "ファイルパス",
    },
    {
      key: "fileName",
      header: "ファイル名",
    },
    {
      key: "note",
      header: "備考",
      type: "textarea",
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

  const handleAdd = async (newData: Record<string, unknown>) => {
    await addContract(newData);
  };

  const handleUpdate = async (id: number, newData: Record<string, unknown>) => {
    await updateContract(id, newData);
  };

  const handleDelete = async (id: number) => {
    await deleteContract(id);
  };

  return (
    <CrudTable
      data={data}
      columns={columns}
      onAdd={handleAdd}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      addButtonLabel="契約書を追加"
    />
  );
}
