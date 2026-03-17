"use client";

import { useState, useEffect, useMemo } from "react";
import { StageInfo, ValidationResult } from "@/lib/stage-transition/types";
import { detectEvents, getChangeType } from "@/lib/stage-transition/event-detector";
import { validateStageChange } from "@/lib/stage-transition/alert-validator";
import { NON_TARGET_STAGE_TYPES } from "@/lib/stage-transition/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineAlert } from "./alert-dialog";
import { cn } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

interface StageUpdateFormProps {
  stages: StageInfo[];
  currentStageId: number | null;
  currentTargetStageId: number | null;
  currentTargetDate: Date | null;
  onSubmit: (params: {
    newStageId: number | null;
    newTargetStageId: number | null;
    newTargetDate: Date | null;
    note: string;
    alertAcknowledged: boolean;
    validation: ValidationResult;
    lostReason?: string;
    pendingReason?: string;
    pendingResponseDate?: Date | null;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
  hasChanges: boolean;
  onHasChangesChange: (hasChanges: boolean) => void;
}

// 「変更なし」を表す特別な値
const NO_CHANGE = "__no_change__";
// 「クリア」を表す特別な値
const CLEAR_VALUE = "__clear__";
// 「新しい日付を設定」を表す特別な値
const SET_NEW_DATE = "__set_new_date__";

export function StageUpdateForm({
  stages,
  currentStageId,
  currentTargetStageId,
  currentTargetDate,
  onSubmit,
  onCancel,
  loading,
  onHasChangesChange,
}: StageUpdateFormProps) {
  // 選択値（NO_CHANGEは変更しないことを意味）
  const [selectedStageValue, setSelectedStageValue] = useState<string>(NO_CHANGE);
  const [selectedTargetStageValue, setSelectedTargetStageValue] = useState<string>(NO_CHANGE);
  const [selectedTargetDateMode, setSelectedTargetDateMode] = useState<string>(NO_CHANGE);
  const [selectedTargetDate, setSelectedTargetDate] = useState<Date | null>(null);
  const [note, setNote] = useState("");

  // 失注・検討中の詳細フォーム用の状態
  const [lostReason, setLostReason] = useState("");
  const [pendingReason, setPendingReason] = useState("");
  const [pendingResponseDate, setPendingResponseDate] = useState<Date | null>(null);

  // 実効値の計算
  const effectiveNewStageId =
    selectedStageValue === NO_CHANGE
      ? currentStageId
      : selectedStageValue
      ? Number(selectedStageValue)
      : null;

  const effectiveNewTargetStageId =
    selectedTargetStageValue === NO_CHANGE
      ? currentTargetStageId
      : selectedTargetStageValue === CLEAR_VALUE
      ? null
      : Number(selectedTargetStageValue);

  const effectiveNewTargetDate =
    selectedTargetDateMode === NO_CHANGE
      ? currentTargetDate
      : selectedTargetDateMode === CLEAR_VALUE
      ? null
      : selectedTargetDate;

  // 変更があるかチェック
  const hasStageChange = selectedStageValue !== NO_CHANGE;
  const hasTargetStageChange = selectedTargetStageValue !== NO_CHANGE;
  const hasTargetDateChange = selectedTargetDateMode !== NO_CHANGE;
  const hasAnyChange = hasStageChange || hasTargetStageChange || hasTargetDateChange;

  // 新しいステージのstageTypeを取得
  const newStageType = stages.find((s) => s.id === effectiveNewStageId)?.stageType;

  // 失注に変更するか
  const isChangingToLost = hasStageChange && newStageType === 'closed_lost';
  // 検討中に変更するか
  const isChangingToPending = hasStageChange && newStageType === 'pending';

  // 失注理由・検討中理由が必要か
  const requiresLostReason = isChangingToLost && !lostReason.trim();
  const requiresPendingReason = isChangingToPending && !pendingReason.trim();

  // 親コンポーネントに変更状態を通知
  useEffect(() => {
    const hasFormChanges = hasAnyChange || note.trim() !== "" || lostReason.trim() !== "" || pendingReason.trim() !== "";
    onHasChangesChange(hasFormChanges);
  }, [hasAnyChange, note, lostReason, pendingReason, onHasChangesChange]);

  // ステージ変更時の変更タイプを判定
  const changeType = useMemo(() => {
    return getChangeType(currentStageId, effectiveNewStageId, currentTargetStageId, stages);
  }, [currentStageId, effectiveNewStageId, currentTargetStageId, stages]);

  // イベント検出とバリデーション
  const { events, hasDetectedChanges, validation } = useMemo(() => {
    const combinedNote = isChangingToLost ? lostReason : isChangingToPending ? pendingReason : note;

    const detectionResult = detectEvents(
      {
        currentStageId,
        currentTargetStageId,
        currentTargetDate,
        newStageId: effectiveNewStageId,
        newTargetStageId: effectiveNewTargetStageId,
        newTargetDate: effectiveNewTargetDate,
        note: combinedNote,
      },
      stages
    );

    const validationResult = validateStageChange({
      input: {
        currentStageId,
        currentTargetStageId,
        currentTargetDate,
        newStageId: effectiveNewStageId,
        newTargetStageId: effectiveNewTargetStageId,
        newTargetDate: effectiveNewTargetDate,
        note: combinedNote,
      },
      stages,
      detectedEvents: detectionResult.events,
      histories: [],
      isNewRecord: false,
    });

    return {
      events: detectionResult.events,
      hasDetectedChanges: detectionResult.hasChanges,
      validation: validationResult,
    };
  }, [
    currentStageId,
    currentTargetStageId,
    currentTargetDate,
    effectiveNewStageId,
    effectiveNewTargetStageId,
    effectiveNewTargetDate,
    note,
    lostReason,
    pendingReason,
    isChangingToLost,
    isChangingToPending,
    stages,
  ]);

  // 目標に設定可能なステージをフィルタ
  const targetableStages = useMemo(() => {
    const currentStage = stages.find((s) => s.id === effectiveNewStageId);

    if (currentStage?.stageType === 'closed_lost' || currentStage?.stageType === 'pending') {
      return stages.filter(
        (s) =>
          !NON_TARGET_STAGE_TYPES.includes(s.stageType) &&
          (s.stageType === 'progress' || s.stageType === 'closed_won')
      );
    }

    if (!currentStage || currentStage.stageType !== 'progress') {
      return [];
    }
    const currentOrder = currentStage.displayOrder ?? 0;
    return stages.filter(
      (s) =>
        !NON_TARGET_STAGE_TYPES.includes(s.stageType) &&
        (s.stageType === 'progress' || s.stageType === 'closed_won') &&
        (s.displayOrder ?? 0) > currentOrder
    );
  }, [stages, effectiveNewStageId]);

  // ステージ変更時に目標をリセット（必要な場合）
  useEffect(() => {
    if (hasStageChange && selectedStageValue !== NO_CHANGE) {
      const newStageId = Number(selectedStageValue);
      const newStage = stages.find((s) => s.id === newStageId);
      if (
        newStage?.stageType === 'closed_won' ||
        newStage?.stageType === 'closed_lost' ||
        newStage?.stageType === 'pending'
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- clear target fields when stage changes to terminal state
        setSelectedTargetStageValue(CLEAR_VALUE);
        setSelectedTargetDateMode(CLEAR_VALUE);
        setSelectedTargetDate(null);
      }
      else if (newStageId === currentTargetStageId) {
        setSelectedTargetStageValue(CLEAR_VALUE);
        setSelectedTargetDateMode(CLEAR_VALUE);
        setSelectedTargetDate(null);
      }
    }
  }, [hasStageChange, selectedStageValue, currentTargetStageId, stages]);

  // ステージ変更時に失注理由・検討中理由をリセット
  useEffect(() => {
    if (!isChangingToLost) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset lost/pending reason when stage selection changes
      setLostReason("");
    }
    if (!isChangingToPending) {
      setPendingReason("");
      setPendingResponseDate(null);
    }
  }, [isChangingToLost, isChangingToPending]);

  const handleSubmit = () => {
    const hasWarningsOrInfos = validation.hasWarnings || validation.hasInfos;

    onSubmit({
      newStageId: effectiveNewStageId,
      newTargetStageId: effectiveNewTargetStageId,
      newTargetDate: effectiveNewTargetDate,
      note,
      alertAcknowledged: hasWarningsOrInfos,
      validation,
      lostReason: isChangingToLost ? lostReason : undefined,
      pendingReason: isChangingToPending ? pendingReason : undefined,
      pendingResponseDate: isChangingToPending ? pendingResponseDate : undefined,
    });
  };

  const handleTargetDateModeChange = (value: string) => {
    setSelectedTargetDateMode(value);
    if (value !== SET_NEW_DATE) {
      setSelectedTargetDate(null);
    }
  };

  const handleTargetDateChange = (date: Date | null) => {
    setSelectedTargetDate(date);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "未設定";
    return new Date(date).toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getCurrentStageName = () => {
    return stages.find((s) => s.id === currentStageId)?.name ?? "未設定";
  };

  const getCurrentTargetStageName = () => {
    return stages.find((s) => s.id === currentTargetStageId)?.name ?? "未設定";
  };

  // 送信可能かどうかの判定
  const canSubmit =
    hasDetectedChanges &&
    validation.isValid &&
    hasAnyChange &&
    !requiresLostReason &&
    !requiresPendingReason;

  const isBackward = changeType.type === "back";

  // 受注かどうか（受注のみ目標設定不可）
  const isClosedWon = newStageType === 'closed_won';

  return (
    <div className="space-y-4">
      {/* セクションヘッダー */}
      <div>
        <h3 className="font-semibold text-sm">パイプラインを更新</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          現在: {getCurrentStageName()}
        </p>
      </div>

      {/* ステージ選択 */}
      <div className="space-y-1.5">
        <Label htmlFor="new-stage" className="text-xs text-muted-foreground">
          新しいパイプライン
        </Label>
        <Select
          value={selectedStageValue}
          onValueChange={setSelectedStageValue}
        >
          <SelectTrigger id="new-stage" className="h-9">
            <SelectValue placeholder="選択してください" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CHANGE}>
              <span className="text-muted-foreground">変更しない</span>
            </SelectItem>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id.toString()}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 変更タイプの表示 */}
      {hasStageChange && changeType.message && (
        <div
          className={cn(
            "px-3 py-2 rounded-md text-xs",
            changeType.type === "achieved" && "bg-green-50 text-green-800 border border-green-200",
            changeType.type === "progress" && "bg-blue-50 text-blue-800 border border-blue-200",
            changeType.type === "back" && "bg-yellow-50 text-yellow-800 border border-yellow-200",
            changeType.type === "won" && "bg-green-50 text-green-800 border border-green-200",
            changeType.type === "lost" && "bg-gray-50 text-gray-700 border border-gray-200",
            changeType.type === "suspended" && "bg-orange-50 text-orange-800 border border-orange-200",
            changeType.type === "resumed" && "bg-blue-50 text-blue-800 border border-blue-200",
            changeType.type === "revived" && "bg-purple-50 text-purple-800 border border-purple-200"
          )}
        >
          {changeType.message}
        </div>
      )}

