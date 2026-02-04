"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ContractStatusInfo,
  ContractStatusValidationResult,
} from "@/lib/contract-status/types";
import {
  detectContractStatusEvent,
  getContractStatusChangeType,
} from "@/lib/contract-status/event-detector";
import { validateContractStatusChange } from "@/lib/contract-status/alert-validator";
import { TERMINAL_STATUS_IDS } from "@/lib/contract-status/constants";
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

interface StatusUpdateFormProps {
  statuses: ContractStatusInfo[];
  currentStatusId: number | null;
  onSubmit: (params: {
    newStatusId: number | null;
    note: string;
    alertAcknowledged: boolean;
    validation: ContractStatusValidationResult;
    signedDate?: string;
  }) => void;
  onCancel: () => void;
  loading?: boolean;
  hasChanges: boolean;
  onHasChangesChange: (hasChanges: boolean) => void;
}

// 「変更なし」を表す特別な値
const NO_CHANGE = "__no_change__";

export function StatusUpdateForm({
  statuses,
  currentStatusId,
  onSubmit,
  onCancel,
  loading,
  onHasChangesChange,
}: StatusUpdateFormProps) {
  const [selectedStatusValue, setSelectedStatusValue] = useState<string>(NO_CHANGE);
  const [note, setNote] = useState("");
  // 締結日の状態
  const [signedDateOption, setSignedDateOption] = useState<"today" | "custom">("today");
  const [customSignedDate, setCustomSignedDate] = useState<Date | null>(null);

  // 実効値の計算
  const effectiveNewStatusId =
    selectedStatusValue === NO_CHANGE
      ? currentStatusId
      : selectedStatusValue
      ? Number(selectedStatusValue)
      : null;

  // 変更があるかチェック
  const hasStatusChange = selectedStatusValue !== NO_CHANGE;
  const hasAnyChange = hasStatusChange;

  // 締結済みが選択されているかチェック
  const isSelectingSigned = effectiveNewStatusId === TERMINAL_STATUS_IDS.SIGNED;

  // 締結日の計算
  const getSignedDate = (): string | undefined => {
    if (!isSelectingSigned) return undefined;
    if (signedDateOption === "today") {
      return new Date().toISOString().split("T")[0];
    }
    return customSignedDate ? customSignedDate.toISOString().split("T")[0] : undefined;
  };

  // 締結日のバリデーション（締結済み選択時は必須）
  const signedDateRequired = isSelectingSigned && signedDateOption === "custom" && !customSignedDate;

  // 親コンポーネントに変更状態を通知
  useEffect(() => {
    const hasFormChanges = hasAnyChange || note.trim() !== "";
    onHasChangesChange(hasFormChanges);
  }, [hasAnyChange, note, onHasChangesChange]);

  // ステータス変更時の変更タイプを判定
  const changeType = useMemo(() => {
    return getContractStatusChangeType(currentStatusId, effectiveNewStatusId, statuses);
  }, [currentStatusId, effectiveNewStatusId, statuses]);

  // バリデーション
  const validation = useMemo(() => {
    return validateContractStatusChange(
      {
        currentStatusId,
        newStatusId: effectiveNewStatusId,
        note,
      },
      statuses
    );
  }, [currentStatusId, effectiveNewStatusId, note, statuses]);

  // イベント検出
  const eventResult = useMemo(() => {
    return detectContractStatusEvent(
      {
        currentStatusId,
        newStatusId: effectiveNewStatusId,
        note,
      },
      statuses
    );
  }, [currentStatusId, effectiveNewStatusId, note, statuses]);

  // 理由必須チェック
  const requiresNote = validation.alerts.some((a) => a.requiresNote);
  const noteRequired = requiresNote && (!note || note.trim().length === 0);

  const handleSubmit = () => {
    onSubmit({
      newStatusId: effectiveNewStatusId,
      note,
      alertAcknowledged: validation.hasWarnings || validation.hasInfos,
      validation,
      signedDate: getSignedDate(),
    });
  };

  const getCurrentStatusName = () => {
    return statuses.find((s) => s.id === currentStatusId)?.name ?? "未設定";
  };

  // 送信可能かどうかの判定
  const canSubmit =
    eventResult.hasChanges &&
    hasAnyChange &&
    !noteRequired &&
    !validation.hasErrors &&
    !signedDateRequired;

  // 破棄からの復活か、締結済みからの再開か
  const isRevivingOrReopening =
    changeType.type === "revived" || changeType.type === "reopened";

  return (
    <div className="space-y-6">
      {/* ステータス更新セクション */}
      <div className="rounded-lg border p-4">
        <h4 className="font-medium mb-4">ステータスを更新する</h4>

        <div className="space-y-2">
          <div className="flex gap-6">
            {/* 左側：新しいステータス選択 */}
            <div className="flex-1">
              <Label
                htmlFor="new-status"
                className="text-sm text-muted-foreground mb-1.5 block"
              >
                新しいステータス
              </Label>
              <Select
                value={selectedStatusValue}
                onValueChange={setSelectedStatusValue}
              >
                <SelectTrigger id="new-status">
                  <SelectValue placeholder="更新する場合は選択してください" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CHANGE}>
                    <span className="text-muted-foreground">変更しない</span>
                  </SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      <span
                        className={cn(
                          status.id === TERMINAL_STATUS_IDS.SIGNED && "text-green-600",
                          status.id === TERMINAL_STATUS_IDS.DISCARDED && "text-red-600"
                        )}
                      >
                        {status.name}
                        {status.isTerminal && " (終了)"}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 右側：現在の値 */}
            <div className="w-24 shrink-0 text-right">
              <span className="text-sm text-muted-foreground block mb-1.5">
                現在
              </span>
              <div className="h-9 flex items-center justify-end">
                <span className="text-sm font-medium">{getCurrentStatusName()}</span>
              </div>
            </div>
          </div>

          {/* 変更タイプの表示 */}
          {hasStatusChange && changeType.message && (
            <div
              className={cn(
                "p-3 rounded-md text-sm mt-2",
                changeType.type === "progress" && "bg-blue-50 text-blue-800",
                changeType.type === "back" && "bg-yellow-50 text-yellow-800",
                changeType.type === "signed" && "bg-green-50 text-green-800",
                changeType.type === "discarded" && "bg-red-50 text-red-800",
                changeType.type === "revived" && "bg-purple-50 text-purple-800",
                changeType.type === "reopened" && "bg-orange-50 text-orange-800",
                changeType.type === "created" && "bg-gray-50 text-gray-800"
              )}
            >
              {changeType.message}
            </div>
          )}

          {/* 締結日の選択（締結済み選択時のみ表示） */}
          {isSelectingSigned && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <Label className="text-sm font-medium text-green-800 mb-3 block">
                締結日を入力してください
                <span className="text-destructive ml-1">*</span>
              </Label>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="signedDateOption"
                    value="today"
                    checked={signedDateOption === "today"}
                    onChange={() => setSignedDateOption("today")}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm">
                    今日（{new Date().toLocaleDateString("ja-JP")}）
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="signedDateOption"
                    value="custom"
                    checked={signedDateOption === "custom"}
                    onChange={() => setSignedDateOption("custom")}
                    className="w-4 h-4 text-green-600"
                  />
                  <span className="text-sm">別の日を選択</span>
                </label>
                {signedDateOption === "custom" && (
                  <div className="ml-6">
                    <DatePicker
                      selected={customSignedDate}
                      onChange={(date: Date | null) => setCustomSignedDate(date)}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      maxDate={new Date()}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                    {signedDateRequired && (
                      <p className="text-sm text-destructive mt-1">
                        締結日を選択してください
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* メモセクション */}
      <div className="rounded-lg border p-4">
        <Label htmlFor="note" className="font-medium">
          メモ
          {isRevivingOrReopening && (
            <span className="text-destructive ml-1">*</span>
          )}
        </Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isRevivingOrReopening
              ? "変更理由を入力してください..."
              : "メモを入力してください..."
          }
          rows={3}
          className="mt-2"
        />
        {noteRequired && (
          <p className="text-sm text-destructive mt-1">
            理由の入力が必要です
          </p>
        )}
      </div>

      {/* エラー表示 */}
      <InlineAlert alerts={validation.alerts} />

      {/* ボタン */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
          {loading ? "更新中..." : "更新する"}
        </Button>
      </div>
    </div>
  );
}
