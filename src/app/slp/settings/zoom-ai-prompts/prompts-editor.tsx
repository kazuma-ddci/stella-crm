"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { updateZoomAiPromptTemplate } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type TemplateRow = {
  id: number;
  templateKey: string;
  label: string;
  promptBody: string;
  model: string;
  maxTokens: number;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6（最高品質・高コスト）" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6（推奨・要約向き）" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5（高速・低コスト）" },
];

export function PromptsEditor({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<
    Record<number, { promptBody: string; model: string; maxTokens: number }>
  >(
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        { promptBody: r.promptBody, model: r.model, maxTokens: r.maxTokens },
      ])
    )
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleSave = async (id: number) => {
    setBusyId(id);
    try {
      const e = edits[id];
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
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-blue-50/50 p-4 text-sm space-y-1">
        <div className="font-semibold">利用可能な変数</div>
        <p className="text-xs">
          テンプレートごとに使える変数が異なります:
        </p>
        <ul className="text-xs list-disc ml-5 space-y-1">
          <li><strong>議事録要約:</strong> <code>{"{{事業者名}} {{商談種別}} {{日時}} {{担当者}}"}</code></li>
          <li><strong>先方参加者抽出:</strong> <code>{"{{弊社スタッフ一覧}}"}</code></li>
          <li><strong>お礼メッセージ:</strong> <code>{"{{事業者名}} {{要約}}"}</code></li>
        </ul>
      </div>

      {rows.map((r) => {
        const e = edits[r.id];
        const changed =
          e.promptBody !== r.promptBody ||
          e.model !== r.model ||
          e.maxTokens !== r.maxTokens;
        return (
          <div key={r.id} className="rounded-lg border p-4 space-y-3">
            <div>
              <div className="font-semibold">{r.label}</div>
              <div className="text-xs text-muted-foreground">
                key: <code>{r.templateKey}</code>
                {r.updatedBy && (
                  <>
                    ・ 最終更新: {r.updatedBy.name}（
                    {new Intl.DateTimeFormat("ja-JP").format(new Date(r.updatedAt))}）
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">モデル</label>
                <Select
                  value={e.model}
                  onValueChange={(v) =>
                    setEdits((prev) => ({
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
              <div>
                <label className="text-xs font-medium">max_tokens</label>
                <Input
                  type="number"
                  value={e.maxTokens}
                  onChange={(ev) =>
                    setEdits((prev) => ({
                      ...prev,
                      [r.id]: {
                        ...prev[r.id],
                        maxTokens: parseInt(ev.target.value || "0", 10),
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">プロンプト本文（Systemプロンプト）</label>
              <textarea
                className="w-full h-40 rounded-md border p-2 text-sm font-mono"
                value={e.promptBody}
                onChange={(ev) =>
                  setEdits((prev) => ({
                    ...prev,
                    [r.id]: { ...prev[r.id], promptBody: ev.target.value },
                  }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleSave(r.id)}
                disabled={!changed || busyId === r.id}
              >
                {busyId === r.id ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : null}
                保存
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
