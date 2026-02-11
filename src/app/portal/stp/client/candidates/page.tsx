"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CrudTable, ColumnDef, InlineEditConfig } from "@/components/crud-table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CandidateData {
  id: number;
  lastName: string;
  firstName: string;
  interviewDate: string | null;
  interviewAttendance: string | null;
  selectionStatus: string | null;
  offerDate: string | null;
  joinDate: string | null;
  joinConfirmed: boolean;
  sendDate: string | null;
  industryType: string | null;
  jobMedia: string | null;
  note: string | null;
  stpCompanyId: number;
}

interface ContractOption {
  industryType: string;
  jobMedia: string | null;
}

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

export default function PortalCandidatesPage() {
  const { data: session, status } = useSession();
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [contractOptions, setContractOptions] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = session?.user as any;
  const companyName = user?.companyName ?? "";

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/portal/stp/client/candidates");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "データの取得に失敗しました");
      }

      setCandidates(result.data);
      setContractOptions(result.contractOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchData();
    }
  }, [status, fetchData]);

  // 契約中の業種区分の選択肢
  const industryTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const c of contractOptions) {
      types.add(c.industryType);
    }
    return Array.from(types).map((t) => ({
      value: t,
      label: industryTypeLabelMap[t] || t,
    }));
  }, [contractOptions]);

  // 業種区分に基づく求人媒体の選択肢を取得
  const getJobMediaOptionsForIndustryType = useCallback(
    (industryType: string | null | undefined) => {
      if (!industryType) return [];
      const mediaSet = new Set<string>();
      for (const c of contractOptions) {
        if (c.industryType === industryType && c.jobMedia) {
          mediaSet.add(c.jobMedia);
        }
      }
      return Array.from(mediaSet)
        .sort()
        .map((m) => ({ value: m, label: m }));
    },
    [contractOptions]
  );

  // 業種区分→求人媒体の動的選択肢マップ（追加/編集ダイアログ用）
  const dynamicOptions = useMemo(() => {
    const jobMediaByIndustryType: Record<string, { value: string; label: string }[]> = {};
    for (const c of contractOptions) {
      if (!jobMediaByIndustryType[c.industryType]) {
        jobMediaByIndustryType[c.industryType] = [];
      }
      if (c.jobMedia) {
        const existing = jobMediaByIndustryType[c.industryType];
        if (!existing.find((o) => o.value === c.jobMedia)) {
          existing.push({ value: c.jobMedia, label: c.jobMedia });
        }
      }
    }
    for (const key of Object.keys(jobMediaByIndustryType)) {
      jobMediaByIndustryType[key].sort((a, b) => a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
    }
    return { jobMediaByIndustryType };
  }, [contractOptions]);

  // テーブル用データ
  const tableData = useMemo(() => {
    return candidates.map((c) => ({
      ...c,
      candidateName: `${c.lastName} ${c.firstName}`,
    }));
  }, [candidates]);

  // カラム定義
  const columns: ColumnDef[] = useMemo(() => {
    return [
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
        options: industryTypeOptions,
      },
      {
        key: "jobMedia",
        header: "求人媒体",
        type: "select",
        dependsOn: "industryType",
        dynamicOptionsKey: "jobMediaByIndustryType",
        dependsOnPlaceholder: "先に業種区分を入力してください",
      },
      {
        key: "note",
        header: "メモ書き",
        type: "textarea",
      },
    ];
  }, [industryTypeOptions]);

  const inlineEditConfig: InlineEditConfig = useMemo(() => ({
    columns: [
      "sendDate",
      "interviewDate",
      "interviewAttendance",
      "selectionStatus",
      "offerDate",
      "joinDate",
      "industryType",
      "jobMedia",
    ],
    onCellClick: (row, columnKey) => {
      if (columnKey === "jobMedia" && !row.industryType) {
        toast.info("先に業種区分を入力してください");
        return true;
      }
    },
    getOptions: (row, columnKey) => {
      if (columnKey === "interviewAttendance") return interviewAttendanceOptions;
      if (columnKey === "selectionStatus") return selectionStatusOptions;
      if (columnKey === "industryType") return industryTypeOptions;
      if (columnKey === "jobMedia") {
        return getJobMediaOptionsForIndustryType(row.industryType as string);
      }
      return [];
    },
  }), [industryTypeOptions, getJobMediaOptionsForIndustryType]);

  // 業種区分が変更されたら求人媒体をクリア
  const handleFieldChange = useCallback(
    (fieldKey: string, _newValue: unknown, _formData: Record<string, unknown>, setFormData: (data: Record<string, unknown>) => void) => {
      if (fieldKey === "industryType") {
        setFormData({ ..._formData, jobMedia: null });
      }
    },
    []
  );

  const handleAdd = async (formData: Record<string, unknown>) => {
    const response = await fetch("/api/portal/stp/client/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "追加に失敗しました");
    }

    await fetchData();
  };

  const handleUpdate = async (id: number, formData: Record<string, unknown>) => {
    const response = await fetch("/api/portal/stp/client/candidates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...formData }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "更新に失敗しました");
    }

    await fetchData();
  };

  const handleDelete = async (id: number) => {
    const response = await fetch("/api/portal/stp/client/candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "削除に失敗しました");
    }

    await fetchData();
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal/stp/client">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">求職者情報</h1>
              <p className="text-sm text-gray-500">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="text-red-600 mb-4 p-4 bg-red-50 rounded-md">
            エラー: {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>求職者一覧</CardTitle>
            <CardDescription>
              求職者情報の追加・編集・削除ができます
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CrudTable
              data={tableData}
              columns={columns}
              onAdd={handleAdd}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              enableInlineEdit={true}
              inlineEditConfig={inlineEditConfig}
              dynamicOptions={dynamicOptions}
              onFieldChange={handleFieldChange}
              addButtonLabel="求職者を追加"
              updateWarningMessage="変更してよろしいですか？"
              customRenderers={{
                candidateName: (value: unknown) => {
                  return <span>{(value as string) || "-"}</span>;
                },
                industryType: (value: unknown) => {
                  if (!value) return "-";
                  const option = industryTypeOptions.find((o) => o.value === value);
                  return option?.label || (value as string);
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
              }}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
