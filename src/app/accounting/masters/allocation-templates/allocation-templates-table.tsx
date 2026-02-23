"use client";

import { useState, useTransition } from "react";
import {
  CrudTable,
  ColumnDef,
  CustomRenderers,
  CustomFormFields,
} from "@/components/crud-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createAllocationTemplate,
  updateAllocationTemplate,
  deleteAllocationTemplate,
  getAffectedTransactions,
  createTemplateOverrides,
  checkClosedMonthInvolvement,
} from "./actions";

type SelectOption = {
  value: string;
  label: string;
};

type LineData = {
  id?: number;
  costCenterId: string;
  costCenterName?: string;
  allocationRate: number;
  label: string;
};

type AffectedTransaction = {
  id: number;
  transactionDate: string;
  counterpartyName: string;
  costCenterName: string;
  amountIncludingTax: number;
  isClosed: boolean;
};

type Props = {
  data: Record<string, unknown>[];
  costCenterOptions: SelectOption[];
};

// 明細行エディタコンポーネント
function LinesEditor({
  lines,
  onChange,
  costCenterOptions,
}: {
  lines: LineData[];
  onChange: (lines: LineData[]) => void;
  costCenterOptions: SelectOption[];
}) {
  const totalRate = lines.reduce((sum, l) => sum + (l.allocationRate || 0), 0);
  const isValid = Math.abs(totalRate - 100) < 0.001;

  const addLine = () => {
    onChange([...lines, { costCenterId: "", allocationRate: 0, label: "" }]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof LineData, value: string | number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    onChange(newLines);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">按分明細</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4 mr-1" />
          行追加
        </Button>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          明細がありません。「行追加」ボタンで追加してください。
        </p>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">按分先</TableHead>
                <TableHead className="w-[120px]">按分率（%）</TableHead>
                <TableHead>ラベル</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={line.costCenterId || "_undecided"}
                      onValueChange={(v) =>
                        updateLine(index, "costCenterId", v === "_undecided" ? "" : v)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="選択..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_undecided">未確定</SelectItem>
                        {costCenterOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="h-8"
                      value={line.allocationRate || ""}
                      onChange={(e) =>
                        updateLine(
                          index,
                          "allocationRate",
                          e.target.value ? Number(e.target.value) : 0
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      className="h-8"
                      placeholder="例: 未確定"
                      value={line.label}
                      onChange={(e) =>
                        updateLine(index, "label", e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">合計:</span>
        <span className={isValid ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {totalRate.toFixed(2)}%
        </span>
        {!isValid && (
          <span className="text-red-600 text-xs">（100%にしてください）</span>
        )}
      </div>
    </div>
  );
}

export function AllocationTemplatesTable({
  data,
  costCenterOptions,
}: Props) {
  const [impactDialog, setImpactDialog] = useState<{
    open: boolean;
    templateId: number;
    transactions: AffectedTransaction[];
    hasClosedMonth: boolean;
    keepIds: Set<number>;
    pendingData: Record<string, unknown> | null;
    oldLines: LineData[];
    promiseHandlers: {
      resolve: () => void;
      reject: (error: Error) => void;
    } | null;
  }>({
    open: false,
    templateId: 0,
    transactions: [],
    hasClosedMonth: false,
    keepIds: new Set(),
    pendingData: null,
    oldLines: [],
    promiseHandlers: null,
  });
  const [isPending, startTransition] = useTransition();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "name",
      header: "テンプレート名",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "lineCount",
      header: "明細数",
      editable: false,
    },
    {
      key: "totalRate",
      header: "合計率",
      editable: false,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
    {
      key: "lines",
      header: "按分明細",
      hidden: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    lineCount: (value) => `${value}件`,
    totalRate: (value) => {
      const v = Number(value);
      return (
        <span className={Math.abs(v - 100) < 0.001 ? "text-green-600" : "text-red-600"}>
          {v}%
        </span>
      );
    },
    lines: (value) => {
      const lines = value as LineData[] | undefined;
      if (!lines || lines.length === 0) return "—";
      return lines
        .map((l) => `${l.costCenterName ?? "未確定"}: ${l.allocationRate}%`)
        .join(", ");
    },
  };

  const customFormFields: CustomFormFields = {
    lines: {
      render: (value, onChange) => {
        const lines = (value as LineData[] | undefined) ?? [];
        return (
          <LinesEditor
            lines={lines}
            onChange={(newLines) => onChange(newLines)}
            costCenterOptions={costCenterOptions}
          />
        );
      },
    },
  };

  // 作成ハンドラ
  const handleAdd = async (formData: Record<string, unknown>) => {
    const lines = formData.lines as LineData[] | undefined;
    const processedData = {
      ...formData,
      lines: (lines ?? []).map((l) => ({
        costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
        allocationRate: l.allocationRate,
        label: l.label || null,
      })),
    };
    await createAllocationTemplate(processedData);
  };

  // 更新ハンドラ（影響確認付き）
  const handleUpdate = async (
    id: number,
    formData: Record<string, unknown>
  ) => {
    // 明細変更がない場合はそのまま更新
    if (!("lines" in formData)) {
      await updateAllocationTemplate(id, formData);
      return;
    }

    // 影響する取引を確認
    const transactions = await getAffectedTransactions(id);

    if (transactions.length === 0) {
      // 取引がない場合はそのまま更新
      const lines = formData.lines as LineData[];
      const processedData = {
        ...formData,
        lines: lines.map((l) => ({
          costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
          allocationRate: l.allocationRate,
          label: l.label || null,
        })),
      };
      await updateAllocationTemplate(id, processedData);
      return;
    }

    // クローズ月関与チェック
    const hasClosedMonth = await checkClosedMonthInvolvement(id);

    // 元のテンプレートデータを取得
    const templateData = data.find((d) => d.id === id);
    const oldLines = (templateData?.lines as LineData[]) ?? [];

    return new Promise<void>((resolve, reject) => {
      setImpactDialog({
        open: true,
        templateId: id,
        transactions,
        hasClosedMonth,
        keepIds: new Set(),
        pendingData: formData,
        oldLines,
        promiseHandlers: { resolve, reject },
      });
    });
  };

  // 影響確認後の適用
  const handleApplyChanges = () => {
    if (!impactDialog.pendingData || !impactDialog.promiseHandlers) return;
    const { resolve, reject } = impactDialog.promiseHandlers;

    startTransition(async () => {
      try {
        const formData = impactDialog.pendingData!;
        const lines = formData.lines as LineData[];
        const processedData = {
          ...formData,
          lines: lines.map((l) => ({
            costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
            allocationRate: l.allocationRate,
            label: l.label || null,
          })),
        };

        await updateAllocationTemplate(impactDialog.templateId, processedData);

        // 変更前維持の取引にオーバーライドを作成
        const keepIds = Array.from(impactDialog.keepIds);
        if (keepIds.length > 0) {
          const snapshotRates = impactDialog.oldLines.map((l) => ({
            costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
            rate: l.allocationRate,
          }));
          await createTemplateOverrides(
            impactDialog.templateId,
            keepIds,
            snapshotRates
          );
        }

        setImpactDialog({
          open: false,
          templateId: 0,
          transactions: [],
          hasClosedMonth: false,
          keepIds: new Set(),
          pendingData: null,
          oldLines: [],
          promiseHandlers: null,
        });
        resolve();
      } catch (error) {
        setImpactDialog((prev) => ({
          ...prev,
          open: false,
          promiseHandlers: null,
        }));
        reject(
          error instanceof Error ? error : new Error("更新に失敗しました")
        );
      }
    });
  };

  const handleCancelImpact = () => {
    if (impactDialog.promiseHandlers) {
      impactDialog.promiseHandlers.reject(new Error("キャンセルされました"));
    }
    setImpactDialog({
      open: false,
      templateId: 0,
      transactions: [],
      hasClosedMonth: false,
      keepIds: new Set(),
      pendingData: null,
      oldLines: [],
      promiseHandlers: null,
    });
  };

  const toggleKeepTransaction = (txId: number) => {
    setImpactDialog((prev) => {
      const newKeepIds = new Set(prev.keepIds);
      if (newKeepIds.has(txId)) {
        newKeepIds.delete(txId);
      } else {
        newKeepIds.add(txId);
      }
      return { ...prev, keepIds: newKeepIds };
    });
  };

  const toggleAllKeep = () => {
    setImpactDialog((prev) => {
      const allSelected =
        prev.transactions.length > 0 &&
        prev.keepIds.size === prev.transactions.length;
      const newKeepIds = allSelected
        ? new Set<number>()
        : new Set(prev.transactions.map((t) => t.id));
      return { ...prev, keepIds: newKeepIds };
    });
  };

  const handleDelete = async (id: number) => {
    await deleteAllocationTemplate(id);
    toast.success("テンプレートを削除しました");
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="按分テンプレート"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        emptyMessage="按分テンプレートが登録されていません"
        customRenderers={customRenderers}
        customFormFields={customFormFields}
      />

      {/* 影響確認ダイアログ */}
      <Dialog
        open={impactDialog.open}
        onOpenChange={(open) => {
          if (!open && impactDialog.promiseHandlers && !isPending) {
            handleCancelImpact();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              テンプレート変更の影響確認
            </DialogTitle>
            <DialogDescription>
              この変更は以下の{impactDialog.transactions.length}
              件の取引に影響します。「変更前維持」にチェックした取引は変更前の按分率を維持します。
            </DialogDescription>
          </DialogHeader>

          {impactDialog.hasClosedMonth && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              クローズ済みの月次に関わる取引が含まれています。この変更には経理管理者権限が必要です。
            </div>
          )}

          <div className="max-h-80 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={
                        impactDialog.transactions.length > 0 &&
                        impactDialog.keepIds.size ===
                          impactDialog.transactions.length
                      }
                      onCheckedChange={toggleAllKeep}
                    />
                  </TableHead>
                  <TableHead>取引日</TableHead>
                  <TableHead>取引先</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impactDialog.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Checkbox
                        checked={impactDialog.keepIds.has(tx.id)}
                        onCheckedChange={() => toggleKeepTransaction(tx.id)}
                      />
                    </TableCell>
                    <TableCell>{tx.transactionDate}</TableCell>
                    <TableCell>{tx.counterpartyName}</TableCell>
                    <TableCell className="text-right">
                      {tx.amountIncludingTax.toLocaleString()}円
                    </TableCell>
                    <TableCell>
                      {tx.isClosed ? (
                        <Badge variant="destructive">クローズ済</Badge>
                      ) : (
                        <Badge variant="outline">オープン</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            チェックなし = 変更後の按分率を適用、チェックあり = 変更前の按分率を維持
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelImpact}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button onClick={handleApplyChanges} disabled={isPending}>
              変更を適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
