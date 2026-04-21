"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import {
  updateZoomAiPromptTemplate,
  updateBusinessPlanPrompt,
  updateBusinessPlanSection,
  resetBusinessPlanSection,
} from "./actions";
import { RotateCcw } from "lucide-react";

type ZoomTemplate = {
  id: number;
  templateKey: string;
  label: string;
  promptBody: string;
  model: string;
  maxTokens: number;
  projectCode: string | null;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

type BpPrompt = {
  id: number;
  promptBody: string;
  model: string;
  maxTokens: number;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

type SectionDef = {
  id: number;
  sectionKey: string;
  title: string;
  targetChars: number;
  instruction: string;
  displayOrder: number;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6（最高品質）" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（推奨）" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5（高速・低コスト）" },
];

export function PromptsEditor({
  zoomTemplates,
  businessPlan,
  sections,
}: {
  zoomTemplates: ZoomTemplate[];
  businessPlan: BpPrompt | null;
  sections: SectionDef[];
}) {
  const router = useRouter();

  // セクション編集 state
  const [sectionEdits, setSectionEdits] = useState<
    Record<number, { title: string; targetChars: number; instruction: string }>
  >(
    Object.fromEntries(
      sections.map((s) => [s.id, { title: s.title, targetChars: s.targetChars, instruction: s.instruction }])
    )
  );
  const [sectionBusyId, setSectionBusyId] = useState<number | null>(null);

  const handleSaveSection = async (id: number) => {
    setSectionBusyId(id);
    try {
      const e = sectionEdits[id];
      const r = await updateBusinessPlanSection(id, e.title, e.targetChars, e.instruction);
      if (r.ok) {
        toast.success("セクションを保存しました");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setSectionBusyId(null);
    }
  };

  const handleResetSection = async (id: number) => {
    if (!window.confirm("このセクションをデフォルト値に戻しますか？")) return;
    setSectionBusyId(id);
    try {
      const r = await resetBusinessPlanSection(id);
      if (r.ok) {
        toast.success("デフォルト値に戻しました");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setSectionBusyId(null);
    }
  };

  // Zoom 編集状態
  const [zoomEdits, setZoomEdits] = useState<
    Record<number, { promptBody: string; model: string; maxTokens: number }>
  >(
    Object.fromEntries(
      zoomTemplates.map((r) => [
        r.id,
        { promptBody: r.promptBody, model: r.model, maxTokens: r.maxTokens },
      ])
    )
  );
  const [zoomBusyId, setZoomBusyId] = useState<number | null>(null);

  // 事業計画書 編集状態
  const [bpEdit, setBpEdit] = useState({
    promptBody: businessPlan?.promptBody ?? "",
    model: businessPlan?.model ?? "claude-sonnet-4-6",
    maxTokens: businessPlan?.maxTokens ?? 32000,
  });
  const [bpBusy, setBpBusy] = useState(false);

  const handleSaveZoom = async (id: number) => {
    setZoomBusyId(id);
    try {
      const e = zoomEdits[id];
      const r = await updateZoomAiPromptTemplate(
        id,
        e.promptBody,
        e.model,
        e.maxTokens
      );
      if (r.ok) {
        toast.success("プロンプトを保存しました");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setZoomBusyId(null);
    }
  };

  const handleSaveBp = async () => {
    if (!businessPlan) return;
    setBpBusy(true);
    try {
      const r = await updateBusinessPlanPrompt(
        businessPlan.id,
        bpEdit.promptBody,
        bpEdit.model,
        bpEdit.maxTokens
      );
      if (r.ok) {
        toast.success("事業計画書プロンプトを保存しました");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setBpBusy(false);
    }
  };

  return (
    <Tabs defaultValue="zoom" className="space-y-4">
      <TabsList>
        <TabsTrigger value="zoom">Zoom議事録 AIプロンプト</TabsTrigger>
        <TabsTrigger value="business-plan">事業計画書プロンプト</TabsTrigger>
        <TabsTrigger value="business-plan-sections">事業計画書 セクション定義</TabsTrigger>
      </TabsList>

      <TabsContent value="zoom" className="space-y-4">
        <div className="rounded-lg border bg-blue-50/50 p-4 text-sm space-y-1">
          <div className="font-semibold">Zoom議事録 AIプロンプト</div>
          <p className="text-xs">
            Zoom議事録のClaude要約生成・先方参加者抽出用のプロンプトです。SLPと共通で使用されます。
          </p>
          <ul className="text-xs list-disc ml-5 space-y-1">
            <li><strong>議事録要約:</strong> <code>{"{{事業者名}} {{商談種別}} {{日時}} {{担当者}}"}</code></li>
            <li><strong>先方参加者抽出:</strong> <code>{"{{弊社スタッフ一覧}}"}</code></li>
          </ul>
        </div>

        {zoomTemplates.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold">
                  {r.label}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {r.projectCode === "hojo" ? "（補助金プロジェクト用）" : "（全プロジェクト共通）"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {r.templateKey}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground">
                最終更新: {new Date(r.updatedAt).toLocaleString("ja-JP")}
                {r.updatedBy && ` (${r.updatedBy.name})`}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">プロンプト本文</Label>
              <Textarea
                value={zoomEdits[r.id].promptBody}
                onChange={(e) =>
                  setZoomEdits((prev) => ({
                    ...prev,
                    [r.id]: { ...prev[r.id], promptBody: e.target.value },
                  }))
                }
                rows={12}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">モデル</Label>
                <Select
                  value={zoomEdits[r.id].model}
                  onValueChange={(v) =>
                    setZoomEdits((prev) => ({
                      ...prev,
                      [r.id]: { ...prev[r.id], model: v },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">max_tokens</Label>
                <Input
                  type="number"
                  value={zoomEdits[r.id].maxTokens}
                  onChange={(e) =>
                    setZoomEdits((prev) => ({
                      ...prev,
                      [r.id]: {
                        ...prev[r.id],
                        maxTokens: parseInt(e.target.value, 10) || 128,
                      },
                    }))
                  }
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => handleSaveZoom(r.id)}
              disabled={zoomBusyId === r.id}
            >
              {zoomBusyId === r.id ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              保存
            </Button>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="business-plan" className="space-y-4">
        <div className="rounded-lg border bg-amber-50/50 p-4 text-sm space-y-1">
          <div className="font-semibold">事業計画書プロンプト</div>
          <p className="text-xs">
            申請サポートの事業計画書PDF生成でClaudeに渡すSystemプロンプトです。
          </p>
          <ul className="text-xs list-disc ml-5 space-y-1">
            <li>
              <code>{"{{sectionSpec}}"}</code>: セクション定義一覧が自動展開されます（コード側で管理）
            </li>
            <li>
              <code>{"{{totalChars}}"}</code>: 全セクションの目安文字数合計が展開されます
            </li>
          </ul>
          <p className="text-xs text-amber-900">
            プレースホルダーは必ず残してください。プロンプト本文の調整（トーン・ルール・出力形式など）を編集できます。
          </p>
        </div>

        {!businessPlan && (
          <div className="rounded border bg-white p-4 text-center text-muted-foreground">
            事業計画書プロンプトがDBに見つかりません。マイグレーションをご確認ください。
          </div>
        )}

        {businessPlan && (
          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="text-[10px] text-muted-foreground">
              最終更新: {new Date(businessPlan.updatedAt).toLocaleString("ja-JP")}
              {businessPlan.updatedBy && ` (${businessPlan.updatedBy.name})`}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">プロンプト本文</Label>
              <Textarea
                value={bpEdit.promptBody}
                onChange={(e) =>
                  setBpEdit((prev) => ({ ...prev, promptBody: e.target.value }))
                }
                rows={20}
                className="text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">モデル</Label>
                <Select
                  value={bpEdit.model}
                  onValueChange={(v) =>
                    setBpEdit((prev) => ({ ...prev, model: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">max_tokens</Label>
                <Input
                  type="number"
                  value={bpEdit.maxTokens}
                  onChange={(e) =>
                    setBpEdit((prev) => ({
                      ...prev,
                      maxTokens: parseInt(e.target.value, 10) || 128,
                    }))
                  }
                />
              </div>
            </div>

            <Button size="sm" onClick={handleSaveBp} disabled={bpBusy}>
              {bpBusy ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Save className="h-3 w-3 mr-1" />
              )}
              保存
            </Button>
          </div>
        )}
      </TabsContent>

      <TabsContent value="business-plan-sections" className="space-y-4">
        <div className="rounded-lg border bg-green-50/50 p-4 text-sm space-y-1">
          <div className="font-semibold">事業計画書 セクション定義（20セクション）</div>
          <p className="text-xs">
            各セクションの「タイトル」「目安文字数」「指示文」を編集するとClaudeへの指示と
            PDFの目次・見出しに反映されます。
          </p>
          <ul className="text-xs list-disc ml-5 space-y-1">
            <li><strong>タイトル</strong>: PDFの目次・各ページの見出しに使われる</li>
            <li><strong>目安文字数</strong>: Claudeが各セクションに書く本文の目標字数。合計がPDFのボリュームになる</li>
            <li><strong>指示文</strong>: Claudeへの書き方の指示。具体化するほど品質が上がる</li>
          </ul>
          <p className="text-xs text-green-900">
            セクションの追加・削除・順序変更は仕様上できません（コード側で固定）。
            「デフォルトに戻す」ボタンで元の設定に戻せます。
          </p>
        </div>

        {sections.map((s) => {
          const e = sectionEdits[s.id];
          const changed =
            e.title !== s.title || e.targetChars !== s.targetChars || e.instruction !== s.instruction;
          return (
            <div key={s.id} className="rounded-lg border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-xs text-muted-foreground font-mono">key: {s.sectionKey}</div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  最終更新: {new Date(s.updatedAt).toLocaleString("ja-JP")}
                  {s.updatedBy && ` (${s.updatedBy.name})`}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_160px] gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">タイトル</Label>
                  <Input
                    value={e.title}
                    onChange={(ev) =>
                      setSectionEdits((prev) => ({
                        ...prev,
                        [s.id]: { ...prev[s.id], title: ev.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">目安文字数</Label>
                  <Input
                    type="number"
                    value={e.targetChars}
                    onChange={(ev) =>
                      setSectionEdits((prev) => ({
                        ...prev,
                        [s.id]: { ...prev[s.id], targetChars: parseInt(ev.target.value, 10) || 100 },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">指示文（Claudeへの書き方指示）</Label>
                <Textarea
                  value={e.instruction}
                  onChange={(ev) =>
                    setSectionEdits((prev) => ({
                      ...prev,
                      [s.id]: { ...prev[s.id], instruction: ev.target.value },
                    }))
                  }
                  rows={4}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveSection(s.id)}
                  disabled={sectionBusyId === s.id || !changed}
                >
                  {sectionBusyId === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Save className="h-3 w-3 mr-1" />
                  )}
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetSection(s.id)}
                  disabled={sectionBusyId === s.id}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  デフォルトに戻す
                </Button>
              </div>
            </div>
          );
        })}
      </TabsContent>
    </Tabs>
  );
}
