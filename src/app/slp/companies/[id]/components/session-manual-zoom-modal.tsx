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
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setManualZoomForSession } from "../zoom-meeting-actions";
import { listAllSlpStaffsForZoomHost } from "@/app/slp/contact-histories/zoom-actions";

type StaffOption = { id: number; name: string; zoomIntegrated: boolean };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
  onDone?: () => void;
};

const UNSET_HOST = "__unset__";

export function SessionManualZoomModal({
  open,
  onOpenChange,
  sessionId,
  onDone,
}: Props) {
  const [joinUrl, setJoinUrl] = useState("");
  const [hostStaffId, setHostStaffId] = useState<string>(UNSET_HOST);
  const [label, setLabel] = useState("");
  const [staffs, setStaffs] = useState<StaffOption[]>([]);
  const [loadingStaffs, setLoadingStaffs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setJoinUrl("");
    setHostStaffId(UNSET_HOST);
    setLabel("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingStaffs(true);
    listAllSlpStaffsForZoomHost()
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setStaffs(r.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingStaffs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedStaff =
    hostStaffId === UNSET_HOST
      ? null
      : staffs.find((s) => s.id === parseInt(hostStaffId, 10)) ?? null;
  const willBeApiLess =
    hostStaffId === UNSET_HOST || !(selectedStaff?.zoomIntegrated ?? false);

  const canSubmit = !submitting && joinUrl.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const r = await setManualZoomForSession({
        sessionId,
        joinUrl: joinUrl.trim(),
        hostStaffId:
          hostStaffId === UNSET_HOST ? null : parseInt(hostStaffId, 10),
        label: label.trim() || null,
      });
      if (r.ok) {
        toast.success("手動Zoom URLを登録しました");
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(r.message);
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
          <DialogTitle>手動で Zoom URL を入力</DialogTitle>
          <DialogDescription>
            Zoom連携していない担当者が開催する場合、または連携済みスタッフが自分のZoomで立てた会議のURLを登録する場合に使います。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manualJoinUrl">Zoom URL（必須）</Label>
            <Input
              id="manualJoinUrl"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualHostStaff">
              ホスト担当者（任意・Zoom連携済みなら録画取得が可能になります）
            </Label>
            <Select
              value={hostStaffId}
              onValueChange={setHostStaffId}
              disabled={loadingStaffs}
            >
              <SelectTrigger id="manualHostStaff">
                <SelectValue
                  placeholder={
                    loadingStaffs ? "読み込み中..." : "未選択（API連携なし）"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_HOST}>
                  未選択（API連携なし）
                </SelectItem>
                {staffs.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                    {s.zoomIntegrated ? "（連携済み）" : "（API連携なし）"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manualLabel">ラベル（任意）</Label>
            <Input
              id="manualLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 外部主催、ゲストURL など"
            />
          </div>

          <Alert
            className={
              willBeApiLess
                ? "bg-amber-50 border-amber-200"
                : "bg-blue-50 border-blue-200"
            }
          >
            <AlertCircle
              className={`h-4 w-4 ${
                willBeApiLess ? "text-amber-600" : "text-blue-600"
              }`}
            />
            <AlertDescription
              className={`text-xs ${
                willBeApiLess ? "text-amber-800" : "text-blue-800"
              }`}
            >
              {willBeApiLess ? (
                <p>
                  「<strong>API連携なし</strong>」として登録されます。リマインド送信は動作しますが、録画・議事録の自動取得はできません。
                </p>
              ) : (
                <p>
                  Zoom連携済みスタッフをホストに指定したため、録画・議事録の自動取得が有効になります。（そのスタッフのZoomアカウント内に会議が存在しない場合は取得に失敗します）
                </p>
              )}
            </AlertDescription>
          </Alert>
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
            {submitting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            登録する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
