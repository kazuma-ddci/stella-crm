import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listZoomMessageTemplates } from "./actions";
import { TemplatesEditor } from "./templates-editor";

export default async function ZoomTemplatesPage() {
  const rows = await listZoomMessageTemplates();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Zoom 通知メッセージ設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>文面テンプレート</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            予約確定・変更・リマインド時に、お客様のLINEへ送信される文面を編集できます。
            本文に <code>{"{{事業者名}}"}</code> のような変数を書くと、送信時に実際の値に置き換わります。
          </p>
          <TemplatesEditor
            rows={rows.map((r) => ({
              id: r.id,
              templateKey: r.templateKey,
              category: r.category,
              trigger: r.trigger,
              label: r.label,
              body: r.body,
              isActive: r.isActive,
              updatedAt: r.updatedAt,
              updatedBy: r.updatedBy ? { name: r.updatedBy.name } : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
