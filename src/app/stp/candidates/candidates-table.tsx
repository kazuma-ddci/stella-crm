"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { addCandidate, updateCandidate, deleteCandidate, restoreCandidate } from "./actions";
import { CompanyCodeLabel } from "@/components/company-code-label";
import { TextPreviewCell } from "@/components/text-preview-cell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

type ContractOption = {
  industryType: string;
  jobMedia: string | null;
};

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  contractOptionsByStpCompany: Record<string, ContractOption[]>;
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

// 業種区分のラベルマッピング
const industryTypeLabelMap: Record<string, string> = {
  general: "一般",
  dispatch: "派遣",
};

// 削除済み表示フィルタの選択肢
type DeletedFilter = "active" | "include_deleted" | "deleted_only";

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

export function CandidatesTable({ data, stpCompanyOptions, contractOptionsByStpCompany }: Props) {
  const router = useRouter();

  // 削除済みフィルタ
  const [deletedFilter, setDeletedFilter] = useState<DeletedFilter>("active");

  // 候補者名編集モーダル
  const [nameEditOpen, setNameEditOpen] = useState(false);
  const [nameEditRow, setNameEditRow] = useState<Record<string, unknown> | null>(null);
  const [editLastName, setEditLastName] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [nameEditLoading, setNameEditLoading] = useState(false);

  // 全企業分の動的選択肢を事前構築
  const dynamicOptions = useMemo(() => {
    const industryTypeByCompany: Record<string, { value: string; label: string }[]> = {};
    const jobMediaByIndustryType: Record<string, { value: string; label: string }[]> = {};

    for (const [stpCompanyId, contracts] of Object.entries(contractOptionsByStpCompany)) {
      // 企業ごとの業種区分
      const types = new Set<string>();
      for (const c of contracts) {
        types.add(c.industryType);
      }
      industryTypeByCompany[stpCompanyId] = Array.from(types).map((t) => ({
        value: t,
        label: industryTypeLabelMap[t] || t,
      }));

      // 業種区分ごとの求人媒体（全企業分を集約）
      for (const c of contracts) {
        if (!jobMediaByIndustryType[c.industryType]) {
          jobMediaByIndustryType[c.industryType] = [];
        }
        if (c.jobMedia && !jobMediaByIndustryType[c.industryType].find((o) => o.value === c.jobMedia)) {
          jobMediaByIndustryType[c.industryType].push({ value: c.jobMedia, label: c.jobMedia });
        }
      }
    }

    // ソート
    for (const key of Object.keys(jobMediaByIndustryType)) {
      jobMediaByIndustryType[key].sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
    }

    return { industryTypeByCompany, jobMediaByIndustryType };
  }, [contractOptionsByStpCompany]);

  // 企業の契約から業種区分の選択肢を取得（インライン編集用）
  const getIndustryTypeOptions = useCallback(
    (stpCompanyId: string | null | undefined) => {
      if (!stpCompanyId) return [];
      return dynamicOptions.industryTypeByCompany[stpCompanyId] || [];
    },
    [dynamicOptions]
  );

  // 企業＋業種区分から求人媒体の選択肢を取得（インライン編集用）
  const getJobMediaOptions = useCallback(
    (stpCompanyId: string | null | undefined, industryType: string | null | undefined) => {
      if (!stpCompanyId || !industryType) return [];
      const contracts = contractOptionsByStpCompany[stpCompanyId] || [];
      const mediaSet = new Set<string>();
      for (const c of contracts) {
        if (c.industryType === industryType && c.jobMedia) {
          mediaSet.add(c.jobMedia);
        }
      }
      return Array.from(mediaSet)
        .sort()
        .map((m) => ({ value: m, label: m }));
    },
    [contractOptionsByStpCompany]
  );

  // 削除済みフィルタ適用
  const filteredData = useMemo(() => {
    switch (deletedFilter) {
      case "active":
        return data.filter((d) => !d.deletedAt);
      case "deleted_only":
        return data.filter((d) => !!d.deletedAt);
      case "include_deleted":
      default:
        return data;
    }
  }, [data, deletedFilter]);

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
      key: "stpCompanyId",
      header: "企業",
      type: "select",
      options: stpCompanyOptions,
      searchable: true,
      required: true,
    },
    {
      key: "sendDate",
      header: "送客日",
      type: "date",
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
      key: "joinConfirmed",
      header: "入社確定",
      editable: false,
    },
    {
      key: "industryType",
      header: "業種区分",
      type: "select",
      dependsOn: "stpCompanyId",
      dynamicOptionsKey: "industryTypeByCompany",
      dependsOnPlaceholder: "先に企業を選択してください",
    },
    {
      key: "jobMedia",
      header: "求人媒体",
      type: "select",
      dependsOn: "industryType",
      dynamicOptionsKey: "jobMediaByIndustryType",
      dependsOnPlaceholder: "先に業種区分を選択してください",
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
  ];

  const inlineEditConfig: InlineEditConfig = {
    columns: [
      "sendDate",
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
    onCellClick: (row, columnKey) => {
      if (columnKey === "industryType" && !row.stpCompanyId) {
        toast.info("先に企業を選択してください");
        return true;
      }
      if (columnKey === "jobMedia" && !row.industryType) {
        toast.info("先に業種区分を選択してください");
        return true;
      }
    },
    getOptions: (row, columnKey) => {
      if (columnKey === "interviewAttendance") return interviewAttendanceOptions;
      if (columnKey === "selectionStatus") return selectionStatusOptions;
      if (columnKey === "stpCompanyId") return stpCompanyOptions;
      if (columnKey === "industryType") {
        return getIndustryTypeOptions(row.stpCompanyId as string);
      }
      if (columnKey === "jobMedia") {
        return getJobMediaOptions(
          row.stpCompanyId as string,
          row.industryType as string
        );
      }
      return [];
    },
  };

  // ダイアログでのフィールド変更時にカスケードクリア
  const handleFieldChange = useCallback(
    (
      fieldKey: string,
      _newValue: unknown,
      formData: Record<string, unknown>,
      setFormData: (data: Record<string, unknown>) => void
    ) => {
      if (fieldKey === "stpCompanyId") {
        setFormData({ ...formData, industryType: null, jobMedia: null });
      }
      if (fieldKey === "industryType") {
        setFormData({ ...formData, jobMedia: null });
      }
    },
    []
  );

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

  const handleRestore = async (row: Record<string, unknown>) => {
    try {
      await restoreCandidate(row.id as number);
      router.refresh();
      toast.success("復元しました");
    } catch {
      toast.error("復元に失敗しました");
    }
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
      {/* 削除済みフィルタ */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">表示:</span>
        <Select
          value={deletedFilter}
          onValueChange={(v) => setDeletedFilter(v as DeletedFilter)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">アクティブのみ</SelectItem>
            <SelectItem value="include_deleted">削除したユーザーも見る</SelectItem>
            <SelectItem value="deleted_only">削除されたユーザーだけ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CrudTable
        data={filteredData}
        columns={columns}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        enableInlineEdit={true}
        inlineEditConfig={inlineEditConfig}
        dynamicOptions={dynamicOptions}
        onFieldChange={handleFieldChange}
        updateWarningMessage="企業側のデータにも反映されます。変更してよろしいですか？"
        customActions={
          deletedFilter !== "active"
            ? [
                {
                  icon: <RotateCcw className="h-4 w-4 text-green-600" />,
                  label: "復元",
                  onClick: handleRestore,
                },
              ]
            : []
        }
        customRenderers={{
          candidateName: (value: unknown, row: Record<string, unknown>) => {
            const isDeleted = !!row.deletedAt;
            return (
              <span
                className={`cursor-pointer hover:underline ${isDeleted ? "text-muted-foreground line-through" : ""}`}
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
            return industryTypeLabelMap[value as string] || (value as string);
          },
          jobMedia: (value: unknown) => {
            if (!value) return "-";
            return value as string;
          },
          joinConfirmed: (_value: unknown, row: Record<string, unknown>) => {
            const hasJoinDate = !!row.joinDate;
            if (hasJoinDate) {
              return (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  確定
                </Badge>
              );
            }
            return <span className="text-muted-foreground">-</span>;
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
