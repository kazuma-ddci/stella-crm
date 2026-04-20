import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info } from "lucide-react";
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

/**
 * エラーソース別の「わかりやすい説明・想定原因・対処法」。
 * source の完全一致 or プレフィックス一致で返す。null のとき説明ブロックは出さない。
 */
type ErrorGuidance = {
  description: string; // 何がどうして記録されたか
  likelyCauses: string[]; // 想定される原因（0件なら表示しない）
  actions: string[]; // スタッフの次のアクション（0件なら表示しない）
};

function getErrorGuidance(source: string, message: string): ErrorGuidance | null {
  // ---- 紹介者へのLINE通知失敗 ----
  if (
    source.startsWith("slp-session-notify-referrer-") ||
    source.startsWith("slp-session-notification-referrer-")
  ) {
    return {
      description:
        "商談の予約確定・変更・キャンセル・完了などのタイミングで、紹介者の公式LINEにお知らせを送る処理が失敗しました。",
      likelyCauses: [
        "メイン担当者のLINE友達情報で「紹介者UID(free1欄)」が設定されていない",
        "紹介者向けテンプレートが無効化されている、または文面がない",
        "プロライン送信APIの一時的な障害",
      ],
      actions: [
        "詳細を開いて errorMessage を確認（UID未取得 or テンプレ未存在など、具体的な失敗理由が書いてあります）",
        "事業者詳細の「担当者」タブでメイン担当者の紹介者設定を確認",
        "必要なら商談の「通知対象を個別設定」から手動再送",
      ],
    };
  }

  // ---- お客様向けLINE通知失敗 ----
  if (
    source.startsWith("slp-session-notify-customer-") ||
    source.startsWith("slp-session-notification-customer-")
  ) {
    return {
      description:
        "商談の予約確定・変更・キャンセル・リマインドなどで、事業者の担当者にお知らせを送る処理が失敗しました。",
      likelyCauses: [
        "担当者のLINE友達が紐付いていない（公式LINE追加前）",
        "該当テンプレートが無効化されている",
        "プロライン送信APIの一時的な障害",
      ],
      actions: [
        "詳細を開いて errorMessage を確認",
        "事業者詳細の「担当者」タブで LINE 紐付け状況をチェック",
        "「商談通知を受け取る」チェックや個別通知設定を見直し",
      ],
    };
  }

  // ---- Zoom発行失敗（担当者の連携未完了） ----
  if (source.startsWith("slp-zoom-session-")) {
    return {
      description:
        "商談予約が入ったため担当者のZoomアカウントで会議URLを自動発行しようとしましたが、Zoom連携が未完了のため失敗しました。",
      likelyCauses: [
        "担当者スタッフがCRMの「スタッフ設定」でZoom連携(OAuth)をしていない",
        "Zoom連携はしたが期限切れ or 手動切断された",
        "Zoomアカウント側の制限（会議数上限など）",
      ],
      actions: [
        "詳細からスタッフIDを確認し、そのスタッフ本人に「スタッフ設定 → Zoom連携」を実行してもらう",
        "または商談の担当者を、すでにZoom連携済みの別スタッフに変更",
        "連携後は商談詳細の「Zoom再発行」ボタンで手動再発行",
      ],
    };
  }

  // ---- 予約Webhookの CRMトークン無効（フォールバック処理済み） ----
  if (
    (source === "slp-briefing-reservation" ||
      source === "slp-consultation-reservation") &&
    message.includes("CRMトークン")
  ) {
    return {
      description:
        "予約フォームに埋め込まれていたCRMトークンが、DBに見つかりませんでした。ただし自動的にフォールバック処理が走り、予約自体は新規企業として正しく取り込まれています。監査用に記録されているだけで、基本的には業務影響なしです。",
      likelyCauses: [
        "予約フォームのトークン有効期限切れ（発行から時間が経ってから予約）",
        "同じ予約フォームURLを何度も使って2回目以降のトークンが消費済み",
        "ユーザーが古いブックマークから予約ページを開いた",
      ],
      actions: [
        "事業者名簿に該当企業のレコードが正しく作られていることを確認",
        "問題なければ「解決済みにする」で閉じてOK",
        "大量に発生する場合はトークン発行ロジックに問題の可能性あり",
      ],
    };
  }

  // ---- CloudSignメール不達（組合員なし） ----
  if (source === "cloudsign-bounce") {
    return {
      description:
        "CloudSignからメール不達Webhookが届きましたが、その書類IDに対応する組合員が組合員名簿に見つかりませんでした。『未照合バウンス』として別テーブルに保存され、後からスタッフが手動で照合できる状態です。",
      likelyCauses: [
        "CRMを経由せずCloudSignで直接送信した契約書のバウンス",
        "組合員データを削除した後にバウンス通知が来た",
        "自社用の受信メールアドレス(support@等)がバウンスしている（受信設定の問題）",
      ],
      actions: [
        "詳細のdocumentIDをCloudSign管理画面で検索し、何の書類か特定",
        "自社アドレスのバウンスが繰り返し発生しているなら、メールサーバー設定を確認",
        "特定できて対応済みなら「解決済みにする」で閉じる",
      ],
    };
  }

  // ---- CloudSignメール不達LINE通知（組合員はいた、LINE送信失敗） ----
  if (source === "cloudsign-webhook-bounced-notify") {
    return {
      description:
        "CloudSignからのメール不達を検知し、組合員本人に「メールが届きませんでした」とLINEで通知しようとしましたが、LINE送信自体が失敗しました。",
      likelyCauses: [
        "組合員のLINE友達連携が切れている",
        "テンプレート(contract_bounced)が無効化されている",
        "プロライン送信APIの一時的な障害",
      ],
      actions: [
        "詳細のuidから組合員を特定",
        "組合員名簿で公式LINE紐付けを確認・再リンク",
        "「再送」ボタンで手動再送",
      ],
    };
  }

  // ---- 契約書リマインドLINE（新・旧） ----
  if (
    source === "cron/remind-slp-members/contract_reminder" ||
    source === "members/remind/contract_reminder" ||
    source === "cron/remind-slp-members/form12" ||
    source === "members/remind/form12"
  ) {
    return {
      description:
        "契約書送付後、N日経過しても締結されていない組合員に契約書リマインドLINEを送ろうとしましたが失敗しました。",
      likelyCauses: [
        "組合員のLINE友達連携が切れている",
        "テンプレート(contract_reminder)が無効化されている",
        "プロライン送信APIの一時的な障害",
      ],
      actions: [
        "詳細のuid/emailで組合員を特定",
        "組合員名簿で公式LINE紐付けを確認",
        "「再送」ボタンで手動再送",
      ],
    };
  }

  // ---- 紹介者への契約締結通知失敗 ----
  if (
    source === "webhook/line-friend/contract_signed" ||
    source === "cloudsign-webhook/contract_signed"
  ) {
    return {
      description:
        "契約が締結されたタイミングで紹介者に「ご紹介いただいた方が組合員契約まで完了しました」というお礼LINEを送ろうとしましたが失敗しました。",
      likelyCauses: [
        "紹介者UIDが取得できない（組合員のLINE友達情報のfree1欄が空）",
        "テンプレート(contract_signed)が無効化されている",
        "プロライン送信APIの一時的な障害",
      ],
      actions: [
        "詳細のmemberIdから組合員を特定し、紹介者情報を見直し",
        "手動で組合員名簿の「紹介者通知(form5)」ボタンから再送も可能",
      ],
    };
  }

  // ---- 自動リマインド本体（sendSlpRemind側のエラー） ----
  if (source === "cron/remind-slp-members") {
    return {
      description:
        "自動リマインド処理の本体（CloudSignリマインド送付処理など）が失敗しました。LINEの失敗は別エラー(.../contract_reminder)で記録されます。",
      likelyCauses: [
        "CloudSign API の一時的な障害",
        "対象組合員のdocumentIDが不正",
        "プロジェクト設定でリマインド日数が未設定",
      ],
      actions: [
        "詳細のエラー内容を確認",
        "必要ならCloudSign管理画面で該当書類の状態を確認",
      ],
    };
  }

  // 該当なし
  return null;
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
                const guidance = getErrorGuidance(error.source, error.message);
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

                        {guidance && (
                          <div className="mt-2 rounded-md border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950 space-y-2">
                            <div className="flex gap-2">
                              <Info className="h-4 w-4 flex-none text-blue-600 mt-0.5" />
                              <p className="leading-relaxed">
                                {guidance.description}
                              </p>
                            </div>
                            {guidance.likelyCauses.length > 0 && (
                              <div className="pl-6">
                                <div className="font-semibold text-blue-900 mb-0.5">
                                  想定される原因
                                </div>
                                <ul className="list-disc pl-4 space-y-0.5 text-blue-950/80">
                                  {guidance.likelyCauses.map((c, i) => (
                                    <li key={i}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {guidance.actions.length > 0 && (
                              <div className="pl-6">
                                <div className="font-semibold text-blue-900 mb-0.5">
                                  対処の手順
                                </div>
                                <ol className="list-decimal pl-4 space-y-0.5 text-blue-950/80">
                                  {guidance.actions.map((a, i) => (
                                    <li key={i}>{a}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        )}

                        {(entries.length > 0 || raw) && (
                          <details className="text-xs text-muted-foreground mt-1">
                            <summary className="cursor-pointer hover:text-foreground">
                              詳細を表示（生データ）
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
