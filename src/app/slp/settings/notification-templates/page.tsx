import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listNotificationTemplates } from "./actions";
import { TemplatesEditor } from "./templates-editor";

export default async function NotificationTemplatesPage() {
  const rows = await listNotificationTemplates();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">通知テンプレート設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>お客様 / 紹介者への通知文面</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              商談セッションの各トリガー（予約確定・変更・キャンセル・リマインド・完了）で送信される通知文面を編集できます。
            </p>
            <p>
              <strong>ラウンド番号（1回目 / 2回目以降）</strong>、
              <strong>予約ソース（プロライン経由 / 手動セット）</strong> ごとに文面を分けて管理できます。
            </p>
            <p>
              紹介者通知は<strong>概要案内1回目のみ</strong>送信されます（2回目以降・導入希望商談では送信されません）。
            </p>
          </div>
          <TemplatesEditor
            rows={rows.map((r) => ({
              id: r.id,
              recipient: r.recipient,
              category: r.category,
              roundType: r.roundType,
              source: r.source,
              trigger: r.trigger,
              formId: r.formId,
              label: r.label,
              body: r.body,
              isActive: r.isActive,
              updatedAt: r.updatedAt.toISOString(),
              updatedBy: r.updatedBy ? { name: r.updatedBy.name } : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
