"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StageManagementData } from "@/lib/stage-transition/types";
import { updateReasonOnly } from "@/app/stp/companies/stage-management/actions";
import { toast } from "sonner";
import { Loader2, Pencil, X, Check } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

interface ReasonEditSectionProps {
  data: StageManagementData;
  onUpdateSuccess?: () => void;
}

export function ReasonEditSection({ data, onUpdateSuccess }: ReasonEditSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 編集用の状態
  const [pendingReason, setPendingReason] = useState(data.pendingReason ?? "");
  const [lostReason, setLostReason] = useState(data.lostReason ?? "");
  const [pendingResponseDate, setPendingResponseDate] = useState<Date | null>(
    data.pendingResponseDate ? new Date(data.pendingResponseDate) : null
  );

  // dataが変更されたら状態をリセット
  useEffect(() => {
    setPendingReason(data.pendingReason ?? "");
    setLostReason(data.lostReason ?? "");
    setPendingResponseDate(data.pendingResponseDate ? new Date(data.pendingResponseDate) : null);
  }, [data.pendingReason, data.lostReason, data.pendingResponseDate]);

  // 現在のステージタイプを取得
  const currentStageType = data.currentStage?.stageType;
  const isPendingStage = currentStageType === "pending";
  const isLostStage = currentStageType === "closed_lost";

  // 検討中でも失注でもない場合は表示しない
  if (!isPendingStage && !isLostStage) {
    return null;
  }

  const handleCancel = () => {
    // 元の値に戻す
    setPendingReason(data.pendingReason ?? "");
    setLostReason(data.lostReason ?? "");
    setPendingResponseDate(data.pendingResponseDate ? new Date(data.pendingResponseDate) : null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateReasonOnly({
        stpCompanyId: data.companyId,
        pendingReason: isPendingStage ? (pendingReason || null) : undefined,
        lostReason: isLostStage ? (lostReason || null) : undefined,
        pendingResponseDate: isPendingStage ? pendingResponseDate : undefined,
      });

      if (result.success) {
        toast.success("理由を更新しました");
        setIsEditing(false);
        onUpdateSuccess?.();
      } else {
        toast.error(result.error ?? "理由の更新に失敗しました");
      }
    } catch (error) {
      console.error("Failed to update reason:", error);
      toast.error("理由の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // 変更があるかチェック
  const hasChanges = isPendingStage
    ? pendingReason !== (data.pendingReason ?? "") ||
      pendingResponseDate?.getTime() !== (data.pendingResponseDate ? new Date(data.pendingResponseDate).getTime() : undefined)
    : lostReason !== (data.lostReason ?? "");

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-muted-foreground">
          {isPendingStage ? "検討中の理由" : "失注の理由"}
        </h3>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-7 px-2"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            編集
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          {isPendingStage && (
            <>
              <div className="space-y-2">
                <Label htmlFor="pendingReason">検討理由</Label>
                <Textarea
                  id="pendingReason"
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  placeholder="検討理由を入力"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pendingResponseDate">回答予定日</Label>
                <DatePicker
                  selected={pendingResponseDate}
                  onChange={(date: Date | null) => setPendingResponseDate(date)}
                  dateFormat="yyyy/MM/dd"
                  locale="ja"
                  placeholderText="日付を選択"
                  isClearable
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  wrapperClassName="w-full"
                  calendarClassName="shadow-lg"
                />
              </div>
            </>
          )}

          {isLostStage && (
            <div className="space-y-2">
              <Label htmlFor="lostReason">失注理由</Label>
              <Textarea
                id="lostReason"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="失注理由を入力"
                rows={3}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isPendingStage && (
            <>
              <div>
                <span className="text-sm text-muted-foreground">検討理由：</span>
                <span className="text-sm ml-1">
                  {data.pendingReason || "-"}
                </span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">回答予定日：</span>
                <span className="text-sm ml-1">
                  {data.pendingResponseDate
                    ? new Date(data.pendingResponseDate).toLocaleDateString("ja-JP", {
                        timeZone: "Asia/Tokyo",
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : "-"}
                </span>
              </div>
            </>
          )}

          {isLostStage && (
            <div>
              <span className="text-sm text-muted-foreground">失注理由：</span>
              <span className="text-sm ml-1">
                {data.lostReason || "-"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
