"use client";

import { useState } from "react";
import { CrudTable, ColumnDef } from "@/components/crud-table";
import { Button } from "@/components/ui/button";
import {
  createCounterparty,
  updateCounterparty,
  checkSimilarCounterparties,
} from "./actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TYPE_OPTIONS = [
  { value: "customer", label: "顧客" },
  { value: "vendor", label: "仕入先" },
  { value: "service", label: "サービス" },
  { value: "other", label: "その他" },
];

type SimilarCandidate = {
  id: number;
  name: string;
  counterpartyType: string;
  isActive: boolean;
  company: { id: number; name: string } | null;
};

type SimilarDialogState = {
  open: boolean;
  candidates: SimilarCandidate[];
  pendingData: Record<string, unknown> | null;
  promiseHandlers: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null;
};

type Props = {
  data: Record<string, unknown>[];
};

export function CounterpartiesTable({ data }: Props) {
  const [isCreating, setIsCreating] = useState(false);
  const [similarDialog, setSimilarDialog] = useState<SimilarDialogState>({
    open: false,
    candidates: [],
    pendingData: null,
    promiseHandlers: null,
  });

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
    { key: "displayId", header: "取引先ID", editable: false },
    {
      key: "name",
      header: "名称",
      type: "text",
      required: true,
      filterable: true,
    },
    {
      key: "counterpartyType",
      header: "種別",
      type: "select",
      options: TYPE_OPTIONS,
      required: true,
      filterable: true,
      defaultValue: "other",
    },
    {
      key: "isInvoiceRegistered",
      header: "インボイス",
      type: "boolean",
      defaultValue: false,
    },
    {
      key: "invoiceRegistrationNumber",
      header: "登録番号",
      type: "text",
      visibleWhen: { field: "isInvoiceRegistered", value: true },
    },
    {
      key: "invoiceEffectiveDate",
      header: "インボイス適用日",
      type: "date",
      visibleWhen: { field: "isInvoiceRegistered", value: true },
    },
    {
      key: "memo",
      header: "メモ",
      type: "textarea",
    },
    {
      key: "isActive",
      header: "有効",
      type: "boolean",
      defaultValue: true,
    },
  ];

  // 類似名称チェック付き作成（Promise保留でCrudTable連携 — Issue 3修正）
  const handleAdd = async (formData: Record<string, unknown>) => {
    const name = (formData.name as string)?.trim();
    if (!name) {
      return { ok: false as const, error: "名称は必須です" };
    }

    // 類似名称チェック
    const candidates = await checkSimilarCounterparties(name);
    if (candidates.length === 0) {
      // 類似なし → そのまま作成
      return await createCounterparty(formData);
    }

    // 類似候補がある場合はPromiseを保留してユーザーの判断を待つ
    return new Promise<{ ok: true; data: void } | { ok: false; error: string }>(
      (resolve) => {
        setSimilarDialog({
          open: true,
          candidates,
          pendingData: formData,
          promiseHandlers: {
            resolve: () => resolve({ ok: true, data: undefined }),
            reject: (error: Error) => resolve({ ok: false, error: error.message }),
          },
        });
      }
    );
  };

  // 類似候補確認後に新規作成
  const handleConfirmCreate = async () => {
    if (!similarDialog.pendingData || !similarDialog.promiseHandlers) return;
    const { resolve, reject } = similarDialog.promiseHandlers;
    const pendingData = similarDialog.pendingData;

    setIsCreating(true);
    try {
      const result = await createCounterparty(pendingData);
      setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
      if (result.ok) {
        resolve();
      } else {
        reject(new Error(result.error));
      }
    } catch (error) {
      setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
      reject(error instanceof Error ? error : new Error("作成に失敗しました"));
    } finally {
      setIsCreating(false);
    }
  };

  // 既存の取引先を選択（設計書5.7: 「既存を選択」オプション — Issue 2修正）
  const handleSelectExisting = (candidate: SimilarCandidate) => {
    if (!similarDialog.promiseHandlers) return;
    const { reject } = similarDialog.promiseHandlers;
    setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
    const error = new Error(`新規作成をキャンセルしました（既存: ${candidate.name}）`);
    (error as Error & { isCancel: boolean }).isCancel = true;
    reject(error);
  };

  // キャンセル（ダイアログを閉じてフォームに戻る）
  const handleCancelSimilar = () => {
    if (!similarDialog.promiseHandlers) return;
    const { reject } = similarDialog.promiseHandlers;
    setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
    reject(new Error("類似する取引先があります。名称を変更して再試行してください。"));
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="その他取引先"
        onAdd={handleAdd}
        onUpdate={updateCounterparty}
        emptyMessage="取引先が登録されていません"
      />

      {/* 類似名称確認ダイアログ */}
      <Dialog
        open={similarDialog.open}
        onOpenChange={(open) => {
          if (!open && similarDialog.promiseHandlers && !isCreating) {
            handleCancelSimilar();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>類似する取引先が見つかりました</DialogTitle>
            <DialogDescription>
              入力した名称に類似する取引先が既に登録されています。既存の取引先を選択するか、新規作成してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {similarDialog.candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <div className="font-medium">{candidate.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {TYPE_OPTIONS.find(
                      (o) => o.value === candidate.counterpartyType
                    )?.label ?? candidate.counterpartyType}
                    {candidate.company && ` / CRM: ${candidate.company.name}`}
                    {!candidate.isActive && " (無効)"}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSelectExisting(candidate)}
                  disabled={isCreating}
                >
                  選択
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelSimilar}
              disabled={isCreating}
            >
              キャンセル
            </Button>
            <Button onClick={handleConfirmCreate} disabled={isCreating}>
              新規作成する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
