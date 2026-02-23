"use client";

import { useState, useTransition } from "react";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { SortableItem } from "@/components/sortable-list-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  createAutoJournalRule,
  updateAutoJournalRule,
  deleteAutoJournalRule,
  reorderAutoJournalRules,
  checkConflictingRules,
} from "./actions";

type SelectOption = {
  value: string;
  label: string;
};

type ConflictingRule = {
  id: number;
  counterpartyName: string;
  transactionType: string | null;
  expenseCategoryName: string;
  debitAccountName: string;
  creditAccountName: string;
  priority: number;
};

type Props = {
  data: Record<string, unknown>[];
  counterpartyOptions: SelectOption[];
  expenseCategoryOptions: SelectOption[];
  accountOptions: SelectOption[];
};

const TRANSACTION_TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "（全種別）" },
  { value: "revenue", label: "売上" },
  { value: "expense", label: "経費" },
];

export function AutoJournalTable({
  data,
  counterpartyOptions,
  expenseCategoryOptions,
  accountOptions,
}: Props) {
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    conflicts: ConflictingRule[];
    pendingData: Record<string, unknown> | null;
    isUpdate: boolean;
    updateId: number | null;
    promiseHandlers: {
      resolve: () => void;
      reject: (error: Error) => void;
    } | null;
  }>({
    open: false,
    conflicts: [],
    pendingData: null,
    isUpdate: false,
    updateId: null,
    promiseHandlers: null,
  });
  const [isCreating, startTransition] = useTransition();

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    {
      key: "counterpartyId",
      header: "取引先",
      type: "select",
      options: [{ value: "", label: "（全取引先）" }, ...counterpartyOptions],
      filterable: true,
      searchable: true,
    },
    {
      key: "transactionType",
      header: "種別",
      type: "select",
      options: TRANSACTION_TYPE_OPTIONS,
      filterable: true,
    },
    {
      key: "expenseCategoryId",
      header: "費目",
      type: "select",
      options: [
        { value: "", label: "（全費目）" },
        ...expenseCategoryOptions,
      ],
      filterable: true,
      searchable: true,
    },
    {
      key: "debitAccountId",
      header: "借方科目",
      type: "select",
      options: accountOptions,
      required: true,
      filterable: true,
      searchable: true,
    },
    {
      key: "creditAccountId",
      header: "貸方科目",
      type: "select",
      options: accountOptions,
      required: true,
      filterable: true,
      searchable: true,
    },
    {
      key: "priority",
      header: "優先度",
      type: "number",
      defaultValue: 100,
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  const customRenderers: CustomRenderers = {
    counterpartyId: (value, item) => {
      if (!value) return "（全取引先）";
      const option = counterpartyOptions.find(
        (o) => o.value === String(value)
      );
      if (option) return option.label;
      const label = item?.counterpartyLabel as string | undefined;
      return label ? `${label}（無効）` : "（全取引先）";
    },
    transactionType: (value) => {
      if (!value) return "（全種別）";
      const option = TRANSACTION_TYPE_OPTIONS.find(
        (o) => o.value === String(value)
      );
      return option ? option.label : String(value);
    },
    expenseCategoryId: (value, item) => {
      if (!value) return "（全費目）";
      const option = expenseCategoryOptions.find(
        (o) => o.value === String(value)
      );
      if (option) return option.label;
      const label = item?.expenseCategoryLabel as string | undefined;
      return label ? `${label}（無効）` : "（全費目）";
    },
    debitAccountId: (value, item) => {
      if (!value) return "";
      const option = accountOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.debitAccountLabel as string | undefined;
      return label ? `${label}（無効）` : "";
    },
    creditAccountId: (value, item) => {
      if (!value) return "";
      const option = accountOptions.find((o) => o.value === String(value));
      if (option) return option.label;
      const label = item?.creditAccountLabel as string | undefined;
      return label ? `${label}（無効）` : "";
    },
  };

  const sortableItems: SortableItem[] = data.map((item) => {
    const counterpartyLabel =
      counterpartyOptions.find(
        (o) => o.value === String(item.counterpartyId)
      )?.label ?? "全取引先";
    const typeLabel =
      TRANSACTION_TYPE_OPTIONS.find(
        (o) => o.value === String(item.transactionType ?? "")
      )?.label ?? "全種別";
    const categoryLabel =
      expenseCategoryOptions.find(
        (o) => o.value === String(item.expenseCategoryId)
      )?.label ?? "全費目";

    return {
      id: item.id as number,
      label: `[${item.priority}] ${counterpartyLabel}`,
      subLabel: `${typeLabel} / ${categoryLabel}`,
    };
  });

  // 競合チェック付きの作成ハンドラ
  const handleAdd = async (formData: Record<string, unknown>) => {
    const counterpartyId = formData.counterpartyId
      ? Number(formData.counterpartyId)
      : null;
    const transactionType = formData.transactionType
      ? (formData.transactionType as string)
      : null;
    const expenseCategoryId = formData.expenseCategoryId
      ? Number(formData.expenseCategoryId)
      : null;

    // 競合チェック
    const conflicts = await checkConflictingRules({
      counterpartyId,
      transactionType,
      expenseCategoryId,
    });

    if (conflicts.length > 0) {
      return new Promise<void>((resolve, reject) => {
        setConflictDialog({
          open: true,
          conflicts,
          pendingData: formData,
          isUpdate: false,
          updateId: null,
          promiseHandlers: { resolve, reject },
        });
      });
    }

    await createAutoJournalRule(formData);
  };

  // 競合チェック付きの更新ハンドラ
  const handleUpdate = async (
    id: number,
    formData: Record<string, unknown>
  ) => {
    const counterpartyId =
      "counterpartyId" in formData
        ? formData.counterpartyId
          ? Number(formData.counterpartyId)
          : null
        : (data.find((d) => d.id === id)?.counterpartyId as number | null) ??
          null;
    const transactionType =
      "transactionType" in formData
        ? formData.transactionType
          ? (formData.transactionType as string)
          : null
        : (data.find((d) => d.id === id)?.transactionType as string | null) ??
          null;
    const expenseCategoryId =
      "expenseCategoryId" in formData
        ? formData.expenseCategoryId
          ? Number(formData.expenseCategoryId)
          : null
        : (data.find((d) => d.id === id)?.expenseCategoryId as number | null) ??
          null;

    // 競合チェック（自分自身を除外）
    const conflicts = await checkConflictingRules({
      counterpartyId,
      transactionType,
      expenseCategoryId,
      excludeId: id,
    });

    if (conflicts.length > 0) {
      return new Promise<void>((resolve, reject) => {
        setConflictDialog({
          open: true,
          conflicts,
          pendingData: formData,
          isUpdate: true,
          updateId: id,
          promiseHandlers: { resolve, reject },
        });
      });
    }

    await updateAutoJournalRule(id, formData);
  };

  const handleConfirmSave = () => {
    if (!conflictDialog.pendingData || !conflictDialog.promiseHandlers) return;
    const { resolve, reject } = conflictDialog.promiseHandlers;

    startTransition(async () => {
      try {
        if (conflictDialog.isUpdate && conflictDialog.updateId !== null) {
          await updateAutoJournalRule(
            conflictDialog.updateId,
            conflictDialog.pendingData!
          );
        } else {
          await createAutoJournalRule(conflictDialog.pendingData!);
        }
        setConflictDialog({
          open: false,
          conflicts: [],
          pendingData: null,
          isUpdate: false,
          updateId: null,
          promiseHandlers: null,
        });
        resolve();
      } catch (error) {
        reject(
          error instanceof Error ? error : new Error("保存に失敗しました")
        );
      }
    });
  };

  const handleCancelConflict = () => {
    if (conflictDialog.promiseHandlers) {
      conflictDialog.promiseHandlers.reject(new Error("キャンセルされました"));
    }
    setConflictDialog({
      open: false,
      conflicts: [],
      pendingData: null,
      isUpdate: false,
      updateId: null,
      promiseHandlers: null,
    });
  };

  const handleDelete = async (id: number) => {
    await deleteAutoJournalRule(id);
    toast.success("ルールを削除しました");
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="自動仕訳ルール"
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        emptyMessage="自動仕訳ルールが登録されていません"
        sortableItems={sortableItems}
        onReorder={reorderAutoJournalRules}
        customRenderers={customRenderers}
      />

      {/* 競合警告ダイアログ */}
      <Dialog
        open={conflictDialog.open}
        onOpenChange={(open) => {
          if (!open && conflictDialog.promiseHandlers && !isCreating) {
            handleCancelConflict();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              同じ条件のルールが存在します
            </DialogTitle>
            <DialogDescription>
              同じ条件（取引先・種別・費目）のルールが既に登録されています。
              保存する場合は優先度の設定にご注意ください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {conflictDialog.conflicts.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div className="space-y-1">
                  <div className="font-medium text-sm">
                    {rule.counterpartyName} /{" "}
                    {rule.transactionType
                      ? rule.transactionType === "revenue"
                        ? "売上"
                        : "経費"
                      : "全種別"}{" "}
                    / {rule.expenseCategoryName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    借方: {rule.debitAccountName} → 貸方:{" "}
                    {rule.creditAccountName}
                  </div>
                </div>
                <Badge variant="outline">優先度 {rule.priority}</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelConflict}
              disabled={isCreating}
            >
              キャンセル
            </Button>
            <Button onClick={handleConfirmSave} disabled={isCreating}>
              保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
