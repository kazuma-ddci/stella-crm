"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InlineCell } from "@/components/inline-cell";
import { CrudTable, type ColumnDef, type CustomAction, type CustomRenderers } from "@/components/crud-table";
import { approveLoanUsageChange, rejectLoanUsageChange, updateProgressStaffMemo } from "./actions";

type RowData = {
  id: number;
  formToken: string;
  formUpdateStatus: string;
  loanUsagePending: string;
  loanUsageApproved: string;
  vendorName: string;
  vendorNo: number;
  requestDate: string | null;
  companyName: string;
  representName: string;
  statusName: string;
  applicantType: string;
  updatedAt: string;
  memo: string;
  memorandum: string;
  funds: string;
  redemptionScheduleIssuedAt: string | null;
  toolPurchasePrice: string | null;
  loanAmount: string | null;
  fundTransferDate: string | null;
  loanExecutionDate: string | null;
  repaymentDate: string | null;
  repaymentAmount: string | null;
  principalAmount: string | null;
  interestAmount: string | null;
  overshortAmount: string | null;
  operationFee: string | null;
  redemptionAmount: string | null;
  secondaryRepaymentDate: string | null;
  secondaryRepaymentAmount: string | null;
  secondaryPrincipalAmount: string | null;
  secondaryInterestAmount: string | null;
  secondaryRedemptionAmount: string | null;
  redemptionDate: string | null;
  endMemo: string;
  staffMemo: string;
};

function formatNumber(value: string | null): string {
  if (!value) return "-";
  const num = Number(value);
  if (isNaN(num)) return "-";
  return num.toLocaleString();
}

