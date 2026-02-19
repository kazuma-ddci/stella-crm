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
    // 失注・検討中の理由をnoteに含める（バリデーション用）
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

    // 失注・検討中の場合は、すべての進行ステージと受注を選択可能
    if (currentStage?.stageType === 'closed_lost' || currentStage?.stageType === 'pending') {
      return stages.filter(
        (s) =>
          !NON_TARGET_STAGE_TYPES.includes(s.stageType) &&
          (s.stageType === 'progress' || s.stageType === 'closed_won')
      );
    }

    // 通常の進行ステージの場合は、現在より上位のステージのみ
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
      // 終了ステージ・検討中に変更した場合は目標をクリア
      if (
        newStage?.stageType === 'closed_won' ||
        newStage?.stageType === 'closed_lost' ||
        newStage?.stageType === 'pending'
      ) {
        setSelectedTargetStageValue(CLEAR_VALUE);
        setSelectedTargetDateMode(CLEAR_VALUE);
        setSelectedTargetDate(null);
      }
      // 目標に到達した場合も目標をクリア
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
    <div className="space-y-6">
      {/* ステージ更新セクション */}
      <div className="rounded-lg border p-4">
        <h4 className="font-medium mb-4">パイプラインを更新する</h4>

        <div className="space-y-2">
          <div className="flex gap-6">
            {/* 左側：新しいステージ選択 */}
            <div className="flex-1">
              <Label htmlFor="new-stage" className="text-sm text-muted-foreground mb-1.5 block">
                新しいパイプライン
              </Label>
              <Select
                value={selectedStageValue}
                onValueChange={setSelectedStageValue}
              >
                <SelectTrigger id="new-stage">
                  <SelectValue placeholder="更新する場合は選択してください" />
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

            {/* 右側：現在の値 */}
            <div className="w-24 shrink-0 text-right">
              <span className="text-sm text-muted-foreground block mb-1.5">現在</span>
              <div className="h-9 flex items-center justify-end">
                <span className="text-sm font-medium">{getCurrentStageName()}</span>
              </div>
            </div>
          </div>

          {/* 変更タイプの表示 */}
          {hasStageChange && changeType.message && (
            <div
              className={cn(
                "p-3 rounded-md text-sm mt-2",
                changeType.type === "achieved" && "bg-green-50 text-green-800",
                changeType.type === "progress" && "bg-blue-50 text-blue-800",
                changeType.type === "back" && "bg-yellow-50 text-yellow-800",
                changeType.type === "won" && "bg-green-50 text-green-800",
                changeType.type === "lost" && "bg-gray-100 text-gray-800",
                changeType.type === "suspended" && "bg-orange-50 text-orange-800",
                changeType.type === "resumed" && "bg-blue-50 text-blue-800",
                changeType.type === "revived" && "bg-purple-50 text-purple-800"
              )}
            >
              {changeType.message}
            </div>
          )}
        </div>
      </div>

      {/* 検討中の詳細セクション（検討中選択時のみ表示） */}
      {isChangingToPending && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4">
          <h4 className="font-medium mb-4 text-orange-800">検討中の詳細</h4>

          <div className="space-y-4">
            <div>
              <Label htmlFor="pending-reason" className="text-sm text-orange-800">
                検討中理由
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="pending-reason"
                value={pendingReason}
                onChange={(e) => setPendingReason(e.target.value)}
                placeholder="理由を入力してください..."
                rows={3}
                className="mt-1.5"
              />
              {requiresPendingReason && (
                <p className="text-sm text-destructive mt-1">検討中理由は必須です</p>
              )}
            </div>

            <div>
              <Label htmlFor="pending-response-date" className="text-sm text-orange-800">
                回答予定日（任意）
              </Label>
              <div className="mt-1.5">
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
        </div>
      )}

      {/* 失注の詳細セクション（失注選択時のみ表示） */}
      {isChangingToLost && (
        <div className="rounded-lg border border-gray-300 bg-gray-50/50 p-4">
          <h4 className="font-medium mb-4 text-gray-800">失注の詳細</h4>

          <div>
            <Label htmlFor="lost-reason" className="text-sm text-gray-800">
              失注理由
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="lost-reason"
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              placeholder="理由を入力してください..."
              rows={3}
              className="mt-1.5"
            />
            {requiresLostReason && (
              <p className="text-sm text-destructive mt-1">失注理由は必須です</p>
            )}
          </div>
        </div>
      )}

      {/* 目標設定セクション（受注以外で表示） */}
      {!isClosedWon && (
        <div className="rounded-lg border p-4">
          <h4 className="font-medium mb-4">
            次の目標を設定する
            {(isChangingToLost || isChangingToPending) && (
              <span className="text-muted-foreground font-normal ml-1">（任意）</span>
            )}
          </h4>

          {/* 失注・検討中の場合の説明 */}
          {(isChangingToLost || isChangingToPending) && (
            <p className="text-sm text-muted-foreground mb-4">
              {isChangingToLost
                ? "失注後に再挑戦する目標を設定できます。設定しない場合はクリアされます。"
                : "検討中から再開時の目標を設定できます。設定しない場合はクリアされます。"}
            </p>
          )}

          {/* 目標ステージ */}
          <div className="space-y-4">
            <div className="flex gap-6">
              {/* 左側：目標ステージ選択 */}
              <div className="flex-1">
                <Label htmlFor="target-stage" className="text-sm text-muted-foreground mb-1.5 block">
                  目標パイプライン
                </Label>
                <Select
                  value={selectedTargetStageValue}
                  onValueChange={setSelectedTargetStageValue}
                >
                  <SelectTrigger id="target-stage">
                    <SelectValue placeholder="更新する場合は選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 失注・検討中の場合は「変更しない」ではなく「設定しない」 */}
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

              {/* 右側：現在の値 */}
              <div className="w-24 shrink-0 text-right">
                <span className="text-sm text-muted-foreground block mb-1.5">現在</span>
                <div className="h-9 flex items-center justify-end">
                  <span className="text-sm font-medium">{getCurrentTargetStageName()}</span>
                </div>
              </div>
            </div>

            {/* 目標日 */}
            <div className="flex gap-6">
              {/* 左側：目標日入力 */}
              <div className="flex-1">
                <Label htmlFor="target-date-mode" className="text-sm text-muted-foreground mb-1.5 block">
                  目標日
                </Label>
                <Select
                  value={selectedTargetDateMode}
                  onValueChange={handleTargetDateModeChange}
                >
                  <SelectTrigger id="target-date-mode">
                    <SelectValue placeholder="更新する場合は選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* 失注・検討中の場合は「変更しない」ではなく「設定しない」 */}
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

                {/* 日付選択（「新しい目標日を設定」選択時のみ表示） */}
                {selectedTargetDateMode === SET_NEW_DATE && (
                  <div className="mt-2">
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

              {/* 右側：現在の値 */}
              <div className="w-24 shrink-0 text-right">
                <span className="text-sm text-muted-foreground block mb-1.5">現在</span>
                <div className="h-9 flex items-center justify-end">
                  <span className="text-sm font-medium">{formatDate(currentTargetDate)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* メモセクション */}
      <div className="rounded-lg border p-4">
        <Label htmlFor="note" className="font-medium">
          メモ
          {isBackward && (
            <span className="text-muted-foreground font-normal ml-1">（推奨）</span>
          )}
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isBackward
              ? "後退の理由を入力してください..."
              : "メモを入力してください..."
          }
          rows={3}
          className="mt-2"
        />
      </div>

      {/* エラー表示 */}
      <InlineAlert alerts={validation.alerts} />

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {loading ? "更新中..." : "更新する"}
        </Button>
      </div>
    </div>
  );
}
