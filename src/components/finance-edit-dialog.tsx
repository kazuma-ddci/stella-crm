"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 自動生成レコードの重要フィールド編集時の理由入力ダイアログ
type AutoEditReasonDialogProps = {
  open: boolean;
  fieldName: string;
  oldValue: string;
  newValue: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function AutoEditReasonDialog({
  open,
  fieldName,
  oldValue,
  newValue,
  onConfirm,
  onCancel,
}: AutoEditReasonDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <span>⚠</span> 自動生成レコードの編集
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            このレコードは自動生成されたデータです。重要フィールドを変更する理由を入力してください。
          </p>
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div>
              <span className="font-medium">フィールド:</span> {fieldName}
            </div>
            <div>
              <span className="font-medium">変更前:</span> {oldValue || "-"}
            </div>
            <div>
              <span className="font-medium">変更後:</span> {newValue || "-"}
            </div>
          </div>
          <div className="space-y-2">
            <Label>変更理由 <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="変更理由を入力してください"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={!reason.trim()}
          >
            変更を確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 元データ変更時の確認ダイアログ
type SourceDataChangeDialogProps = {
  open: boolean;
  currentAmount: number;
  latestAmount: number;
  changedAt: string; // ISO date string
  onApply: () => void;
  onDismiss: () => void;
  onCancel: () => void;
};

export function SourceDataChangeDialog({
  open,
  currentAmount,
  latestAmount,
  changedAt,
  onApply,
  onDismiss,
  onCancel,
}: SourceDataChangeDialogProps) {
  const diff = latestAmount - currentAmount;

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <span>⚠</span> 元データが変更されました
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span>現在の金額:</span>
              <span className="font-medium">¥{currentAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>最新の計算値:</span>
              <span className="font-medium">¥{latestAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span>差額:</span>
              <span className={`font-medium ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                {diff >= 0 ? "+" : ""}¥{diff.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            変更日時: {formatDateTime(changedAt)}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onDismiss}>
            現在値を維持
          </Button>
          <Button onClick={onApply}>
            最新値を反映
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 入金額不一致時のステータス選択ダイアログ
type AmountMismatchDialogProps = {
  open: boolean;
  expectedAmount: number;
  paidAmount: number;
  recordType: "revenue" | "expense"; // 売上 or 経費
  onConfirm: (paymentStatus: string, reason: string) => void;
  onCancel: () => void;
};

export function AmountMismatchDialog({
  open,
  expectedAmount,
  paidAmount,
  recordType,
  onConfirm,
  onCancel,
}: AmountMismatchDialogProps) {
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [reason, setReason] = useState("");

  const diff = paidAmount - expectedAmount;
  const isPartial = paidAmount < expectedAmount;
  const labels = recordType === "revenue"
    ? { expected: "請求金額", paid: "着金額" }
    : { expected: "支払予定額", paid: "支払額" };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <span>⚠</span> 金額不一致
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {labels.paid}が{labels.expected}と一致しません。ステータスを選択してください。
          </p>
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{labels.expected}:</span>
              <span className="font-medium">¥{expectedAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>{labels.paid}:</span>
              <span className="font-medium">¥{paidAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span>差額:</span>
              <span className={`font-medium ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                {diff >= 0 ? "+" : ""}¥{diff.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label>入金ステータス <span className="text-destructive">*</span></Label>
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partial">
                  {isPartial ? "一部入金（残額あり）" : "一部入金"}
                </SelectItem>
                <SelectItem value="completed_different">
                  金額相違あり（入金完了）
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>備考</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="差額の理由など"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            onClick={() => onConfirm(paymentStatus, reason)}
            disabled={!paymentStatus}
          >
            確定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
