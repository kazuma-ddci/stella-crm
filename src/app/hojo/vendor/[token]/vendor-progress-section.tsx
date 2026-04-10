"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { InlineCell } from "@/components/inline-cell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateVendorProgress } from "./actions";

export type ProgressRow = {
  id: number;
  requestDate: string;
  companyName: string;
  representName: string;
  statusName: string;
  applicantType: string;
  updatedAt: string;
  memo: string;
  memorandum: string;
  funds: string;
  toolPurchasePrice: string;
  loanAmount: string;
  fundTransferDate: string;
  loanExecutionDate: string;
  loanExecutionTime: string;
  repaymentDate: string;
  repaymentAmount: string;
  principalAmount: string;
  interestAmount: string;
  overshortAmount: string;
  redemptionAmount: string;
  redemptionDate: string;
  endMemo: string;
};

type Props = {
  data: ProgressRow[];
  vendorId: number;
  canEdit: boolean;
};

export function VendorProgressSection({ data, vendorId, canEdit }: Props) {
  const router = useRouter();
  const [editRow, setEditRow] = useState<ProgressRow | null>(null);
  const [editData, setEditData] = useState({
    requestDate: "",
    toolPurchasePrice: "",
    fundTransferDate: "",
    loanExecutionDate: "",
    loanExecutionTime: "",
  });
  const [saving, setSaving] = useState(false);

  const openEdit = (row: ProgressRow) => {
    setEditRow(row);
    setEditData({
      requestDate: row.requestDate,
      toolPurchasePrice: row.toolPurchasePrice ? row.toolPurchasePrice.replace(/,/g, "") : "",
      fundTransferDate: row.fundTransferDate,
      loanExecutionDate: row.loanExecutionDate,
      loanExecutionTime: row.loanExecutionTime,
    });
  };

  const handleModalSave = async () => {
    if (!editRow) return;

    // ツール購入代金と貸付金額の一致チェック
    const loanNum = Number((editRow.loanAmount || "").replace(/,/g, ""));
    const toolNum = Number((editData.toolPurchasePrice || "").replace(/,/g, ""));
    const modalPriceMatched = !isNaN(loanNum) && !isNaN(toolNum) && loanNum === toolNum;

    // 依頼日を変更しようとしている かつ 一致していない場合はエラー
    if (editData.requestDate !== editRow.requestDate && !modalPriceMatched) {
      alert("依頼日を入力するには、ツール購入代金を貸付金額と一致させてください");
      return;
    }

    setSaving(true);
    try {
      const fields: { field: string; newVal: string; oldVal: string }[] = [
        { field: "requestDate", newVal: editData.requestDate, oldVal: editRow.requestDate },
        { field: "toolPurchasePrice", newVal: editData.toolPurchasePrice, oldVal: editRow.toolPurchasePrice ? editRow.toolPurchasePrice.replace(/,/g, "") : "" },
        { field: "fundTransferDate", newVal: editData.fundTransferDate, oldVal: editRow.fundTransferDate },
      ];

      // Handle loanExecution date+time as combined datetime
      const oldCombined = editRow.loanExecutionDate
        ? `${editRow.loanExecutionDate}T${editRow.loanExecutionTime || "00:00"}:00`
        : "";
      const newCombined = editData.loanExecutionDate
        ? `${editData.loanExecutionDate}T${editData.loanExecutionTime || "00:00"}:00`
        : "";
      const loanDateChanged = editData.loanExecutionDate !== editRow.loanExecutionDate;
      const loanTimeChanged = editData.loanExecutionTime !== editRow.loanExecutionTime;

      for (const { field, newVal, oldVal } of fields) {
        if (newVal !== oldVal) {
          const r = await updateVendorProgress(editRow.id, vendorId, field, newVal);
          if (!r.ok) {
            alert(r.error);
            return;
          }
        }
      }

      if (loanDateChanged || loanTimeChanged) {
        const r = await updateVendorProgress(editRow.id, vendorId, "loanExecutionDate", newCombined);
        if (!r.ok) {
          alert(r.error);
          return;
        }
      }

      router.refresh();
      setEditRow(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (progressId: number, field: string, value: string) => {
    const result = await updateVendorProgress(progressId, vendorId, field, value);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    router.refresh();
  };

  const handleDateTimeSave = async (
    row: ProgressRow,
    part: "date" | "time",
    value: string
  ) => {
    let combined: string;
    if (part === "date") {
      const time = row.loanExecutionTime || "00:00";
      combined = value ? `${value}T${time}:00` : "";
    } else {
      const date = row.loanExecutionDate;
      if (!date) return;
      combined = `${date}T${value || "00:00"}:00`;
    }
    await handleSave(row.id, "loanExecutionDate", combined);
  };

  const fmtDate = (d: string) => (d ? d.replace(/-/g, "/") : "-");

  // ツール購入代金と貸付金額が一致しているかチェック
  const parseAmount = (s: string) => {
    if (!s) return null;
    const n = Number(s.replace(/,/g, ""));
    return isNaN(n) ? null : n;
  };
  const isPriceMatched = (row: ProgressRow) => {
    const tool = parseAmount(row.toolPurchasePrice);
    const loan = parseAmount(row.loanAmount);
    return tool != null && loan != null && tool === loan;
  };

  return (
    <div className="overflow-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">No.</TableHead>
            <TableHead className={canEdit ? "bg-blue-50 whitespace-nowrap" : "whitespace-nowrap"}>依頼日</TableHead>
            <TableHead className="whitespace-nowrap">社名（屋号名）</TableHead>
            <TableHead className="whitespace-nowrap">代表者(契約者)氏名</TableHead>
            <TableHead className="whitespace-nowrap">ステータス</TableHead>
            <TableHead className="whitespace-nowrap">法人/個人</TableHead>
            <TableHead className="whitespace-nowrap">最終更新日</TableHead>
            <TableHead className="whitespace-nowrap">備考</TableHead>
            <TableHead className="whitespace-nowrap">覚書</TableHead>
            <TableHead className="whitespace-nowrap">資金</TableHead>
            <TableHead className={canEdit ? "bg-blue-50 whitespace-nowrap" : "whitespace-nowrap"}>ツール購入代金</TableHead>
            <TableHead className="whitespace-nowrap">貸付金額</TableHead>
            <TableHead className={canEdit ? "bg-blue-50 whitespace-nowrap" : "whitespace-nowrap"}>資金移動日</TableHead>
            <TableHead className={canEdit ? "bg-blue-50 whitespace-nowrap" : "whitespace-nowrap"}>貸付実行日</TableHead>
            <TableHead className={canEdit ? "bg-blue-50 whitespace-nowrap" : "whitespace-nowrap"}>貸付実行時刻</TableHead>
            <TableHead className="whitespace-nowrap">返金日(着金日)</TableHead>
            <TableHead className="whitespace-nowrap">返金額(着金額)</TableHead>
            <TableHead className="whitespace-nowrap">元金分</TableHead>
            <TableHead className="whitespace-nowrap">利息分</TableHead>
            <TableHead className="whitespace-nowrap">過不足</TableHead>
            <TableHead className="whitespace-nowrap">償還額</TableHead>
            <TableHead className="whitespace-nowrap">償還日</TableHead>
            <TableHead className="whitespace-nowrap">返済備考</TableHead>
            {canEdit && (
              <TableHead className="w-16 sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                操作
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canEdit ? 24 : 23} className="text-center text-gray-500 py-8">
                データがありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((r, idx) => {
              const priceMatched = isPriceMatched(r);
              return (
              <TableRow key={r.id} className="group/row">
                <TableCell className="text-gray-500">{idx + 1}</TableCell>
                <TableCell className={canEdit ? "whitespace-nowrap bg-blue-50/50" : "whitespace-nowrap"}>
                  {canEdit && priceMatched ? (
                    <InlineCell
                      value={r.requestDate}
                      onSave={(v) => handleSave(r.id, "requestDate", v)}
                      type="date"
                    >
                      {fmtDate(r.requestDate)}
                    </InlineCell>
                  ) : canEdit ? (
                    <span
                      className="text-gray-400 cursor-not-allowed"
                      title="ツール購入代金と貸付金額を一致させてから入力してください"
                    >
                      {fmtDate(r.requestDate)}
                    </span>
                  ) : (
                    fmtDate(r.requestDate)
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.companyName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.representName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.statusName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.applicantType || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.updatedAt)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.memo || "-"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.memorandum || "-"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.funds || "-"}</TableCell>
                <TableCell className={`whitespace-nowrap ${canEdit ? "bg-blue-50/50" : ""} ${!priceMatched && r.toolPurchasePrice ? "text-red-600 font-semibold" : ""}`}>
                  {canEdit ? (
                    <InlineCell
                      value={r.toolPurchasePrice ? r.toolPurchasePrice.replace(/,/g, "") : ""}
                      onSave={(v) => handleSave(r.id, "toolPurchasePrice", v)}
                      type="number"
                    >
                      <span>
                        {r.toolPurchasePrice || "-"}
                        {!priceMatched && (
                          <span className="ml-1 text-xs text-red-500" title="貸付金額と一致していません">⚠</span>
                        )}
                      </span>
                    </InlineCell>
                  ) : (
                    <span>
                      {r.toolPurchasePrice || "-"}
                      {!priceMatched && r.toolPurchasePrice && (
                        <span className="ml-1 text-xs text-red-500">⚠</span>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.loanAmount || "-"}</TableCell>
                <TableCell className={canEdit ? "whitespace-nowrap bg-blue-50/50" : "whitespace-nowrap"}>
                  {canEdit ? (
                    <InlineCell
                      value={r.fundTransferDate}
                      onSave={(v) => handleSave(r.id, "fundTransferDate", v)}
                      type="date"
                    >
                      {fmtDate(r.fundTransferDate)}
                    </InlineCell>
                  ) : (
                    fmtDate(r.fundTransferDate)
                  )}
                </TableCell>
                <TableCell className={canEdit ? "whitespace-nowrap bg-blue-50/50" : "whitespace-nowrap"}>
                  {canEdit ? (
                    <InlineCell
                      value={r.loanExecutionDate}
                      onSave={(v) => handleDateTimeSave(r, "date", v)}
                      type="date"
                    >
                      {fmtDate(r.loanExecutionDate)}
                    </InlineCell>
                  ) : (
                    fmtDate(r.loanExecutionDate)
                  )}
                </TableCell>
                <TableCell className={canEdit ? "whitespace-nowrap bg-blue-50/50" : "whitespace-nowrap"}>
                  {canEdit ? (
                    <InlineCell
                      value={r.loanExecutionTime}
                      onSave={(v) => handleDateTimeSave(r, "time", v)}
                    >
                      {r.loanExecutionTime || "-"}
                    </InlineCell>
                  ) : (
                    r.loanExecutionTime || "-"
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.repaymentDate)}</TableCell>
                <TableCell className="whitespace-nowrap">{r.repaymentAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.principalAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.interestAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.overshortAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.redemptionAmount || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.redemptionDate)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.endMemo || "-"}</TableCell>
                {canEdit && (
                  <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Edit Modal */}
      <Dialog open={!!editRow} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>進捗情報の編集</DialogTitle>
          </DialogHeader>
          {(() => {
            const loanNum = editRow ? parseAmount(editRow.loanAmount) : null;
            const toolNum = parseAmount(editData.toolPurchasePrice);
            const modalPriceMatched = loanNum != null && toolNum != null && loanNum === toolNum;
            return (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-toolPurchasePrice">
                ツール購入代金
                {editRow?.loanAmount && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    （貸付金額: {editRow.loanAmount}）
                  </span>
                )}
              </Label>
              <Input
                id="edit-toolPurchasePrice"
                type="number"
                value={editData.toolPurchasePrice}
                onChange={(e) => setEditData((d) => ({ ...d, toolPurchasePrice: e.target.value }))}
                className={!modalPriceMatched && editData.toolPurchasePrice ? "border-red-500 text-red-600" : ""}
              />
              {!modalPriceMatched && (
                <p className="text-xs text-red-500">
                  ⚠ ツール購入代金は貸付金額と一致する必要があります
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-requestDate">
                依頼日
                {!modalPriceMatched && (
                  <span className="ml-2 text-xs text-red-500">
                    （ツール購入代金を一致させてから入力できます）
                  </span>
                )}
              </Label>
              <Input
                id="edit-requestDate"
                type="date"
                value={editData.requestDate}
                onChange={(e) => setEditData((d) => ({ ...d, requestDate: e.target.value }))}
                disabled={!modalPriceMatched}
                className={!modalPriceMatched ? "bg-gray-100 cursor-not-allowed" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fundTransferDate">資金移動日</Label>
              <Input
                id="edit-fundTransferDate"
                type="date"
                value={editData.fundTransferDate}
                onChange={(e) => setEditData((d) => ({ ...d, fundTransferDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-loanExecutionDate">貸付実行日</Label>
              <Input
                id="edit-loanExecutionDate"
                type="date"
                value={editData.loanExecutionDate}
                onChange={(e) => setEditData((d) => ({ ...d, loanExecutionDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-loanExecutionTime">貸付実行時刻</Label>
              <Input
                id="edit-loanExecutionTime"
                type="time"
                value={editData.loanExecutionTime}
                onChange={(e) => setEditData((d) => ({ ...d, loanExecutionTime: e.target.value }))}
              />
            </div>
          </div>
            );
          })()}
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
    </div>
  );
}