      {/* 検討中の詳細セクション */}
      {isChangingToPending && (
        <div className="rounded-md border border-orange-200 bg-orange-50/50 p-3 space-y-3">
          <h4 className="font-medium text-xs text-orange-800">検討中の詳細</h4>
          <div>
            <Label htmlFor="pending-reason" className="text-xs text-orange-800">
              検討中理由<span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              id="pending-reason"
              value={pendingReason}
              onChange={(e) => setPendingReason(e.target.value)}
              placeholder="理由を入力..."
              rows={2}
              className="mt-1 text-sm"
            />
            {requiresPendingReason && (
              <p className="text-xs text-destructive mt-1">検討中理由は必須です</p>
            )}
          </div>
          <div>
            <Label htmlFor="pending-response-date" className="text-xs text-orange-800">
              回答予定日（任意）
            </Label>
            <div className="mt-1">
              <DatePicker
                selected={pendingResponseDate}
                onChange={(date: Date | null) => setPendingResponseDate(date)}
                dateFormat="yyyy/MM/dd"
                locale="ja"
                placeholderText="日付を選択"
                isClearable
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                wrapperClassName="w-full"
                calendarClassName="shadow-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* 失注の詳細セクション */}
      {isChangingToLost && (
        <div className="rounded-md border border-gray-300 bg-gray-50/50 p-3">
          <h4 className="font-medium text-xs text-gray-800 mb-2">失注の詳細</h4>
          <div>
            <Label htmlFor="lost-reason" className="text-xs text-gray-800">
              失注理由<span className="text-destructive ml-0.5">*</span>
            </Label>
            <Textarea
              id="lost-reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="理由を入力..."
              rows={2}
              className="mt-1 text-sm"
            />
            {requiresLostReason && (
              <p className="text-xs text-destructive mt-1">失注理由は必須です</p>
            )}
          </div>
        </div>
      )}

      {/* 目標設定セクション（受注以外で表示） */}
      {!isClosedWon && (
        <div className="pt-3 border-t space-y-3">
          <div className="flex items-baseline justify-between">
            <h4 className="font-semibold text-xs text-muted-foreground">
              次の目標
            </h4>
            {(isChangingToLost || isChangingToPending) && (
              <span className="text-[10px] text-muted-foreground">任意</span>
            )}
          </div>

          {(isChangingToLost || isChangingToPending) && (
            <p className="text-xs text-muted-foreground -mt-1">
              {isChangingToLost
                ? "失注後に再挑戦する目標を設定できます"
                : "検討中から再開時の目標を設定できます"}
            </p>
          )}

          {/* 目標ステージ */}
          <div className="space-y-1.5">
            <Label htmlFor="target-stage" className="text-xs text-muted-foreground">
              目標パイプライン
              <span className="ml-1.5 text-[10px]">現在: {getCurrentTargetStageName()}</span>
            </Label>
            <Select
              value={selectedTargetStageValue}
              onValueChange={setSelectedTargetStageValue}
            >
              <SelectTrigger id="target-stage" className="h-9">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {(isChangingToLost || isChangingToPending) ? (
                  <SelectItem value={CLEAR_VALUE}>
                    <span className="text-muted-foreground">設定しない（クリア）</span>
                  </SelectItem>
                ) : (
                  <>
                    <SelectItem value={NO_CHANGE}>
                      <span className="text-muted-foreground">変更しない</span>
                    </SelectItem>
                    <SelectItem value={CLEAR_VALUE}>
                      <span className="text-muted-foreground">目標をクリア</span>
                    </SelectItem>
                  </>
                )}
                {targetableStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id.toString()}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 目標日 */}
          <div className="space-y-1.5">
            <Label htmlFor="target-date-mode" className="text-xs text-muted-foreground">
              目標日
              <span className="ml-1.5 text-[10px]">現在: {formatDate(currentTargetDate)}</span>
            </Label>
            <Select
              value={selectedTargetDateMode}
              onValueChange={handleTargetDateModeChange}
            >
              <SelectTrigger id="target-date-mode" className="h-9">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {(isChangingToLost || isChangingToPending) ? (
                  <>
                    <SelectItem value={CLEAR_VALUE}>
                      <span className="text-muted-foreground">設定しない（クリア）</span>
                    </SelectItem>
                    <SelectItem value={SET_NEW_DATE}>
                      <span>新しい目標日を設定</span>
                    </SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value={NO_CHANGE}>
                      <span className="text-muted-foreground">変更しない</span>
                    </SelectItem>
                    <SelectItem value={SET_NEW_DATE}>
                      <span>新しい目標日を設定</span>
                    </SelectItem>
                    <SelectItem value={CLEAR_VALUE}>
                      <span className="text-muted-foreground">目標日を削除</span>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>

            {selectedTargetDateMode === SET_NEW_DATE && (
              <div className="mt-1.5">
                <DatePicker
                  selected={selectedTargetDate}
                  onChange={handleTargetDateChange}
                  dateFormat="yyyy/MM/dd"
                  locale="ja"
                  placeholderText="日付を選択"
                  isClearable
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  wrapperClassName="w-full"
                  calendarClassName="shadow-lg"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* メモ */}
      <div className="pt-3 border-t">
        <Label htmlFor="note" className="text-xs text-muted-foreground">
          メモ
          {isBackward && (
            <span className="text-orange-600 ml-1">（推奨）</span>
          )}
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isBackward
              ? "後退の理由を入力..."
              : "メモを入力..."
          }
          rows={2}
          className="mt-1 text-sm"
        />
      </div>

      {/* エラー表示 */}
      <InlineAlert alerts={validation.alerts} />

      {/* ボタン */}
      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-9">
          キャンセル
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="flex-1 h-9"
        >
          {loading ? "更新中..." : "更新する"}
        </Button>
      </div>
    </div>
  );
}
