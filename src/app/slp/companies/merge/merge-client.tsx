"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowLeftRight, Save, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { mergeCompanyRecords, type MergeCompanyData } from "../actions";
import { toast } from "sonner";

type CompanyData = {
  id: number;
  companyName: string | null;
  representativeName: string | null;
  employeeCount: string;
  prefecture: string | null;
  address: string | null;
  companyPhone: string | null;
  pensionOffice: string | null;
  pensionOfficerName: string | null;
  industryId: number | null;
  flowSourceId: number | null;
  salesStaffId: number | null;
  status1Id: number | null;
  status2Id: number | null;
  lastContactDate: string;
  annualLaborCostExecutive: string;
  annualLaborCostEmployee: string;
  averageMonthlySalary: string;
  initialFee: string;
  initialPeopleCount: string;
  monthlyFee: string;
  monthlyPeopleCount: string;
  contractDate: string;
  lastPaymentDate: string;
  invoiceSentDate: string;
  nextPaymentDate: string;
  estMaxRefundPeople: string;
  estMaxRefundAmount: string;
  estOurRevenue: string;
  estAgentPayment: string;
  confirmedRefundPeople: string;
  confirmedRefundAmount: string;
  confirmedOurRevenue: string;
  confirmedAgentPayment: string;
  paymentReceivedDate: string;
  briefingStatus: string | null;
  consultationStatus: string | null;
  reservationId: string | null;
  consultationReservationId: string | null;
  contactCount: number;
  historyCount: number;
  documentCount: number;
};

type MasterOption = { id: number; name: string };
type StaffOption = { id: number; name: string };

type Props = {
  recordA: CompanyData;
  recordB: CompanyData;
  industryOptions: MasterOption[];
  flowSourceOptions: MasterOption[];
  status1Options: MasterOption[];
  status2Options: MasterOption[];
  staffOptions: StaffOption[];
};

// 編集対象のフィールド一覧
type EditableField = {
  key: keyof CompanyData;
  label: string;
  type: "text" | "decimal" | "date" | "select";
  options?: MasterOption[] | StaffOption[];
};

