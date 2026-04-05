"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { updateProgressStaffMemo } from "./actions";

type RowData = {
  id: number;
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
  redemptionDate: string | null;
  endMemo: string;
  staffMemo: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

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

  const openEdit = (row: RowData) => {
    setEditRow(row);
    setEditMemo(row.staffMemo);
  };

  const handleModalSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await updateProgressStaffMemo(editRow.id, editMemo);
      setEditRow(null);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleStaffMemoSave = async (id: number, value: string) => {
    try {
      await updateProgressStaffMemo(id, value);
      router.refresh();
    } catch {
      alert("保存に失敗しました");
    }
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        進捗データがまだありません
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 whitespace-nowrap">No.</TableHead>
            <TableHead className="whitespace-nowrap">ベンダー</TableHead>
            <TableHead className="whitespace-nowrap">ベンダーNo.</TableHead>
            <TableHead className="whitespace-nowrap">依頼日</TableHead>
            <TableHead className="whitespace-nowrap">社名（屋号名）</TableHead>
            <TableHead className="whitespace-nowrap">代表者(契約者)氏名</TableHead>
            <TableHead className="whitespace-nowrap">ステータス</TableHead>
            <TableHead className="whitespace-nowrap">法人/個人</TableHead>
            <TableHead className="whitespace-nowrap">最終更新日</TableHead>
            <TableHead className="whitespace-nowrap">貸金備考</TableHead>
            <TableHead className="whitespace-nowrap">覚書</TableHead>
            <TableHead className="whitespace-nowrap">資金</TableHead>
            <TableHead className="whitespace-nowrap">ツール購入代金</TableHead>
            <TableHead className="whitespace-nowrap">貸付金額</TableHead>
            <TableHead className="whitespace-nowrap">資金移動日</TableHead>
            <TableHead className="whitespace-nowrap">貸付実行日</TableHead>
            <TableHead className="whitespace-nowrap">返金日(着金日)</TableHead>
            <TableHead className="whitespace-nowrap">返金額(着金額)</TableHead>
            <TableHead className="whitespace-nowrap">元金分</TableHead>
            <TableHead className="whitespace-nowrap">利息分</TableHead>
            <TableHead className="whitespace-nowrap">過不足</TableHead>
            <TableHead className="whitespace-nowrap">運用フィー</TableHead>
            <TableHead className="whitespace-nowrap">償還額</TableHead>
            <TableHead className="whitespace-nowrap">償還日</TableHead>
            <TableHead className="whitespace-nowrap">貸金返済備考</TableHead>
            <TableHead className="whitespace-nowrap bg-blue-50">弊社備考</TableHead>
            {canEdit && (
              <TableHead className="whitespace-nowrap sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                操作
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={row.id} className="group/row">
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {row.vendorName || "-"}
              </TableCell>
              <TableCell className="text-center">{row.vendorNo}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.requestDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap font-medium">
                {row.companyName || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.representName || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.statusName || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {row.applicantType || "-"}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.updatedAt)}
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.memo || "-"}</span>
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.memorandum || "-"}</span>
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.funds || "-"}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.toolPurchasePrice)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.loanAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.fundTransferDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(row.loanExecutionDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.repaymentDate)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.repaymentAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.principalAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.interestAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.overshortAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.operationFee)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">
                {formatNumber(row.redemptionAmount)}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(row.redemptionDate)}
              </TableCell>
              <TableCell className="max-w-[180px]">
                <span className="truncate block">{row.endMemo || "-"}</span>
              </TableCell>
              <TableCell className="max-w-[200px] bg-blue-50/50">
                {canEdit ? (
                  <InlineCell
                    value={row.staffMemo}
                    onSave={(v) => handleStaffMemoSave(row.id, v)}
                    type="textarea"
                  >
                    <span className="truncate block">
                      {row.staffMemo || "-"}
                    </span>
                  </InlineCell>
                ) : (
                  <span className="truncate block">
                    {row.staffMemo || "-"}
                  </span>
                )}
              </TableCell>
              {canEdit && (
                <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>弊社備考の編集</DialogTitle>
            {editRow && (
              <p className="text-sm text-muted-foreground">
                {editRow.companyName}
              </p>
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
            <Button
              variant="outline"
              onClick={() => setEditRow(null)}
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button onClick={handleModalSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
