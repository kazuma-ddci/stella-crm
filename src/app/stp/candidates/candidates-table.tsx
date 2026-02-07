"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { addCandidate, updateCandidate, deleteCandidate } from "./actions";
import { CompanyCodeLabel } from "@/components/company-code-label";
import { TextPreviewCell } from "@/components/text-preview-cell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
};

// 面接参加有無の選択肢
const interviewAttendanceOptions = [
  { value: "参加", label: "参加" },
  { value: "不参加", label: "不参加" },
];

// 選考状況の選択肢
const selectionStatusOptions = [
  { value: "面接日調整中", label: "面接日調整中" },
  { value: "面接日決定", label: "面接日決定" },
  { value: "選考中", label: "選考中" },
  { value: "内定", label: "内定" },
  { value: "内定承諾", label: "内定承諾" },
  { value: "辞退", label: "辞退" },
  { value: "不合格", label: "不合格" },
];

// 業種区分の選択肢
const industryTypeOptions = [
  { value: "general", label: "一般" },
  { value: "dispatch", label: "派遣" },
];

// 求人媒体の選択肢
const jobMediaOptions = [
  { value: "Indeed", label: "Indeed" },
  { value: "doda", label: "doda" },
  { value: "Wantedly", label: "Wantedly" },
  { value: "マイナビ", label: "マイナビ" },
  { value: "リクナビ", label: "リクナビ" },
];

function ContractStatusBadge({ row }: { row: Record<string, unknown> }) {
  const status = row.contractMatchStatus as string;
  const count = row.contractMatchCount as number;

  switch (status) {
    case "ok":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          契約特定済
        </Badge>
      );
    case "no_contract":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 cursor-pointer"
          onClick={() => {
            toast.error("該当する企業契約履歴がありません。企業の契約履歴を確認してください。");
          }}
        >
          該当契約なし
        </Badge>
      );
    case "multiple_contracts":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-50 text-yellow-700 border-yellow-200 cursor-pointer"
          onClick={() => {
            toast.warning(`該当する契約が${count}件あります。企業の契約履歴を編集して条件を明確にしてください。`);
          }}
        >
          複数契約（{count}件）
        </Badge>
      );
    case "incomplete":
    default:
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-400 border-gray-200">
          -
        </Badge>
      );
  }
}

export function CandidatesTable({ data, stpCompanyOptions }: Props) {
  const router = useRouter();

  // 候補者名編集モーダル
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameEditRow, setNameEditRow] = useState<Record<string, unknown> | null>(null);
  const [editLastName, setEditLastName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [nameEditLoading, setNameEditLoading] = useState(false);

  const columns: ColumnDef[] = [
    {
      key: "id",
      header: "求職者No.",
      type: "number",
      editable: false,
    },
    {
      key: "candidateName",
      header: "候補者名",
      editable: false,
    },
    {
      key: "lastName",
      header: "姓",
      type: "text",
      required: true,
      hidden: true,
    },
    {
      key: "firstName",
      header: "名",
      type: "text",
      required: true,
      hidden: true,
    },
    {
      key: "interviewDate",
      header: "面接日程",
      type: "date",
    },
    {
      key: "interviewAttendance",
      header: "面接参加有無",
      type: "select",
      options: interviewAttendanceOptions,
    },
    {
      key: "selectionStatus",
      header: "選考状況",
      type: "select",
      options: selectionStatusOptions,
    },
    {
      key: "offerDate",
      header: "内定日",
      type: "date",
    },
    {
      key: "joinDate",
      header: "入社日",
      type: "date",
    },
    {
      key: "industryType",
      header: "業種区分",
      type: "select",
      options: industryTypeOptions,
    },
    {
      key: "jobMedia",
      header: "求人媒体",
      type: "select",
      options: jobMediaOptions,
    },
    {
      key: "contractMatchStatus",
      header: "契約状態",
      editable: false,
    },
    {
      key: "note",
      header: "メモ書き",
      type: "textarea",
    },
    {
      key: "stpCompanyId",
      header: "入社先",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
    },
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "interviewDate",
      "interviewAttendance",
      "selectionStatus",
      "offerDate",
      "joinDate",
      "industryType",
      "jobMedia",
      "stpCompanyId",
    ],
    displayToEditMapping: {
      stpCompanyDisplay: "stpCompanyId",
    },
    getOptions: (_row, columnKey) => {
      if (columnKey === "interviewAttendance") {
        return interviewAttendanceOptions;
      }
      if (columnKey === "selectionStatus") {
        return selectionStatusOptions;
      }
      if (columnKey === "industryType") {
        return industryTypeOptions;
      }
      if (columnKey === "jobMedia") {
        return jobMediaOptions;
      }
      if (columnKey === "stpCompanyId") {
        return stpCompanyOptions;
      }
      return [];
    },
  };

  const handleAdd = async (formData: Record<string, unknown>) => {
    await addCandidate(formData);
  };

  const handleUpdate = async (
    id: number,
    formData: Record<string, unknown>
  ) => {
    await updateCandidate(id, formData);
  };

  const handleDelete = async (id: number) => {
    await deleteCandidate(id);
  };

  const handleNameSave = async () => {
    if (!nameEditRow) return;
    if (!editLastName.trim() || !editFirstName.trim()) {
      toast.error("姓と名は必須です");
      return;
    }
    setNameEditLoading(true);
    try {
      await updateCandidate(nameEditRow.id as number, {
        lastName: editLastName.trim(),
        firstName: editFirstName.trim(),
      });
      router.refresh();
      setNameEditOpen(false);
      toast.success("候補者名を更新しました");
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setNameEditLoading(false);
    }
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        customRenderers={{
          candidateName: (value: unknown, row: Record<string, unknown>) => {
            return (
              <span
                className="cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameEditRow(row);
                  setEditLastName((row.lastName as string) || "");
                  setEditFirstName((row.firstName as string) || "");
                  setNameEditOpen(true);
                }}
              >
                {(value as string) || "-"}
              </span>
            );
          },
          industryType: (value: unknown) => {
            if (!value) return "-";
            const option = industryTypeOptions.find((o) => o.value === value);
            return option?.label || (value as string);
          },
          jobMedia: (value: unknown) => {
            if (!value) return "-";
            return value as string;
          },
          contractMatchStatus: (_value: unknown, row: Record<string, unknown>) => {
            return <ContractStatusBadge row={row} />;
          },
          stpCompanyId: (_value: unknown, row: Record<string, unknown>) => {
            const code = row.stpCompanyCode as string | null;
            const name = row.stpCompanyDisplay as string | null;
            if (!code || !name) return "-";
            return <CompanyCodeLabel code={code} name={name} />;
          },
          note: (value: unknown, row: Record<string, unknown>) => {
            return (
              <TextPreviewCell
                text={value as string | null}
                title="メモ書き"
                onEdit={async (newValue) => {
                  await updateCandidate(row.id as number, { note: newValue });
                  router.refresh();
                }}
              />
            );
          },
        }}
      />

      {/* 候補者名編集モーダル */}
      <Dialog open={nameEditOpen} onOpenChange={setNameEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>候補者名の編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">姓 *</Label>
              <Input
                id="edit-lastName"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">名 *</Label>
              <Input
                id="edit-firstName"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNameEditOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleNameSave} disabled={nameEditLoading}>
              {nameEditLoading ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
