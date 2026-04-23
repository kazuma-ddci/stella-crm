"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createContactHistoryV2,
  updateContactHistoryV2,
  type ContactHistoryV2Input,
} from "./actions";
import type { SlpContactHistoryV2Masters } from "./load-masters";

export type ContactHistoryFormInitial = Partial<
  Omit<ContactHistoryV2Input, "staffIds"> & { staffIds: number[] }
> & {
  id?: number;
};

type Props = {
  mode: "create" | "edit";
  masters: SlpContactHistoryV2Masters;
  initial?: ContactHistoryFormInitial;
};

type TargetType =
  | "slp_company_record"
  | "slp_agency"
  | "slp_line_friend"
  | "slp_other";

const TARGET_TYPE_OPTIONS: { value: TargetType; label: string }[] = [
  { value: "slp_company_record", label: "事業者" },
  { value: "slp_agency", label: "代理店" },
  { value: "slp_line_friend", label: "LINE友達" },
  { value: "slp_other", label: "その他" },
];

const STATUS_OPTIONS = [
  { value: "scheduled", label: "予定" },
  { value: "completed", label: "実施済" },
  { value: "cancelled", label: "キャンセル" },
  { value: "rescheduled", label: "リスケ" },
];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  // datetime-local の value は秒以下を含まないローカル時刻 "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContactHistoryV2Form({ mode, masters, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState(initial?.status ?? "scheduled");
  const [scheduledStartAt, setScheduledStartAt] = useState(
    toDatetimeLocal(initial?.scheduledStartAt),
  );
  const [scheduledEndAt, setScheduledEndAt] = useState(
    toDatetimeLocal(initial?.scheduledEndAt),
  );
  const [contactMethodId, setContactMethodId] = useState<string>(
    initial?.contactMethodId ? String(initial.contactMethodId) : "",
  );
  const [contactCategoryId, setContactCategoryId] = useState<string>(
    initial?.contactCategoryId ? String(initial.contactCategoryId) : "",
  );
  const [targetType, setTargetType] = useState<TargetType>(
    (initial?.targetType as TargetType) ?? "slp_company_record",
  );
  const [targetId, setTargetId] = useState<string>(
    initial?.targetId ? String(initial.targetId) : "",
  );
  const [staffIds, setStaffIds] = useState<number[]>(initial?.staffIds ?? []);
  const [hostStaffId, setHostStaffId] = useState<string>(
    initial?.hostStaffId ? String(initial.hostStaffId) : "",
  );
  const [meetingMinutes, setMeetingMinutes] = useState(initial?.meetingMinutes ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  const needsTargetId = targetType !== "slp_other";
  const targetIdOptions =
    targetType === "slp_company_record"
      ? masters.companyRecords
      : targetType === "slp_agency"
        ? masters.agencies
        : targetType === "slp_line_friend"
          ? masters.lineFriends
          : [];

  const handleStaffToggle = (staffId: number) => {
    setStaffIds((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduledStartAt) {
      toast.error("予定開始日時を入力してください");
      return;
    }
    if (needsTargetId && !targetId) {
      toast.error("顧客を選択してください");
      return;
    }

    const input: ContactHistoryV2Input = {
      title: title || null,
      status,
      scheduledStartAt: new Date(scheduledStartAt).toISOString(),
      scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt).toISOString() : null,
      contactMethodId: contactMethodId ? parseInt(contactMethodId, 10) : null,
      contactCategoryId: contactCategoryId ? parseInt(contactCategoryId, 10) : null,
      meetingMinutes: meetingMinutes || null,
      note: note || null,
      targetType,
      targetId: needsTargetId && targetId ? parseInt(targetId, 10) : null,
      staffIds,
      hostStaffId: hostStaffId ? parseInt(hostStaffId, 10) : null,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createContactHistoryV2(input)
          : await updateContactHistoryV2(initial!.id!, input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "作成しました" : "更新しました");
      router.push(`/slp/records/contact-histories-v2/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 基本情報 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">基本情報</h2>

        <div>
          <Label htmlFor="title">タイトル</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: A社 概要案内"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">ステータス *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start">予定開始日時 *</Label>
            <Input
              id="start"
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="end">予定終了日時</Label>
            <Input
              id="end"
              type="datetime-local"
              value={scheduledEndAt}
              onChange={(e) => setScheduledEndAt(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="method">接触方法</Label>
            <Select
              value={contactMethodId || "none"}
              onValueChange={(v) => setContactMethodId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="method">
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未選択</SelectItem>
                {masters.contactMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="category">接触種別</Label>
            <Select
              value={contactCategoryId || "none"}
              onValueChange={(v) => setContactCategoryId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="未選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未選択</SelectItem>
                {masters.contactCategories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 顧客 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">顧客</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="target-type">顧客種別 *</Label>
            <Select
              value={targetType}
              onValueChange={(v) => {
                setTargetType(v as TargetType);
                setTargetId("");
              }}
            >
              <SelectTrigger id="target-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsTargetId && (
            <div>
              <Label htmlFor="target-id">顧客名 *</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger id="target-id">
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {targetIdOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </section>

      {/* 弊社スタッフ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">弊社スタッフ</h2>
        <div>
          <Label>参加スタッフ（複数選択可）</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {masters.staffOptions.map((s) => {
              const id = parseInt(s.value, 10);
              const checked = staffIds.includes(id);
              return (
                <label
                  key={s.value}
                  className="flex items-center gap-2 rounded border p-2 text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleStaffToggle(id)}
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        </div>

        {staffIds.length > 0 && (
          <div className="max-w-sm">
            <Label htmlFor="host">ホスト（Zoom/Meet主催者）</Label>
            <Select
              value={hostStaffId || "none"}
              onValueChange={(v) => setHostStaffId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="host">
                <SelectValue placeholder="未指定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未指定</SelectItem>
                {staffIds.map((id) => {
                  const opt = masters.staffOptions.find((s) => s.value === String(id));
                  return (
                    <SelectItem key={id} value={String(id)}>
                      {opt?.label ?? `スタッフ#${id}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      {/* 議事録 / メモ */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">議事録・メモ</h2>
        <div>
          <Label htmlFor="minutes">議事録</Label>
          <Textarea
            id="minutes"
            value={meetingMinutes}
            onChange={(e) => setMeetingMinutes(e.target.value)}
            rows={8}
          />
        </div>
        <div>
          <Label htmlFor="note">メモ</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
          />
        </div>
      </section>

      {/* アクション */}
      <div className="flex gap-2 pt-4 border-t">
        <Button type="submit" disabled={pending}>
          {pending ? "保存中..." : mode === "create" ? "作成" : "更新"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}
