"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  RefreshCw,
  Unlink,
  Link2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  startOAuthFlow,
  disconnectConnection,
  updateSyncFromDate,
} from "./actions";
import type { MFConnectionRow } from "./actions";

type Props = {
  connections: MFConnectionRow[];
  companies: { id: number; companyName: string }[];
};

export function MFSettingsClient({ connections, companies }: Props) {
  const searchParams = useSearchParams();
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [disconnectingIds, setDisconnectingIds] = useState<Set<number>>(
    new Set()
  );
  const [connectingCompanyId, setConnectingCompanyId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // URL パラメータからメッセージを表示
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setMessage({ type: "success", text: "マネーフォワードに接続しました" });
    }
    const error = searchParams.get("error");
    if (error) {
      setMessage({ type: "error", text: `接続エラー: ${error}` });
    }
  }, [searchParams]);

  // 接続済みの法人IDセット
  const connectedCompanyIds = new Set(
    connections.map((c) => c.operatingCompany.id)
  );
  const availableCompanies = companies.filter(
    (c) => !connectedCompanyIds.has(c.id)
  );

  /** 同期実行 */
  async function handleSync(connectionId: number) {
    setSyncingIds((prev) => new Set(prev).add(connectionId));
    setMessage(null);
    try {
      const res = await fetch("/api/moneyforward/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "同期に失敗しました",
        });
      } else {
        setMessage({
          type: "success",
          text: `同期完了: ${data.newCount}件の新規取引を取り込みました（重複スキップ: ${data.duplicateCount}件）`,
        });
      }
    } catch {
      setMessage({ type: "error", text: "同期中にエラーが発生しました" });
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }

  /** 接続解除 */
  async function handleDisconnect(connectionId: number) {
    if (!confirm("この接続を解除しますか？")) return;
    setDisconnectingIds((prev) => new Set(prev).add(connectionId));
    try {
      const result = await disconnectConnection(connectionId);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "接続を解除しました" });
      }
    } catch {
      setMessage({ type: "error", text: "接続解除に失敗しました" });
    } finally {
      setDisconnectingIds((prev) => {
        const next = new Set(prev);
        next.delete(connectionId);
        return next;
      });
    }
  }

  /** 新規接続 */
  async function handleConnect() {
    if (!connectingCompanyId) return;
    setIsConnecting(true);
    try {
      const result = await startOAuthFlow(Number(connectingCompanyId));
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        setIsConnecting(false);
        return;
      }
      window.location.href = result.data.authorizationUrl;
    } catch {
      setMessage({ type: "error", text: "認可URLの生成に失敗しました" });
      setIsConnecting(false);
    }
  }

  /** 同期開始日の更新 */
  async function handleSyncFromDateChange(
    connectionId: number,
    date: string
  ) {
    try {
      const result = await updateSyncFromDate(connectionId, date);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: "同期開始日を更新しました" });
      }
    } catch {
      setMessage({ type: "error", text: "同期開始日の更新に失敗しました" });
    }
  }

  return (
    <div className="space-y-6">
      {/* メッセージ */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-4 ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* 既存の接続一覧 */}
      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>接続済みアカウント</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {conn.operatingCompany.companyName}
                    </span>
                    <Badge
                      variant={conn.isActive ? "default" : "secondary"}
                    >
                      {conn.isActive ? "接続中" : "無効"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    最終同期:{" "}
                    {conn.lastSyncedAt
                      ? new Date(conn.lastSyncedAt).toLocaleString("ja-JP")
                      : "未同期"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">
                      同期開始日:
                    </Label>
                    <DatePicker
                      value={
                        conn.syncFromDate
                          ? new Date(conn.syncFromDate)
                              .toISOString()
                              .slice(0, 10)
                          : ""
                      }
                      onChange={(date) =>
                        handleSyncFromDateChange(conn.id, date)
                      }
                      placeholder="開始日を選択"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(conn.id)}
                    disabled={syncingIds.has(conn.id)}
                  >
                    {syncingIds.has(conn.id) ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-4 w-4" />
                    )}
                    同期実行
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(conn.id)}
                    disabled={disconnectingIds.has(conn.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    {disconnectingIds.has(conn.id) ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-1 h-4 w-4" />
                    )}
                    接続解除
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 新規接続 */}
      <Card>
        <CardHeader>
          <CardTitle>新規接続</CardTitle>
        </CardHeader>
        <CardContent>
          {availableCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              全ての法人が接続済みです
            </p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:min-w-[240px]">
                <Label>法人</Label>
                <Select
                  value={connectingCompanyId}
                  onValueChange={setConnectingCompanyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="法人を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCompanies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleConnect}
                disabled={!connectingCompanyId || isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-1 h-4 w-4" />
                )}
                マネーフォワードに接続
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
