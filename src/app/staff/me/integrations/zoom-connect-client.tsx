"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { disconnectZoomSelf, disconnectZoomForOtherStaff } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle, Video } from "lucide-react";

type Props = {
  isSelfConnected: boolean;
  selfEmail?: string | null;
  selfDisplayName?: string | null;
  showSuccess?: boolean;
  errorReason?: string | null;
};

export function ZoomSelfConnectCard({
  isSelfConnected,
  selfEmail,
  selfDisplayName,
  showSuccess,
  errorReason,
}: Props) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    // Server Actionでredirect → Zoom認可画面へ
    window.location.href = "/api/integrations/zoom/authorize";
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await disconnectZoomSelf();
      if (result.ok) {
        toast.success("Zoom連携を解除しました");
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Video className="h-8 w-8 text-blue-500 shrink-0" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Zoom 連携</h2>
          <p className="text-sm text-muted-foreground mt-1">
            商談予約時にあなたのZoomアカウントで自動的に会議URLを発行するために、Zoom連携を行ってください。
          </p>
        </div>
      </div>

      {showSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" />
          Zoom連携が完了しました。
        </div>
      )}
      {errorReason && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" />
          連携に失敗しました: {errorReason}
        </div>
      )}

      {isSelfConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="font-medium">連携済み</span>
            {selfEmail && <span className="text-muted-foreground">（{selfEmail}）</span>}
            {selfDisplayName && <span className="text-muted-foreground">[{selfDisplayName}]</span>}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={disconnecting}>
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Unlink className="h-4 w-4 mr-2" />
                )}
                連携を解除する
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Zoom連携を解除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  解除するとあなた担当の商談で新しいZoom URLが自動発行されなくなります。再度連携することで元に戻せます。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>解除する</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <Button onClick={handleConnect}>
          <Link2 className="h-4 w-4 mr-2" />
          Zoom と連携する
        </Button>
      )}

      <div className="pt-2 text-xs text-muted-foreground">
        ※ 連携手順がわからない場合は{" "}
        <a href="/staff/me/integrations/guide" className="text-blue-600 underline">
          連携ガイド
        </a>{" "}
        をご覧ください。
      </div>
    </div>
  );
}

type OtherStaffRow = {
  id: number;
  name: string;
  email: string | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  externalEmail: string | null;
};

export function OtherStaffZoomList({
  rows,
  canDisconnect,
}: {
  rows: OtherStaffRow[];
  canDisconnect: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const handleDisconnect = async (staffId: number, name: string) => {
    if (!confirm(`${name}さんのZoom連携を解除してよろしいですか？`)) return;
    setBusyId(staffId);
    try {
      const r = await disconnectZoomForOtherStaff(staffId);
      if (r.ok) {
        toast.success(`${name}さんのZoom連携を解除しました`);
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3">スタッフ名</th>
            <th className="text-left p-3">連携状況</th>
            <th className="text-left p-3">Zoomアカウント</th>
            <th className="text-left p-3">連携日時</th>
            {canDisconnect && <th className="text-left p-3">操作</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={canDisconnect ? 5 : 4} className="p-4 text-center text-muted-foreground">
                他のスタッフはいません
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const connected = !!r.connectedAt && !r.disconnectedAt;
            return (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.name}</td>
                <td className="p-3">
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      連携済
                    </span>
                  ) : (
                    <span className="text-muted-foreground">未連携</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{r.externalEmail ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {r.connectedAt ? new Intl.DateTimeFormat("ja-JP").format(r.connectedAt) : "—"}
                </td>
                {canDisconnect && (
                  <td className="p-3">
                    {connected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(r.id, r.name)}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "解除"
                        )}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
