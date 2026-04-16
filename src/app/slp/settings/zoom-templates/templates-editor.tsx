"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateZoomMessageTemplate } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type TemplateRow = {
  id: number;
  templateKey: string;
  category: string;
  trigger: string;
  label: string;
  body: string;
  isActive: boolean;
  updatedAt: Date;
  updatedBy: { name: string } | null;
};

export function TemplatesEditor({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, { body: string; isActive: boolean }>>(
    Object.fromEntries(rows.map((r) => [r.id, { body: r.body, isActive: r.isActive }]))
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleSave = async (id: number) => {
    setBusyId(id);
    try {
      const r = await updateZoomMessageTemplate(
        id,
        edits[id].body,
        edits[id].isActive
      );
      if (r.ok) {
        toast.success("テンプレートを保存しました");
        router.refresh();
      } else {
        toast.error(r.message);
      }
    } finally {
      setBusyId(null);
    }
  };

  const grouped: Record<string, TemplateRow[]> = {};
  for (const r of rows) {
    const key = r.category === "briefing" ? "概要案内" : "導入希望商談";
    (grouped[key] ||= []).push(r);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-blue-50/50 p-4 text-sm space-y-2">
        <div className="font-semibold">利用可能な変数（{"{{...}}"} で本文内に挿入可）</div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <li><code className="bg-white px-1 rounded">{"{{事業者名}}"}</code> — 企業名</li>
          <li><code className="bg-white px-1 rounded">{"{{商談種別}}"}</code> — 概要案内 or 導入希望商談</li>
          <li><code className="bg-white px-1 rounded">{"{{日時}}"}</code> — 予約日時（JST）</li>
          <li><code className="bg-white px-1 rounded">{"{{担当者}}"}</code> — 担当スタッフ名</li>
          <li><code className="bg-white px-1 rounded">{"{{url}}"}</code> — Zoom参加URL</li>
        </ul>
      </div>

      {Object.entries(grouped).map(([groupName, groupRows]) => (
        <section key={groupName} className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-1">{groupName}</h2>
          {groupRows.map((r) => {
            const e = edits[r.id];
            const changed = e.body !== r.body || e.isActive !== r.isActive;
            return (
              <div key={r.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-xs text-muted-foreground">
                      key: <code>{r.templateKey}</code>
                      {r.updatedBy && (
                        <>  ・ 最終更新: {r.updatedBy.name}（{new Intl.DateTimeFormat("ja-JP").format(new Date(r.updatedAt))}）</>
                      )}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={e.isActive}
                      onChange={(ev) =>
                        setEdits((prev) => ({
                          ...prev,
                          [r.id]: { ...prev[r.id], isActive: ev.target.checked },
                        }))
                      }
                    />
                    有効
                  </label>
                </div>
                <textarea
                  className="w-full h-32 rounded-md border p-2 text-sm font-mono"
                  value={e.body}
                  onChange={(ev) =>
                    setEdits((prev) => ({
                      ...prev,
                      [r.id]: { ...prev[r.id], body: ev.target.value },
                    }))
                  }
                />
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
        </section>
      ))}
    </div>
  );
}