export function LoanProgressTable({
  data,
  canEdit,
}: {
  data: RowData[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<RowData | null>(null);
  const [editMemo, setEditMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [customerOrigin, setCustomerOrigin] = useState(
    process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN || "",
  );

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_HOJO_CUSTOMER_DOMAIN) {
      setCustomerOrigin(window.location.origin);
    }
  }, []);

  const openEdit = (item: Record<string, unknown>) => {
    const r = item as unknown as RowData;
    setEditRow(r);
    setEditMemo(r.staffMemo);
  };

  const handleModalSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const result = await updateProgressStaffMemo(editRow.id, editMemo);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setEditRow(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleStaffMemoSave = async (id: number, value: string) => {
    const result = await updateProgressStaffMemo(id, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const copyFormUrl = async (row: RowData) => {
    if (!row.formToken) return;
    await navigator.clipboard.writeText(`${customerOrigin}/form/hojo-loan-application?t=${row.formToken}`);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 1500);
  };

  const handleApproveUsage = async (id: number) => {
    const result = await approveLoanUsageChange(id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleRejectUsage = async (id: number) => {
    const result = await rejectLoanUsageChange(id);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  // ベンダー・ステータス・法人個人 のユニーク値から select オプション生成
  const vendorOptions = Array.from(new Set(data.map((r) => r.vendorName).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));
  const statusOptions = Array.from(new Set(data.map((r) => r.statusName).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));
  const applicantTypeOptions = Array.from(new Set(data.map((r) => r.applicantType).filter(Boolean)))
    .map((name) => ({ value: name, label: name }));
  const formStatusOptions = ["未送信", "送信済み", "修正申請中", "変更反映済み", "変更却下済み"]
    .map((name) => ({ value: name, label: name }));

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "vendorName", header: "ベンダー", type: "select", options: vendorOptions, editable: false, filterable: true },
    { key: "vendorNo", header: "ベンダーNo.", type: "number", editable: false, filterable: true, cellClassName: "text-center" },
    { key: "requestDate", header: "依頼日", type: "date", editable: false, filterable: true },
    { key: "companyName", header: "社名（屋号名）", type: "text", editable: false, filterable: true },
    { key: "representName", header: "代表者(契約者)氏名", type: "text", editable: false, filterable: true },
    { key: "formUrl", header: "URL", editable: false },
    { key: "formUpdateStatus", header: "フォーム更新状況", type: "select", options: formStatusOptions, editable: false, filterable: true },
    { key: "statusName", header: "ステータス", type: "select", options: statusOptions, editable: false, filterable: true },
    { key: "applicantType", header: "法人/個人", type: "select", options: applicantTypeOptions, editable: false, filterable: true },
    { key: "updatedAt", header: "最終更新日", type: "date", editable: false, filterable: true },
    { key: "memo", header: "貸金備考", type: "textarea", editable: false, filterable: true },
    { key: "memorandum", header: "覚書", type: "textarea", editable: false, filterable: true },
    { key: "funds", header: "資金", type: "textarea", editable: false, filterable: true },
    { key: "redemptionScheduleIssuedAt", header: "償還表発行日", type: "date", editable: false, filterable: true },
    { key: "toolPurchasePrice", header: "ツール購入代金", editable: false, filterable: true },
    { key: "loanAmount", header: "貸付金額", editable: false, filterable: true },
    { key: "fundTransferDate", header: "資金移動日", type: "date", editable: false, filterable: true },
    { key: "loanExecutionDate", header: "貸付実行日", type: "datetime", editable: false, filterable: true },
    { key: "repaymentDate", header: "1次返金日(着金日)", type: "date", editable: false, filterable: true },
    { key: "repaymentAmount", header: "1次返金額(着金額)", editable: false, filterable: true },
    { key: "principalAmount", header: "元金分", editable: false, filterable: true },
    { key: "interestAmount", header: "1次利息分", editable: false, filterable: true },
    { key: "overshortAmount", header: "過不足", editable: false, filterable: true },
    { key: "operationFee", header: "運用フィー", editable: false, filterable: true },
    { key: "redemptionAmount", header: "1次償還額", editable: false, filterable: true },
    { key: "secondaryRepaymentDate", header: "2次返金日", type: "date", editable: false, filterable: true },
    { key: "secondaryRepaymentAmount", header: "2次返金額", editable: false, filterable: true },
    { key: "secondaryPrincipalAmount", header: "2次返金元金分", editable: false, filterable: true },
    { key: "secondaryInterestAmount", header: "2次利息分", editable: false, filterable: true },
    { key: "secondaryRedemptionAmount", header: "2次償還額", editable: false, filterable: true },
    { key: "redemptionDate", header: "償還日", type: "date", editable: false, filterable: true },
    { key: "endMemo", header: "貸金返済備考", type: "textarea", editable: false, filterable: true },
    { key: "staffMemo", header: "弊社備考", type: "textarea", editable: false, filterable: true },
  ];

  const truncateCell = (value: unknown) => (
    <span className="truncate block max-w-[180px]">{value ? String(value) : "-"}</span>
  );

  const numberCell = (value: unknown) => (
    <span className="whitespace-nowrap text-right block">{formatNumber(value as string | null)}</span>
  );

  const customRenderers: CustomRenderers = {
    memo: truncateCell,
    memorandum: truncateCell,
    funds: truncateCell,
    endMemo: truncateCell,
    toolPurchasePrice: numberCell,
    loanAmount: numberCell,
    repaymentAmount: numberCell,
    principalAmount: numberCell,
    interestAmount: numberCell,
    overshortAmount: numberCell,
    operationFee: numberCell,
    redemptionAmount: numberCell,
    secondaryRepaymentAmount: numberCell,
    secondaryPrincipalAmount: numberCell,
    secondaryInterestAmount: numberCell,
    secondaryRedemptionAmount: numberCell,
    staffMemo: (value, row) => {
      const id = row.id as number;
      const staffMemo = (row.staffMemo as string) ?? "";
      if (!canEdit) {
        return <span className="truncate block max-w-[200px]">{staffMemo || "-"}</span>;
      }
      return (
        <InlineCell
          value={staffMemo}
          onSave={(v) => handleStaffMemoSave(id, v)}
          type="textarea"
        >
          <span className="truncate block max-w-[200px]">{staffMemo || "-"}</span>
        </InlineCell>
      );
    },
    formUrl: (_, row) => {
      const r = row as unknown as RowData;
      if (!r.formToken) return "-";
      return (
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={() => copyFormUrl(r)}>
          {copiedId === r.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          コピー
        </Button>
      );
    },
    formUpdateStatus: (value, row) => {
      const r = row as unknown as RowData;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span>{String(value || "未送信")}</span>
          {r.loanUsagePending && canEdit && (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs text-amber-600">貸金利用: {r.loanUsageApproved || "-"}→{r.loanUsagePending}</span>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => handleApproveUsage(r.id)}>
                <Check className="h-3 w-3 mr-1" />承認
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => handleRejectUsage(r.id)}>
                <X className="h-3 w-3 mr-1" />却下
              </Button>
            </span>
          )}
        </div>
      );
    },
  };

  const customActions: CustomAction[] | undefined = canEdit
    ? [
        {
          icon: <Pencil className="h-4 w-4" />,
          label: "弊社備考を編集",
          onClick: openEdit,
        },
      ]
    : undefined;

  return (
    <>
      <CrudTable
        tableId="hojo.loan-progress"
        data={data as unknown as Record<string, unknown>[]}
        columns={columns}
        emptyMessage="進捗データがまだありません"
        customRenderers={customRenderers}
        customActions={customActions}
      />

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>弊社備考の編集</DialogTitle>
            {editRow && (
              <p className="text-sm text-muted-foreground">{editRow.companyName}</p>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-staff-memo">弊社備考</Label>
            <Textarea
              id="edit-staff-memo"
              value={editMemo}
              onChange={(e) => setEditMemo(e.target.value)}
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)} disabled={saving}>
              キャンセル
            </Button>
            <Button onClick={handleModalSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
