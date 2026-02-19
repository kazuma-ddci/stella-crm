"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  ContractStatusManagementData,
  ContractStatusValidationResult,
} from "@/lib/contract-status/types";
import {
  getContractStatusManagementData,
  updateContractStatusWithHistory,
} from "@/app/stp/contracts/status-management/actions";
import { CurrentStatusSection } from "./current-status-section";
import { StatusProgressVisual } from "./status-progress-visual";
import { StatusHistorySection } from "./status-history-section";
import { StatisticsSection } from "./statistics-section";
import { StatusUpdateForm } from "./status-update-form";
import { ContractStatusAlertDialog } from "./alert-dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ContractStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number | null;
  onUpdateSuccess?: () => void;
}

export function ContractStatusModal({
  open,
  onOpenChange,
  contractId,
  onUpdateSuccess,
}: ContractStatusModalProps) {
  const [data, setData] = useState<ContractStatusManagementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // アラートダイアログの状態
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{
    newStatusId: number | null;
    note: string;
    validation: ContractStatusValidationResult;
    signedDate?: string;
  } | null>(null);
  const [alertNote, setAlertNote] = useState("");

  // データを読み込む
  useEffect(() => {
    async function loadData() {
      if (!open || !contractId) return;

      setLoading(true);
      try {
        const result = await getContractStatusManagementData(contractId);
        setData(result);
      } catch (error) {
        console.error("Failed to load contract status data:", error);
        toast.error("データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, contractId]);

  // モーダルを閉じたときにリセット
  useEffect(() => {
    if (!open) {
      setData(null);
      setPendingSubmit(null);
      setAlertNote("");
      setHasFormChanges(false);
    }
  }, [open]);

  // 変更状態の更新ハンドラ
  const handleHasChangesChange = useCallback((hasChanges: boolean) => {
    setHasFormChanges(hasChanges);
  }, []);

  // キャンセルボタンのクリックハンドラ
  const handleCancel = () => {
    if (hasFormChanges) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  };

  // 確認後の閉じる処理
  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    onOpenChange(false);
  };

  const handleFormSubmit = async (params: {
    newStatusId: number | null;
    note: string;
    alertAcknowledged: boolean;
    validation: ContractStatusValidationResult;
    signedDate?: string;
  }) => {
    const { validation } = params;

    // ERRORがある場合は何もしない
    if (!validation.isValid && validation.hasErrors) {
      return;
    }

    // WARNINGがある場合はアラートダイアログを表示
    if (validation.hasWarnings) {
      setPendingSubmit(params);
      setAlertNote(params.note);
      setAlertDialogOpen(true);
      return;
    }

    // アラートがない場合はそのまま保存
    await executeSubmit(params);
  };

  const handleAlertConfirm = async () => {
    if (!pendingSubmit) return;

    await executeSubmit({
      ...pendingSubmit,
      note: alertNote || pendingSubmit.note,
      alertAcknowledged: true,
    });

    setAlertDialogOpen(false);
    setPendingSubmit(null);
    setAlertNote("");
  };

  const executeSubmit = async (params: {
    newStatusId: number | null;
    note: string;
    alertAcknowledged?: boolean;
    signedDate?: string;
  }) => {
    if (!contractId) return;

    setSaving(true);
    try {
      const result = await updateContractStatusWithHistory({
        contractId,
        newStatusId: params.newStatusId,
        note: params.note,
        alertAcknowledged: params.alertAcknowledged,
        signedDate: params.signedDate,
      });

      if (result.success) {
        toast.success("ステータスを更新しました");
        // モーダルを閉じる
        onOpenChange(false);
        // 親コンポーネントに成功を通知
        onUpdateSuccess?.();
      } else {
        toast.error(result.error ?? "ステータスの更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update contract status:", error);
      toast.error("ステータスの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(newOpen) => {
          if (!newOpen && hasFormChanges) {
            setShowDiscardConfirm(true);
          } else {
            onOpenChange(newOpen);
          }
        }}
      >
        <DialogContent
          size="mixed"
          className="p-0 overflow-hidden flex flex-col"
        >
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>
              契約書ステータス管理
              {data && (
                <span className="font-normal text-muted-foreground ml-2">
                  {data.contractTitle}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div
              className="px-6 py-4"
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: 0,
              }}
            >
              <div className="space-y-4">
                <CurrentStatusSection data={data} />
                <StatusProgressVisual
                  statuses={data.statuses}
                  currentStatusId={data.currentStatusId}
                />
                <StatusHistorySection histories={data.histories} />
                <StatisticsSection statistics={data.statistics} />

                <div className="pt-4 border-t">
                  <StatusUpdateForm
                    statuses={data.statuses}
                    currentStatusId={data.currentStatusId}
                    onSubmit={handleFormSubmit}
                    onCancel={handleCancel}
                    loading={saving}
                    hasChanges={hasFormChanges}
                    onHasChangesChange={handleHasChangesChange}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground flex-1">
              データが見つかりませんでした
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* アラート確認ダイアログ */}
      <ContractStatusAlertDialog
        alerts={pendingSubmit?.validation.alerts ?? []}
        open={alertDialogOpen}
        onOpenChange={setAlertDialogOpen}
        note={alertNote}
        onNoteChange={setAlertNote}
        onConfirm={handleAlertConfirm}
        loading={saving}
      />

      {/* 変更破棄確認ダイアログ */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>変更を破棄しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              入力した内容が破棄されます。よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              破棄する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
