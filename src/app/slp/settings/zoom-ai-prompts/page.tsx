import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listZoomAiPromptTemplates } from "./actions";
import { PromptsEditor } from "./prompts-editor";

export default async function ZoomAiPromptsPage() {
  const rows = await listZoomAiPromptTemplates();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Zoom AIプロンプト設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>AI議事録要約・お礼メッセージ生成 プロンプト</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Claude に渡すSystemプロンプトを編集できます。
            これらは「議事録のClaude要約生成ボタン」「お礼メッセージAI生成ボタン」「先方参加者自動抽出」に使われます。
          </p>
          <PromptsEditor
            rows={rows.map((r) => ({
              id: r.id,
              templateKey: r.templateKey,
              label: r.label,
              promptBody: r.promptBody,
              model: r.model,
              maxTokens: r.maxTokens,
              updatedAt: r.updatedAt,
              updatedBy: r.updatedBy ? { name: r.updatedBy.name } : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