export function MergeClient({
  recordA,
  recordB,
  industryOptions,
  flowSourceOptions,
  status1Options,
  status2Options,
  staffOptions,
}: Props) {
  const router = useRouter();
  const [mainSide, setMainSide] = useState<"a" | "b" | null>(null);
  const [edited, setEdited] = useState<CompanyData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const main = mainSide === "a" ? recordA : mainSide === "b" ? recordB : null;
  const sub = mainSide === "a" ? recordB : mainSide === "b" ? recordA : null;

  // メインを選択した時に edited を初期化
  const handleSelectMain = (side: "a" | "b") => {
    setMainSide(side);
    setEdited(side === "a" ? { ...recordA } : { ...recordB });
  };

  const handleFieldChange = <K extends keyof CompanyData>(
    field: K,
    value: CompanyData[K]
  ) => {
    if (!edited) return;
    setEdited({ ...edited, [field]: value });
  };

  const handleCopyFromSub = (field: keyof CompanyData) => {
    if (!edited || !sub) return;
    setEdited({ ...edited, [field]: sub[field] });
  };

  const handleSubmit = async () => {
    if (!edited || !main || !sub) return;
    setSubmitting(true);
    try {
      const data: MergeCompanyData = {
        companyName: edited.companyName,
        representativeName: edited.representativeName,
        employeeCount: edited.employeeCount || null,
        prefecture: edited.prefecture,
        address: edited.address,
        companyPhone: edited.companyPhone,
        pensionOffice: edited.pensionOffice,
        pensionOfficerName: edited.pensionOfficerName,
        industryId: edited.industryId,
        flowSourceId: edited.flowSourceId,
        salesStaffId: edited.salesStaffId,
        status1Id: edited.status1Id,
        status2Id: edited.status2Id,
        lastContactDate: edited.lastContactDate || null,
        annualLaborCostExecutive: edited.annualLaborCostExecutive || null,
        annualLaborCostEmployee: edited.annualLaborCostEmployee || null,
        averageMonthlySalary: edited.averageMonthlySalary || null,
        initialFee: edited.initialFee || null,
        initialPeopleCount: edited.initialPeopleCount || null,
        monthlyFee: edited.monthlyFee || null,
        monthlyPeopleCount: edited.monthlyPeopleCount || null,
        contractDate: edited.contractDate || null,
        lastPaymentDate: edited.lastPaymentDate || null,
        invoiceSentDate: edited.invoiceSentDate || null,
        nextPaymentDate: edited.nextPaymentDate || null,
        estMaxRefundPeople: edited.estMaxRefundPeople || null,
        estMaxRefundAmount: edited.estMaxRefundAmount || null,
        estOurRevenue: edited.estOurRevenue || null,
        estAgentPayment: edited.estAgentPayment || null,
        confirmedRefundPeople: edited.confirmedRefundPeople || null,
        confirmedRefundAmount: edited.confirmedRefundAmount || null,
        confirmedOurRevenue: edited.confirmedOurRevenue || null,
        confirmedAgentPayment: edited.confirmedAgentPayment || null,
        paymentReceivedDate: edited.paymentReceivedDate || null,
      };
      const result = await mergeCompanyRecords(main.id, sub.id, data);
      if (!result.ok) {
        toast.error(result.error);
        setSubmitting(false);
        return;
      }
      toast.success("統合が完了しました");
      router.push(`/slp/companies/${main.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "統合に失敗しました");
      setSubmitting(false);
    }
  };

  const fields: EditableField[] = useMemo(
    () => [
      { key: "companyName", label: "企業名", type: "text" },
      { key: "representativeName", label: "代表者名", type: "text" },
      { key: "employeeCount", label: "従業員数", type: "text" },
      { key: "prefecture", label: "都道府県", type: "text" },
      { key: "address", label: "住所", type: "text" },
      { key: "companyPhone", label: "電話番号", type: "text" },
      { key: "pensionOffice", label: "管轄の年金事務所", type: "text" },
      {
        key: "pensionOfficerName",
        label: "年金事務所担当者名",
        type: "text",
      },
      {
        key: "industryId",
        label: "業種",
        type: "select",
        options: industryOptions,
      },
      {
        key: "flowSourceId",
        label: "流入経路",
        type: "select",
        options: flowSourceOptions,
      },
      {
        key: "salesStaffId",
        label: "担当営業",
        type: "select",
        options: staffOptions,
      },
      {
        key: "status1Id",
        label: "ステータス①",
        type: "select",
        options: status1Options,
      },
      {
        key: "status2Id",
        label: "ステータス②",
        type: "select",
        options: status2Options,
      },
      { key: "lastContactDate", label: "最終接触日", type: "date" },
      {
        key: "annualLaborCostExecutive",
        label: "年間人件費（役員様分）",
        type: "decimal",
      },
      {
        key: "annualLaborCostEmployee",
        label: "年間人件費（従業員様分）",
        type: "decimal",
      },
      { key: "averageMonthlySalary", label: "平均月額給与", type: "decimal" },
      { key: "initialFee", label: "初期導入費用", type: "decimal" },
      { key: "initialPeopleCount", label: "初期導入人数", type: "text" },
      { key: "monthlyFee", label: "月額利用料", type: "decimal" },
      { key: "monthlyPeopleCount", label: "月額利用人数", type: "text" },
      { key: "contractDate", label: "契約日", type: "date" },
    ],
    [
      industryOptions,
      flowSourceOptions,
      status1Options,
      status2Options,
      staffOptions,
    ]
  );

  // 値の比較表示用フォーマッタ
  const formatValue = (
    rec: CompanyData,
    field: EditableField
  ): string => {
    const v = rec[field.key];
    if (v === null || v === undefined || v === "") return "(未設定)";
    if (field.type === "select" && field.options) {
      const opt = field.options.find((o) => o.id === v);
      return opt?.name ?? "(未設定)";
    }
    return String(v);
  };

  const valueDiffers = (field: EditableField): boolean => {
    return recordA[field.key] !== recordB[field.key];
  };

  // ---- ステップ1: メインを選択する画面 ----
  if (!mainSide) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/slp/companies">
            <ArrowLeft className="h-4 w-4 mr-1" />
            事業者名簿に戻る
          </Link>
        </Button>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            <strong>統合するメインのレコードを選択してください。</strong>
            <br />
            選んだ方が「統合先」となり、もう一方は論理削除されます。
            <br />
            両方の担当者・履歴・提出書類は自動的に統合先に集約されます。
            <br />
            予約IDも統合先に追跡可能な形で引き継がれます。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { side: "a" as const, rec: recordA },
            { side: "b" as const, rec: recordB },
          ].map(({ side, rec }) => (
            <Card key={rec.id} className="cursor-pointer hover:border-blue-400">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    企業ID: {rec.id}
                    {rec.briefingStatus && (
                      <Badge variant="outline" className="ml-2">
                        {rec.briefingStatus}
                      </Badge>
                    )}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">企業名: </span>
                  <span className="font-medium">
                    {rec.companyName ?? "(未登録)"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">電話: </span>
                  {rec.companyPhone ?? "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">住所: </span>
                  {[rec.prefecture, rec.address].filter(Boolean).join("") ||
                    "-"}
                </div>
                <div>
                  <span className="text-muted-foreground">担当者: </span>
                  {rec.contactCount}名
                </div>
                <div>
                  <span className="text-muted-foreground">履歴: </span>
                  {rec.historyCount}件
                </div>
                <div>
                  <span className="text-muted-foreground">提出書類: </span>
                  {rec.documentCount}件
                </div>
                <div>
                  <span className="text-muted-foreground">予約ID: </span>
                  {rec.reservationId ?? "-"}
                </div>
                <Button
                  className="w-full mt-4"
                  onClick={() => handleSelectMain(side)}
                >
                  この事業者をメインにする
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!main || !sub || !edited) return null;

  // ---- ステップ2: 編集画面 ----
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setMainSide(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          メイン選択に戻る
        </Button>
        <Button onClick={() => setConfirmOpen(true)}>
          <Save className="h-4 w-4 mr-1" />
          統合を保存
        </Button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
        <p>
          📌 <strong>左カラム</strong>がメイン（編集可能）、
          <strong>右カラム</strong>がもう一方（参考表示・編集不可）
        </p>
        <p className="mt-1">
          値が異なる項目は <strong className="text-amber-600">⚠</strong>{" "}
          マーク付き、「←」ボタンで右側の値を左にコピーできます
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本情報の比較・編集</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <div className="col-span-3">項目</div>
            <div className="col-span-4">
              ✅ メイン (ID: {main.id}){" "}
              <span className="text-blue-700">編集可能</span>
            </div>
            <div className="col-span-1 text-center"></div>
            <div className="col-span-4">
              📋 もう一方 (ID: {sub.id}){" "}
              <span className="text-slate-500">参考表示</span>
            </div>
          </div>

          {fields.map((field) => {
            const differs = valueDiffers(field);
            return (
              <div
                key={field.key}
                className={`grid grid-cols-12 gap-2 items-start py-2 ${
                  differs ? "bg-amber-50/50 -mx-2 px-2 rounded" : ""
                }`}
              >
                <div className="col-span-3 text-sm pt-1.5">
                  <Label>
                    {differs && (
                      <AlertTriangle className="inline h-3 w-3 mr-1 text-amber-600" />
                    )}
                    {field.label}
                  </Label>
                </div>
                <div className="col-span-4">
                  {field.type === "select" ? (
                    <select
                      className="w-full h-9 px-2 border rounded-md text-sm"
                      value={
                        edited[field.key] !== null &&
                        edited[field.key] !== undefined
                          ? String(edited[field.key])
                          : ""
                      }
                      onChange={(e) =>
                        handleFieldChange(
                          field.key,
                          (e.target.value
                            ? parseInt(e.target.value, 10)
                            : null) as CompanyData[typeof field.key]
                        )
                      }
                    >
                      <option value="">(未設定)</option>
                      {field.options?.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={field.type === "date" ? "date" : "text"}
                      value={
                        edited[field.key] !== null &&
                        edited[field.key] !== undefined
                          ? String(edited[field.key])
                          : ""
                      }
                      onChange={(e) =>
                        handleFieldChange(
                          field.key,
                          e.target.value as CompanyData[typeof field.key]
                        )
                      }
                      className="h-9 text-sm"
                    />
                  )}
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {differs && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleCopyFromSub(field.key)}
                      title="右側の値を左にコピー"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="col-span-4 text-sm pt-1.5 text-slate-600">
                  {formatValue(sub, field)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">自動マージされる項目</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            ✓ 担当者: メイン{main.contactCount}名 + もう一方{sub.contactCount}
            名 → 統合
          </p>
          <p>
            ✓ ステータス変更履歴: メイン{main.historyCount}件 + もう一方
            {sub.historyCount}件 → 統合
          </p>
          <p>
            ✓ 提出書類: メイン{main.documentCount}件 + もう一方
            {sub.documentCount}件 → 統合
          </p>
          <p>
            ✓ 予約ID: 両方の予約ID（メイン・統合元）が追跡可能な形で引き継がれます
            {sub.reservationId &&
              ` (取り込まれる概要案内予約ID: ${sub.reservationId})`}
            {sub.consultationReservationId &&
              ` (取り込まれる導入希望商談予約ID: ${sub.consultationReservationId})`}
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>統合を実行</AlertDialogTitle>
            <AlertDialogDescription>
              企業ID {sub.id}（{sub.companyName ?? "(未登録)"}）は論理削除され、
              すべてのデータが企業ID {main.id}（{main.companyName ?? "(未登録)"}
              ）に統合されます。
              <br />
              この操作は元に戻せません。本当に統合しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? "統合中..." : "統合する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
