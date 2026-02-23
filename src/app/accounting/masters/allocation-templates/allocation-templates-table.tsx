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
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, AlertTriangle, Copy } from "lucide-react";
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
  isAdmin: boolean; // ★ Issue 1: 経理管理者かどうか
};

// ★ Issue 2: 按分率変更の検出
function detectRateChanges(oldLines: LineData[], newLines: LineData[]): boolean {
  if (oldLines.length !== newLines.length) return true;

  const oldRateById = new Map<number, number>();
  for (const line of oldLines) {
    if (line.id) oldRateById.set(line.id, line.allocationRate);
  }

  for (const line of newLines) {
    if (line.id && oldRateById.has(line.id)) {
      if (Math.abs(oldRateById.get(line.id)! - line.allocationRate) > 0.001) {
        return true;
      }
      oldRateById.delete(line.id);
    } else {
      // 新規行（IDなし）またはIDが一致しない行 → 構造変更
      return true;
    }
  }

  return oldRateById.size > 0;
}

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
  isAdmin,
}: Props) {
  // 影響確認ダイアログ
  const [impactDialog, setImpactDialog] = useState<{
    open: boolean;
    templateId: number;
    transactions: AffectedTransaction[];
    hasClosedMonth: boolean;
    keepIds: Set<number>;
    pendingData: Record<string, unknown> | null;
    oldLines: LineData[];
    reason: string; // ★ Issue 3: 維持理由
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
    reason: "",
    promiseHandlers: null,
  });

  // ★ Issue 2: 按分率変更ダイアログ
  const [rateChangeDialog, setRateChangeDialog] = useState<{
    open: boolean;
    newName: string;
    lines: LineData[];
    promiseHandlers: {
      resolve: () => void;
      reject: (error: Error) => void;
    } | null;
  }>({
    open: false,
    newName: "",
    lines: [],
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

    const newLines = formData.lines as LineData[];
    const templateData = data.find((d) => d.id === id);
    const oldLines = (templateData?.lines as LineData[]) ?? [];

    // ★ Issue 2: 按分率変更の検出 → 新テンプレート作成を促す
    if (detectRateChanges(oldLines, newLines)) {
      return new Promise<void>((resolve, reject) => {
        setRateChangeDialog({
          open: true,
          newName: `${(templateData?.name as string) ?? ""} (v2)`,
          lines: newLines,
          promiseHandlers: { resolve, reject },
        });
      });
    }

    // 以降は明細変更（costCenterId/label のみ）のフロー
    // 影響する取引を確認
    const transactions = await getAffectedTransactions(id);

    if (transactions.length === 0) {
      // 取引がない場合はそのまま更新
      const processedData = {
        ...formData,
        lines: newLines.map((l) => ({
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

    return new Promise<void>((resolve, reject) => {
      setImpactDialog({
        open: true,
        templateId: id,
        transactions,
        hasClosedMonth,
        keepIds: new Set(),
        pendingData: formData,
        oldLines,
        reason: "",
        promiseHandlers: { resolve, reject },
      });
    });
  };

  // ★ Issue 2: 按分率変更 → 新テンプレートとして保存
  const handleCreateAsNewTemplate = () => {
    if (!rateChangeDialog.promiseHandlers) return;
    const { resolve, reject } = rateChangeDialog.promiseHandlers;

    startTransition(async () => {
      try {
        const processedData = {
          name: rateChangeDialog.newName.trim(),
          isActive: true,
          lines: rateChangeDialog.lines.map((l) => ({
            costCenterId: l.costCenterId ? Number(l.costCenterId) : null,
            allocationRate: l.allocationRate,
            label: l.label || null,
          })),
        };
        await createAllocationTemplate(processedData);
        toast.success("新テンプレートとして保存しました");
        setRateChangeDialog({
          open: false,
          newName: "",
          lines: [],
          promiseHandlers: null,
        });
        resolve();
      } catch (error) {
        setRateChangeDialog({
          open: false,
          newName: "",
          lines: [],
          promiseHandlers: null,
        });
        reject(
          error instanceof Error ? error : new Error("保存に失敗しました")
        );
      }
    });
  };

  const handleCancelRateChange = () => {
    if (rateChangeDialog.promiseHandlers) {
      rateChangeDialog.promiseHandlers.reject(new Error("キャンセルされました"));
    }
    setRateChangeDialog({
      open: false,
      newName: "",
      lines: [],
      promiseHandlers: null,
    });
  };

  // 影響確認後の適用
  const handleApplyChanges = () => {
    if (!impactDialog.pendingData || !impactDialog.promiseHandlers) return;

    // ★ Issue 1: 非管理者がクローズ月関与時に変更を試みた場合はクライアント側でもブロック
    if (impactDialog.hasClosedMonth && !isAdmin) {
      impactDialog.promiseHandlers.reject(
        new Error("クローズ済みの月に関わるテンプレートの変更は経理管理者権限が必要です")
      );
      setImpactDialog({
        open: false,
        templateId: 0,
        transactions: [],
        hasClosedMonth: false,
        keepIds: new Set(),
        pendingData: null,
        oldLines: [],
        reason: "",
        promiseHandlers: null,
      });
      return;
    }

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
            snapshotRates,
            impactDialog.reason || undefined // ★ Issue 3: 維持理由
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
          reason: "",
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
      reason: "",
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

      {/* ★ Issue 2: 按分率変更ダイアログ */}
      <Dialog
        open={rateChangeDialog.open}
        onOpenChange={(open) => {
          if (!open && rateChangeDialog.promiseHandlers && !isPending) {
            handleCancelRateChange();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-500" />
              按分率の変更が検出されました
            </DialogTitle>
            <DialogDescription>
              按分率の変更は新テンプレートとして保存する必要があります。旧テンプレートは既存取引で引き続き参照されます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="newTemplateName">新テンプレート名</Label>
              <Input
                id="newTemplateName"
                value={rateChangeDialog.newName}
                onChange={(e) =>
                  setRateChangeDialog((prev) => ({
                    ...prev,
                    newName: e.target.value,
                  }))
                }
                placeholder="例: テンプレート名 (v2)"
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>変更後の按分明細:</p>
              <ul className="mt-1 space-y-1">
                {rateChangeDialog.lines.map((line, i) => {
                  const costCenterName =
                    line.costCenterId
                      ? costCenterOptions.find((o) => o.value === line.costCenterId)?.label ?? "不明"
                      : "未確定";
                  return (
                    <li key={i} className="ml-4 list-disc">
                      {costCenterName}: {line.allocationRate}%
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelRateChange}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleCreateAsNewTemplate}
              disabled={isPending || !rateChangeDialog.newName.trim()}
            >
              新テンプレートとして保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

          {/* ★ Issue 1: クローズ済み月の警告（非管理者にはブロック表示） */}
          {impactDialog.hasClosedMonth && (
            <div className={`border rounded-md p-3 text-sm ${
              isAdmin
                ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {isAdmin
                ? "クローズ済みの月次に関わる取引が含まれています。経理管理者権限で変更を適用できます。"
                : "クローズ済みの月次に関わる取引が含まれています。この変更には経理管理者権限が必要なため、変更を適用できません。"}
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

          {/* ★ Issue 3: 維持理由入力欄 */}
          {impactDialog.keepIds.size > 0 && (
            <div className="space-y-1">
              <Label htmlFor="overrideReason" className="text-sm">
                維持理由（任意）
              </Label>
              <Textarea
                id="overrideReason"
                value={impactDialog.reason}
                onChange={(e) =>
                  setImpactDialog((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                placeholder="変更前の按分率を維持する理由を入力..."
                rows={2}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelImpact}
              disabled={isPending}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleApplyChanges}
              disabled={isPending || (impactDialog.hasClosedMonth && !isAdmin)}
            >
              変更を適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
