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
import { StageManagementData, ValidationResult } from "@/lib/stage-transition/types";
import { getStageManagementData, updateStageWithHistory } from "@/app/stp/companies/stage-management/actions";
import { CurrentStatusSection } from "./current-status-section";
import { StageProgressVisual } from "./stage-progress-visual";
import { StageHistorySection } from "./stage-history-section";
import { StatisticsSection } from "./statistics-section";
import { StageUpdateForm } from "./stage-update-form";
import { StageAlertDialog } from "./alert-dialog";
import { ReasonEditSection } from "./reason-edit-section";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface StageManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stpCompanyId: number | null;
  onUpdateSuccess?: () => void;
}

export function StageManagementModal({
  open,
  onOpenChange,
  stpCompanyId,
  onUpdateSuccess,
}: StageManagementModalProps) {
  const [data, setData] = useState<StageManagementData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasFormChanges, setHasFormChanges] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // アラートダイアログの状態
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{
    newStageId: number | null;
    newTargetStageId: number | null;
    newTargetDate: Date | null;
    note: string;
    validation: ValidationResult;
    lostReason?: string;
    pendingReason?: string;
    pendingResponseDate?: Date | null;
  } | null>(null);
  const [alertNote, setAlertNote] = useState("");

  // データを読み込む
  useEffect(() => {
    async function loadData() {
      if (!open || !stpCompanyId) return;

      setLoading(true);
      try {
        const result = await getStageManagementData(stpCompanyId);
        setData(result);
      } catch (error) {
        console.error("Failed to load stage management data:", error);
        toast.error("データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [open, stpCompanyId]);

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
    newStageId: number | null;
    newTargetStageId: number | null;
    newTargetDate: Date | null;
    note: string;
    alertAcknowledged: boolean;
    validation: ValidationResult;
    lostReason?: string;
    pendingReason?: string;
    pendingResponseDate?: Date | null;
  }) => {
    const { validation } = params;

    // ERRORがある場合は何もしない（フォーム側でブロック済み）
    if (!validation.isValid) {
      return;
    }

    // WARNINGまたはINFOがある場合はアラートダイアログを表示
    if (validation.hasWarnings || validation.hasInfos) {
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
    newStageId: number | null;
    newTargetStageId: number | null;
    newTargetDate: Date | null;
    note: string;
    alertAcknowledged?: boolean;
    lostReason?: string;
    pendingReason?: string;
    pendingResponseDate?: Date | null;
  }) => {
    if (!stpCompanyId) return;

    setSaving(true);
    try {
      const result = await updateStageWithHistory({
        stpCompanyId,
        newStageId: params.newStageId,
        newTargetStageId: params.newTargetStageId,
        newTargetDate: params.newTargetDate,
        note: params.note,
        alertAcknowledged: params.alertAcknowledged,
        lostReason: params.lostReason,
        pendingReason: params.pendingReason,
        pendingResponseDate: params.pendingResponseDate,
      });

      if (result.success) {
        toast.success("パイプラインを更新しました");
        // モーダルを閉じる
        onOpenChange(false);
        // 親コンポーネントに成功を通知（一覧の再取得などのため）
        onUpdateSuccess?.();
      } else {
        toast.error(result.error ?? "パイプラインの更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update stage:", error);
      toast.error("パイプラインの更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(newOpen) => {
        if (!newOpen && hasFormChanges) {
          setShowDiscardConfirm(true);
        } else {
          onOpenChange(newOpen);
        }
      }}>
        <DialogContent
          size="form"
          className="p-0 overflow-hidden flex flex-col"
        >
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>
              パイプライン管理
              {data && (
                <span className="font-normal text-muted-foreground ml-2">
                  {data.companyName}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="px-6 py-4 flex-1 overflow-y-auto min-h-0">
              <div className="space-y-4">
                <CurrentStatusSection data={data} />
                <StageProgressVisual
                  stages={data.stages}
                  currentStageId={data.currentStageId}
                  targetStageId={data.nextTargetStageId}
                />
                <ReasonEditSection
                  data={data}
                  onUpdateSuccess={async () => {
                    // データを再取得
                    const result = await getStageManagementData(stpCompanyId!);
                    setData(result);
                    onUpdateSuccess?.();
                  }}
                />
                <StageHistorySection histories={data.histories} />
                <StatisticsSection statistics={data.statistics} />

                <div className="pt-4 border-t">
                  <StageUpdateForm
                    stages={data.stages}
                    currentStageId={data.currentStageId}
                    currentTargetStageId={data.nextTargetStageId}
                    currentTargetDate={data.nextTargetDate}
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
      <StageAlertDialog
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
