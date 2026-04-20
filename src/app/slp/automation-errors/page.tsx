import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { ErrorActions } from "./error-actions";

/** source を日本語ラベルに変換 */
function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    "cloudsign-webhook": "CloudSign Webhook",
    "cron/remind-slp-members": "自動リマインド",
    "cron/sync-line-friends": "LINE友だち同期",
    "cron/sync-cloudsign-status": "CloudSignステータス同期",
    "cron/check-cloudsign-signing": "CloudSign署名URL取得",
    "cron/fetch-usdt-rate": "USDTレート取得",
    "cron/check-inbound-invoices": "受領請求書チェック",
    "public/slp/member-registration": "組合員フォーム登録",
    "webhook/line-friend": "LINE友だちWebhook",
    "proline-form-submit": "プロラインフォーム送信",
    // 概要案内Webhook
    "slp-briefing-reservation": "概要案内予約 Webhook",
    "slp-briefing-change": "概要案内変更 Webhook",
    "slp-briefing-cancel": "概要案内キャンセル Webhook",
    // 概要案内 紹介者通知
    "slp-briefing-reservation-form6": "概要案内予約通知（form6）",
    "slp-briefing-change-form7": "概要案内変更通知（form7）",
    "slp-briefing-cancel-form9": "概要案内キャンセル通知（form9）",
    "slp-briefing-complete-form10": "概要案内完了 紹介者通知（form10）",
    "slp-briefing-complete-form11": "概要案内完了 お礼メッセージ（form11）",
    // 導入希望商談Webhook
    "slp-consultation-reservation": "導入希望商談予約 Webhook",
    "slp-consultation-change": "導入希望商談変更 Webhook",
    "slp-consultation-cancel": "導入希望商談キャンセル Webhook",
    // 導入希望商談 完了処理
    "slp-consultation-complete-form13": "導入希望商談完了 お礼メッセージ（form13）",
    // 契約書リマインド（旧Form12・後方互換）
    "cron/remind-slp-members/form12": "契約書リマインドLINE（旧form12）",
    "members/remind/form12": "契約書リマインドLINE 手動（旧form12）",
    // 契約書リマインド・メール不達（Form15統合後）
    "cron/remind-slp-members/contract_reminder": "契約書リマインドLINE（自動）",
    "members/remind/contract_reminder": "契約書リマインドLINE（手動）",
    "webhook/line-friend/contract_signed": "契約締結通知（LINE後紐付け時）",
    "cloudsign-webhook/contract_signed": "契約締結通知（CloudSign完了時）",
    "cloudsign-webhook-bounced-notify": "メール不達通知LINE",
  };
  return map[source] || source;
}

function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** detailのキーを日本語ラベルに変換 */
const detailKeyLabels: Record<string, string> = {
  uid: "ユーザーID",
  name: "名前",
  email: "メールアドレス",
  phone: "電話番号",
  memberCategory: "入会者区分",
  position: "役職",
  company: "法人情報",
  address: "住所",
  note: "備考",
  error: "エラー内容",
  documentId: "書類ID",
  contactId: "担当者ID",
  referrerUid: "紹介者UID",
  snsname: "LINE名",
  briefingDate: "概要案内日",
  consultationDate: "導入希望商談日",
  freeText: "送信内容",
  sentDate: "送付日",
  memberId: "組合員ID",
};

/** 表示から除外するキー */
const hiddenKeys = new Set(["retryAction"]);

function parseDetail(detail: string | null): {
  retryAction: string | null;
  entries: { label: string; value: string }[];
  raw: string | null;
} {
  if (!detail) return { retryAction: null, entries: [], raw: null };

  try {
    const parsed = JSON.parse(detail);
    if (typeof parsed !== "object" || parsed === null) {
      return { retryAction: null, entries: [], raw: detail };
    }

    const retryAction = (parsed.retryAction as string) ?? null;
    const entries: { label: string; value: string }[] = [];

    for (const [key, value] of Object.entries(parsed)) {
      if (hiddenKeys.has(key)) continue;
      if (value === null || value === undefined || value === "") continue;

      const label = detailKeyLabels[key] || key;
      const strValue =
        typeof value === "string" ? value : JSON.stringify(value);
      entries.push({ label, value: strValue });
    }

    return { retryAction, entries, raw: null };
  } catch {
    return { retryAction: null, entries: [], raw: detail };
  }
}

type SearchParams = {
  filter?: string;
};

export default async function AutomationErrorsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filter = params.filter === "resolved" ? "resolved" : "unresolved";

  const allErrors = await prisma.automationError.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const unresolvedCount = allErrors.filter((e) => !e.resolved).length;
  const resolvedCount = allErrors.filter((e) => e.resolved).length;

  const errors = allErrors.filter((e) =>
    filter === "unresolved" ? !e.resolved : e.resolved
  );

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-7 w-7 text-yellow-500" />
        <h1 className="text-2xl font-bold">自動化エラー</h1>
        {unresolvedCount > 0 && (
          <Badge variant="destructive">{unresolvedCount}件 未解決</Badge>
        )}
      </div>

      {/* フィルタタブ */}
      <div className="flex gap-2 border-b">
        <a
          href="?filter=unresolved"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "unresolved"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          未解決 ({unresolvedCount})
        </a>
        <a
          href="?filter=resolved"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            filter === "resolved"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          解決済み ({resolvedCount})
        </a>
      </div>

      {errors.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              {filter === "unresolved" ? "未解決のエラーはありません" : "解決済みのエラーはありません"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>エラー一覧</CardTitle>
            <CardDescription>
              直近500件のうち {filter === "unresolved" ? "未解決" : "解決済み"} を表示しています。Webhook・Cron・フォーム等の自動化処理で発生したエラーが記録されます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {errors.map((error) => {
                const { retryAction, entries, raw } = parseDetail(
                  error.detail
                );
                return (
                  <div
                    key={error.id}
                    className={`py-4 ${error.resolved ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {sourceLabel(error.source)}
                          </Badge>
                          {error.resolved ? (
                            <Badge variant="secondary">解決済み</Badge>
                          ) : (
                            <Badge variant="destructive">未解決</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(error.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{error.message}</p>
                        {(entries.length > 0 || raw) && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">
                              詳細を表示
                            </summary>
                            {entries.length > 0 ? (
                              <dl className="mt-1 p-2 bg-muted rounded grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 max-h-40 overflow-auto">
                                {entries.map(({ label, value }) => (
                                  <div key={label} className="contents">
                                    <dt className="font-medium text-foreground/70">
                                      {label}
                                    </dt>
                                    <dd className="break-all">{value}</dd>
                                  </div>
                                ))}
                              </dl>
                            ) : (
                              <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap break-all max-h-40 overflow-auto">
                                {raw}
                              </pre>
                            )}
                          </details>
                        )}
                        <ErrorActions
                          errorId={error.id}
                          retryAction={retryAction}
                          resolved={error.resolved}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
