"use client";

import { useState, useTransition } from "react";
import { CrudTable, ColumnDef, CustomRenderers } from "@/components/crud-table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  createCounterparty,
  updateCounterparty,
  syncCounterparties,
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

type CompanyOption = {
  value: string;
  label: string;
};

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
  companyOptions: CompanyOption[];
};

export function CounterpartiesTable({ data, companyOptions }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const [similarDialog, setSimilarDialog] = useState<SimilarDialogState>({
    open: false,
    candidates: [],
    pendingData: null,
    promiseHandlers: null,
  });

  const columns: ColumnDef[] = [
    { key: "id", header: "ID", editable: false, hidden: true },
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
      key: "companyId",
      header: "CRM企業",
      type: "select",
      options: [{ value: "", label: "（なし）" }, ...companyOptions],
      searchable: true,
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

  const customRenderers: CustomRenderers = {
    companyId: (value) => {
      if (!value) return "（なし）";
      const option = companyOptions.find((o) => o.value === String(value));
      return option ? option.label : "（なし）";
    },
  };

  // 類似名称チェック付き作成（Promise保留でCrudTable連携 — Issue 3修正）
  const handleAdd = async (formData: Record<string, unknown>) => {
    const name = (formData.name as string)?.trim();
    if (!name) {
      throw new Error("名称は必須です");
    }

    // 類似名称チェック
    const candidates = await checkSimilarCounterparties(name);
    if (candidates.length === 0) {
      // 類似なし → そのまま作成
      await createCounterparty(formData);
      return;
    }

    // 類似候補がある場合はPromiseを保留してユーザーの判断を待つ
    return new Promise<void>((resolve, reject) => {
      setSimilarDialog({
        open: true,
        candidates,
        pendingData: formData,
        promiseHandlers: { resolve, reject },
      });
    });
  };

  // 類似候補確認後に新規作成
  const handleConfirmCreate = async () => {
    if (!similarDialog.pendingData || !similarDialog.promiseHandlers) return;
    const { resolve, reject } = similarDialog.promiseHandlers;
    const pendingData = similarDialog.pendingData;

    setIsCreating(true);
    try {
      await createCounterparty(pendingData);
      setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
      resolve();
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
    reject(new Error(`既存の取引先「${candidate.name}」を選択しました`));
  };

  // キャンセル（ダイアログを閉じてフォームに戻る）
  const handleCancelSimilar = () => {
    if (!similarDialog.promiseHandlers) return;
    const { reject } = similarDialog.promiseHandlers;
    setSimilarDialog({ open: false, candidates: [], pendingData: null, promiseHandlers: null });
    reject(new Error("類似する取引先があります。名称を変更して再試行してください。"));
  };

  // 同期ボタン
  const handleSync = () => {
    startTransition(async () => {
      try {
        const result = await syncCounterparties();
        toast.success(
          `同期完了: 新規${result.created}件、更新${result.updated}件（対象${result.total}件）`
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "同期に失敗しました"
        );
      }
    });
  };

  const syncButton = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={isPending}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
      CRM企業を同期
    </Button>
  );

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        title="取引先"
        onAdd={handleAdd}
        onUpdate={updateCounterparty}
        emptyMessage="取引先が登録されていません"
        customRenderers={customRenderers}
        customAddButton={syncButton}
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
