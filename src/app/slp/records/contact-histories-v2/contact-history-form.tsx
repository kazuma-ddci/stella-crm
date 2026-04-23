"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import {
  createContactHistoryV2,
  updateContactHistoryV2,
  type ContactHistoryV2Input,
  type CustomerParticipantInput,
} from "./actions";
import type { SlpContactHistoryV2Masters } from "./load-masters";

export type ContactHistoryFormInitial = {
  id?: number;
  title?: string | null;
  status?: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
  contactMethodId?: number | null;
  contactCategoryId?: number | null;
  meetingMinutes?: string | null;
  note?: string | null;
  customers?: Array<{
    targetType: string;
    targetId: number | null;
    attendees: Array<{ name: string; title: string | null }>;
  }>;
  staffIds?: number[];
  hostStaffId?: number | null;
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

type CustomerFormRow = {
  targetType: TargetType;
  targetId: string; // "" or string numeric
  attendees: Array<{ name: string; title: string }>;
};

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialCustomers(initial: ContactHistoryFormInitial | undefined): CustomerFormRow[] {
  if (initial?.customers && initial.customers.length > 0) {
    return initial.customers.map((c) => ({
      targetType: c.targetType as TargetType,
      targetId: c.targetId !== null ? String(c.targetId) : "",
      attendees: c.attendees.map((a) => ({ name: a.name, title: a.title ?? "" })),
    }));
  }
  return [{ targetType: "slp_company_record", targetId: "", attendees: [] }];
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
  const [customers, setCustomers] = useState<CustomerFormRow[]>(() =>
    initialCustomers(initial),
  );
  const [staffIds, setStaffIds] = useState<number[]>(initial?.staffIds ?? []);
  const [hostStaffId, setHostStaffId] = useState<string>(
    initial?.hostStaffId ? String(initial.hostStaffId) : "",
  );
  const [meetingMinutes, setMeetingMinutes] = useState(initial?.meetingMinutes ?? "");
  const [note, setNote] = useState(initial?.note ?? "");

  // ---- customer ops ----
  const updateCustomer = (idx: number, patch: Partial<CustomerFormRow>) => {
    setCustomers((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const addCustomer = () => {
    setCustomers((prev) => [
      ...prev,
      { targetType: "slp_company_record", targetId: "", attendees: [] },
    ]);
  };
  const removeCustomer = (idx: number) => {
    setCustomers((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- attendee ops ----
  const addAttendee = (customerIdx: number, name: string, title: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomers((prev) =>
      prev.map((c, i) =>
        i === customerIdx
          ? { ...c, attendees: [...c.attendees, { name: trimmed, title: title.trim() }] }
          : c,
      ),
    );
  };
  const removeAttendee = (customerIdx: number, attendeeIdx: number) => {
    setCustomers((prev) =>
      prev.map((c, i) =>
        i === customerIdx
          ? { ...c, attendees: c.attendees.filter((_, j) => j !== attendeeIdx) }
          : c,
      ),
    );
  };

  // ---- staff ops ----
  const handleStaffToggle = (staffId: number) => {
    setStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  };

  const getTargetIdOptions = (targetType: TargetType) =>
    targetType === "slp_company_record"
      ? masters.companyRecords
      : targetType === "slp_agency"
        ? masters.agencies
        : targetType === "slp_line_friend"
          ? masters.lineFriends
          : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduledStartAt) {
      toast.error("予定開始日時を入力してください");
      return;
    }
    if (customers.length === 0) {
      toast.error("顧客を1件以上設定してください");
      return;
    }
    // targetId必須チェック (slp_other以外)
    for (const [idx, c] of customers.entries()) {
      if (c.targetType !== "slp_other" && !c.targetId) {
        toast.error(`${idx + 1}番目の顧客を選択してください`);
        return;
      }
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
      customers: customers.map<CustomerParticipantInput>((c) => ({
        targetType: c.targetType,
        targetId: c.targetType !== "slp_other" && c.targetId
          ? parseInt(c.targetId, 10)
          : null,
        attendees: c.attendees.map((a) => ({
          name: a.name,
          title: a.title || null,
        })),
      })),
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

      {/* 顧客 (複数対応) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-semibold">顧客</h2>
          <Button type="button" variant="outline" size="sm" onClick={addCustomer}>
            <Plus className="h-4 w-4 mr-1" /> 顧客を追加
          </Button>
        </div>
        {customers.map((c, idx) => (
          <CustomerSection
            key={idx}
            index={idx}
            customer={c}
            canRemove={customers.length > 1}
            targetIdOptions={getTargetIdOptions(c.targetType)}
            onChange={(patch) => updateCustomer(idx, patch)}
            onRemove={() => removeCustomer(idx)}
            onAddAttendee={(name, title) => addAttendee(idx, name, title)}
            onRemoveAttendee={(attendeeIdx) => removeAttendee(idx, attendeeIdx)}
          />
        ))}
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

/**
 * 顧客セクション (1顧客単位)
 * - 顧客種別・顧客選択 + 先方参加者のタグ編集UI
 */
function CustomerSection({
  index,
  customer,
  canRemove,
  targetIdOptions,
  onChange,
  onRemove,
  onAddAttendee,
  onRemoveAttendee,
}: {
  index: number;
  customer: CustomerFormRow;
  canRemove: boolean;
  targetIdOptions: { value: string; label: string }[];
  onChange: (patch: Partial<CustomerFormRow>) => void;
  onRemove: () => void;
  onAddAttendee: (name: string, title: string) => void;
  onRemoveAttendee: (attendeeIdx: number) => void;
}) {
  const [nameInput, setNameInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const needsTargetId = customer.targetType !== "slp_other";

  const handleAttendeeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onAddAttendee(nameInput, titleInput);
      setNameInput("");
      setTitleInput("");
    }
  };

  const handleAttendeeAdd = () => {
    onAddAttendee(nameInput, titleInput);
    setNameInput("");
    setTitleInput("");
  };

  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-gray-700">
          顧客 #{index + 1}
          {index === 0 && <Badge className="ml-2">主顧客</Badge>}
        </div>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>顧客種別 *</Label>
          <Select
            value={customer.targetType}
            onValueChange={(v) =>
              onChange({ targetType: v as TargetType, targetId: "" })
            }
          >
            <SelectTrigger>
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
            <Label>顧客名 *</Label>
            <Select
              value={customer.targetId}
              onValueChange={(v) => onChange({ targetId: v })}
            >
              <SelectTrigger>
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

      <div>
        <Label>先方参加者</Label>
        <div className="mt-2 flex flex-wrap gap-1 min-h-[32px]">
          {customer.attendees.map((a, aIdx) => (
            <Badge key={aIdx} variant="secondary" className="gap-1 pr-1">
              <span>
                {a.name}
                {a.title && <span className="ml-1 text-gray-500">（{a.title}）</span>}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttendee(aIdx)}
                className="hover:bg-gray-300 rounded p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {customer.attendees.length === 0 && (
            <span className="text-xs text-gray-400 py-1">
              （まだ登録されていません）
            </span>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={handleAttendeeKeyDown}
            placeholder="氏名"
            className="flex-1"
          />
          <Input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={handleAttendeeKeyDown}
            placeholder="役職（任意）"
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAttendeeAdd}
            disabled={!nameInput.trim()}
          >
            追加
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          氏名を入力して Enter または「追加」ボタン
        </p>
      </div>
    </div>
  );
}
