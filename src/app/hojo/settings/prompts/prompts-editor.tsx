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
} from "./actions";

type ZoomTemplate = {
  id: number;
  templateKey: string;
  label: string;
  promptBody: string;
  model: string;
  maxTokens: number;
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

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6（最高品質）" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（推奨）" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5（高速・低コスト）" },
];

export function PromptsEditor({
  zoomTemplates,
  businessPlan,
}: {
  zoomTemplates: ZoomTemplate[];
  businessPlan: BpPrompt | null;
}) {
  const router = useRouter();

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
                <div className="font-semibold">{r.label}</div>
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
    </Tabs>
  );
}
