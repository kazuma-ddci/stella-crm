"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { updateNotificationTemplate } from "./actions";
import { useRouter } from "next/navigation";
import { Loader2, Info, ChevronDown } from "lucide-react";

type TemplateRow = {
  id: number;
  recipient: string; // "customer" | "referrer"
  category: string; // "briefing" | "consultation"
  roundType: string | null; // "first" | "continuous" | null
  source: string | null; // "proline" | "manual" | null
  trigger: string;
  formId: string;
  label: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: { name: string } | null;
};

const TRIGGER_ORDER = [
  "confirm",
  "change",
  "cancel",
  "complete",
  "no_show",
  "remind_day_before",
  "remind_hour_before",
  "confirm_no_url",
  "change_no_url",
  "regenerated_manual_notice",
];

const TRIGGER_LABELS: Record<string, string> = {
  confirm: "予約確定",
  change: "予約変更",
  cancel: "キャンセル",
  complete: "完了お礼",
  no_show: "不参加通知",
  remind_day_before: "リマインド（前日）",
  remind_hour_before: "リマインド（1時間前）",
  confirm_no_url: "予約確定（URLなし）",
  change_no_url: "予約変更（URLなし）",
  regenerated_manual_notice: "Zoom再発行のお知らせ",
};

const ROUND_TYPE_LABELS: Record<string, string> = {
  first: "初回",
  continuous: "2回目以降",
};

const SOURCE_LABELS: Record<string, string> = {
  proline: "プロライン経由",
  manual: "手動セット",
};

function groupKey(r: TemplateRow): string {
  return `${r.roundType ?? "_"}|${r.source ?? "_"}`;
}

function groupTitle(r: TemplateRow): string {
  const parts: string[] = [];
  if (r.roundType) parts.push(ROUND_TYPE_LABELS[r.roundType] ?? r.roundType);
  if (r.source) parts.push(SOURCE_LABELS[r.source] ?? r.source);
  if (parts.length === 0) return "共通";
  return parts.join(" × ");
}

function sortByTrigger(a: TemplateRow, b: TemplateRow): number {
  return TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger);
}

interface TemplateCardProps {
  row: TemplateRow;
  edit: { body: string; isActive: boolean };
  onEditChange: (id: number, patch: Partial<{ body: string; isActive: boolean }>) => void;
  busy: boolean;
  onSave: (id: number) => void;
}

function TemplateCard({ row, edit, onEditChange, busy, onSave }: TemplateCardProps) {
  const changed = edit.body !== row.body || edit.isActive !== row.isActive;
  const triggerLabel = TRIGGER_LABELS[row.trigger] ?? row.trigger;

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{triggerLabel}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.label} / {row.formId}
            {row.updatedBy && (
              <> ・ 最終更新: {row.updatedBy.name} ({new Intl.DateTimeFormat("ja-JP").format(new Date(row.updatedAt))})</>
            )}
          </div>
        </div>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={edit.isActive}
            onChange={(ev) => onEditChange(row.id, { isActive: ev.target.checked })}
          />
          有効
        </label>
      </div>
      <Textarea
        value={edit.body}
        onChange={(ev) => onEditChange(row.id, { body: ev.target.value })}
        className="font-mono text-xs"
        rows={6}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => onSave(row.id)} disabled={!changed || busy}>
          {busy && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
          保存
        </Button>
      </div>
    </div>
  );
}

export function TemplatesEditor({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<number, { body: string; isActive: boolean }>>(
    () => Object.fromEntries(rows.map((r) => [r.id, { body: r.body, isActive: r.isActive }]))
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const handleEditChange = (
    id: number,
    patch: Partial<{ body: string; isActive: boolean }>
  ) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (id: number) => {
    setBusyId(id);
    try {
      const r = await updateNotificationTemplate({
        id,
        body: edits[id].body,
        isActive: edits[id].isActive,
      });
      if (r.ok) {
        toast.success("テンプレートを保存しました");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    } finally {
      setBusyId(null);
    }
  };

  // タブ: お客様-概要案内、お客様-導入希望商談、紹介者
  const tabs = useMemo(() => {
    const customerBriefing = rows.filter(
      (r) => r.recipient === "customer" && r.category === "briefing"
    );
    const customerConsultation = rows.filter(
      (r) => r.recipient === "customer" && r.category === "consultation"
    );
    const referrer = rows.filter((r) => r.recipient === "referrer");
    return { customerBriefing, customerConsultation, referrer };
  }, [rows]);

  const renderGrouped = (list: TemplateRow[]) => {
    // roundType × source でグループ化
    const groups = new Map<string, TemplateRow[]>();
    for (const r of list) {
      const k = groupKey(r);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    // グループをソート（first→continuous / proline→manual / null最後）
    const order = ["first|proline", "first|manual", "continuous|proline", "continuous|manual", "_|_"];
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

    return (
      <div className="space-y-2">
        {sortedKeys.map((k) => {
          const groupRows = groups.get(k)!.sort(sortByTrigger);
          const title = groupTitle(groupRows[0]);
          return (
            <details key={k} open className="group border rounded-lg">
              <summary className="px-4 py-3 cursor-pointer select-none flex items-center gap-2 hover:bg-muted/30">
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-0 -rotate-90" />
                <span className="font-semibold text-sm">{title}</span>
                <span className="text-xs text-muted-foreground">({groupRows.length}件)</span>
              </summary>
              <div className="px-4 pb-4 pt-1 space-y-3">
                {groupRows.map((r) => (
                  <TemplateCard
                    key={r.id}
                    row={r}
                    edit={edits[r.id]}
                    onEditChange={handleEditChange}
                    busy={busyId === r.id}
                    onSave={handleSave}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-blue-50/50 p-3 text-sm space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          利用可能な変数（本文中に書くと送信時に置換）
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs">
          <li><code className="bg-white px-1 rounded">{"{{companyName}}"}</code> 事業者名</li>
          <li><code className="bg-white px-1 rounded">{"{{scheduledAt}}"}</code> 商談日時</li>
          <li><code className="bg-white px-1 rounded">{"{{staffName}}"}</code> 担当者名</li>
          <li><code className="bg-white px-1 rounded">{"{{zoomUrl}}"}</code> Zoom URL</li>
          <li><code className="bg-white px-1 rounded">{"{{referrerName}}"}</code> 紹介者名</li>
          <li><code className="bg-white px-1 rounded">{"{{roundNumber}}"}</code> ラウンド番号</li>
        </ul>
      </div>

      <Tabs defaultValue="customer_briefing" className="w-full">
        <TabsList>
          <TabsTrigger value="customer_briefing">
            お客様 / 概要案内 ({tabs.customerBriefing.length})
          </TabsTrigger>
          <TabsTrigger value="customer_consultation">
            お客様 / 導入希望商談 ({tabs.customerConsultation.length})
          </TabsTrigger>
          <TabsTrigger value="referrer">
            紹介者向け ({tabs.referrer.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="customer_briefing" className="pt-4">
          {renderGrouped(tabs.customerBriefing)}
        </TabsContent>
        <TabsContent value="customer_consultation" className="pt-4">
          {renderGrouped(tabs.customerConsultation)}
        </TabsContent>
        <TabsContent value="referrer" className="pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">
            紹介者通知は概要案内1回目のみ送信されます（手動セット時は「紹介者にも通知を送信する」チェックON時のみ）。
          </Label>
          {renderGrouped(tabs.referrer)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
