import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listZoomAiPromptTemplates, getBusinessPlanPrompt, listBusinessPlanSections } from "./actions";
import { PromptsEditor } from "./prompts-editor";

export default async function HojoPromptsSettingsPage() {
  const [zoomRows, bp, sectionRows] = await Promise.all([
    listZoomAiPromptTemplates(),
    getBusinessPlanPrompt(),
    listBusinessPlanSections(),
  ]);

  const zoomTemplates = zoomRows.map((r) => ({
    id: r.id,
    templateKey: r.templateKey,
    label: r.label,
    promptBody: r.promptBody,
    model: r.model,
    maxTokens: r.maxTokens,
    projectCode: r.projectCode,
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy ? { name: r.updatedBy.name } : null,
  }));

  const businessPlan = bp
    ? {
        id: bp.id,
        promptBody: bp.promptBody,
        model: bp.model,
        maxTokens: bp.maxTokens,
        updatedAt: bp.updatedAt,
        updatedBy: bp.updatedBy ? { name: bp.updatedBy.name } : null,
      }
    : null;

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold">AIプロンプト設定</h1>
      <Card>
        <CardHeader>
          <CardTitle>Claude に渡すプロンプトを編集</CardTitle>
        </CardHeader>
        <CardContent>
          <PromptsEditor
            zoomTemplates={zoomTemplates}
            businessPlan={businessPlan}
            sections={sectionRows.map((r) => ({
              id: r.id,
              sectionKey: r.sectionKey,
              title: r.title,
              targetChars: r.targetChars,
              instruction: r.instruction,
              displayOrder: r.displayOrder,
              updatedAt: r.updatedAt,
              updatedBy: r.updatedBy ? { name: r.updatedBy.name } : null,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
