"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  addManualZoomToHojoContactHistory,
  listZoomLinkedStaffsForHojo,
} from "./zoom-actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactHistoryId: number;
  onDone?: () => void;
}

export function AddZoomUrlModal({
  open,
  onOpenChange,
  contactHistoryId,
  onDone,
}: Props) {
  const [zoomUrl, setZoomUrl] = useState("");
  const [hostStaffId, setHostStaffId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"fetch_now" | "scheduled">("fetch_now");
  const [staffOptions, setStaffOptions] = useState<
    { id: number; name: string }[]
  >([]);
  const [loadingStaffs, setLoadingStaffs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setZoomUrl("");
    setHostStaffId("");
    setLabel("");
    setMode("fetch_now");
    setLoadingStaffs(true);
    listZoomLinkedStaffsForHojo()
      .then((r) => {
        if (r.ok) {
          setStaffOptions(r.data);
        } else {
          toast.error(r.error);
        }
      })
      .finally(() => setLoadingStaffs(false));
  }, [open]);

  const canSubmit =
    !submitting && zoomUrl.trim() !== "" && hostStaffId !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await addManualZoomToHojoContactHistory({
        contactHistoryId,
        zoomUrl: zoomUrl.trim(),
        hostStaffId: parseInt(hostStaffId, 10),
        label: label.trim() || undefined,
        mode,
      });
      if (r.ok) {
        if (r.data.message) {
          toast.info(r.data.message);
        } else if (r.data.state === "完了") {
          toast.success("Zoom議事録を取得しました");
        } else if (r.data.state === "失敗") {
          toast.warning("取得に失敗しました。再取得ボタンから再試行できます");
        } else {
          toast.success("予定として保存しました");
        }
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Zoom 議事録連携を追加</DialogTitle>
          <DialogDescription>
            Zoom URL を入力すると、議事録・録画・参加者情報を自動取得します。未実施のZoomも予定として登録できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zoomUrl">Zoom URL（必須）</Label>
            <Input
              id="zoomUrl"
              type="url"
              value={zoomUrl}
              onChange={(e) => setZoomUrl(e.target.value)}
              placeholder="https://zoom.us/j/12345678901?pwd=..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hostStaffId">Zoomのホストスタッフ（必須）</Label>
            <Select
              value={hostStaffId}
              onValueChange={setHostStaffId}
              disabled={loadingStaffs || staffOptions.length === 0}
            >
              <SelectTrigger id="hostStaffId">
                <SelectValue
                  placeholder={
                    loadingStaffs
                      ? "読み込み中..."
                      : staffOptions.length === 0
                      ? "Zoom連携済みスタッフがいません"
                      : "ホストを選択"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Zoom連携を完了しているスタッフのみ選択可能です
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">ラベル（任意）</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 延長分, 再実施"
            />
          </div>

          <div className="space-y-2">
            <Label>このZoomは</Label>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="fetch_now"
                  checked={mode === "fetch_now"}
                  onChange={() => setMode("fetch_now")}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm">実施済み（今すぐ議事録を取得）</div>
                  <div className="text-xs text-muted-foreground">
                    Zoom側に録画が無ければ自動で「予定」状態で保存します
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value="scheduled"
                  checked={mode === "scheduled"}
                  onChange={() => setMode("scheduled")}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm">未実施（予定として保存）</div>
                  <div className="text-xs text-muted-foreground">
                    Zoom終了後、webhookで自動取得されます
                  </div>
                </div>
              </label>
            </div>
          </div>

          {staffOptions.length === 0 && !loadingStaffs && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                HOJOプロジェクトの権限を持ちZoom連携済みのスタッフがいません。スタッフの個人設定からZoom連携を行ってください。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            キャンセル
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            追加する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
