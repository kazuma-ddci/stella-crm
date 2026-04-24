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
import { MultiFileUpload, type FileInfo } from "@/components/multi-file-upload";
import { getMeetingStateBadge, getProviderLabel } from "@/lib/contact-history-v2/types";
import type {
  ContactHistoryV2Input,
  CustomerParticipantInput,
  MeetingInput,
  FileInput,
  CreateContactHistoryV2Action,
  UpdateContactHistoryV2Action,
} from "@/lib/contact-history-v2/input-types";

/**
 * 接触履歴 V2 作成/編集フォーム (プロジェクト横断共通コンポーネント)。
 *
 * 各プロジェクト (SLP / HOJO / STP) は本コンポーネントを薄くラップし、
 * プロジェクト固有の設定 (targetType一覧・顧客マスタ・server action 等) を
 * props で渡すことで使用する。
 *
 * 旧実装:
 *   src/app/slp/records/contact-histories-v2/contact-history-form.tsx
 *   src/app/hojo/records/contact-histories-v2/contact-history-form.tsx
 *   src/app/stp/records/contact-histories-v2/contact-history-form.tsx
 * → 3ファイルがほぼ重複していたため、本ファイルに統合。
 */

// ============================================================================
// 型定義
// ============================================================================

export type Option = { value: string; label: string };

/** フォームが必要とする共通マスタデータ */
export type SharedFormMasters = {
  contactMethods: Option[];
  contactCategories: Option[];
  /** 該当プロジェクト所属スタッフ (優先表示) */
  projectStaffOptions: Option[];
  /** 他プロジェクトのスタッフ (折りたたみ表示) */
  otherStaffOptions: Option[];
};

/** targetType と、その選択肢のメタ情報 */
export type TargetTypeSpec = {
  value: string;
  label: string;
  /** targetId の選択を必要とするか (その他系は false) */
  requiresTargetId: boolean;
  /** targetId の選択肢 (requiresTargetId=true 時に使用) */
  idOptions: Option[];
};

/** フォームの初期値 (編集時 or プリセット用) */
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
  files?: FileInfo[];
};

/** 編集画面に読み取り専用で表示する既存会議 */
export type ExistingMeetingInfo = {
  id: number;
  provider: string;
  label: string | null;
  isPrimary: boolean;
  state: string;
  joinUrl: string | null;
  hostStaffName: string | null;
  hasRecord: boolean;
  hasAiSummary: boolean;
};

type Props = {
  mode: "create" | "edit";
  /** プロジェクト表示名 (例: "SLP" / "HOJO" / "STP") - ラベル/メッセージに使用 */
  projectName: string;
  /** 作成/編集/詳細のベースパス (例: "/slp/records/contact-histories-v2") */
  basePath: string;
  masters: SharedFormMasters;
  targetTypeSpecs: TargetTypeSpec[];
  /** 初期値がないときの 1件目顧客のデフォルト targetType */
  defaultTargetType: string;
  initial?: ContactHistoryFormInitial;
  existingMeetings?: ExistingMeetingInfo[];
  /** 新規作成アクション (プロジェクト別 server action) */
  onCreate: CreateContactHistoryV2Action;
  /** 更新アクション (プロジェクト別 server action) */
  onUpdate: UpdateContactHistoryV2Action;
};

type CustomerFormRow = {
  targetType: string;
  targetId: string; // "" or string numeric
  attendees: Array<{ name: string; title: string }>;
};

type MeetingFormRow = {
  provider: "zoom" | "google_meet" | "teams" | "other";
  joinUrl: string;
  hostStaffId: string; // "" or numeric
  label: string; // 2件目以降の会議を区別するためのラベル (任意)
};

const STATUS_OPTIONS = [
  { value: "scheduled", label: "予定" },
  { value: "completed", label: "実施済" },
  { value: "cancelled", label: "キャンセル" },
  { value: "rescheduled", label: "リスケ" },
];

const PROVIDER_OPTIONS: Array<{ value: MeetingFormRow["provider"]; label: string }> = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "teams", label: "Teams" },
  { value: "other", label: "その他" },
];

// ============================================================================
// ヘルパー
// ============================================================================

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialCustomers(
  initial: ContactHistoryFormInitial | undefined,
  defaultTargetType: string,
): CustomerFormRow[] {
  if (initial?.customers && initial.customers.length > 0) {
    return initial.customers.map((c) => ({
      targetType: c.targetType,
      targetId: c.targetId !== null ? String(c.targetId) : "",
      attendees: c.attendees.map((a) => ({ name: a.name, title: a.title ?? "" })),
    }));
  }
  return [{ targetType: defaultTargetType, targetId: "", attendees: [] }];
}

// ============================================================================
// メインフォーム
// ============================================================================

export function ContactHistoryV2Form({
  mode,
  projectName,
  basePath,
  masters,
  targetTypeSpecs,
  defaultTargetType,
  initial,
  existingMeetings = [],
  onCreate,
  onUpdate,
}: Props) {
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
    initialCustomers(initial, defaultTargetType),
  );
  const [staffIds, setStaffIds] = useState<number[]>(initial?.staffIds ?? []);
  const [meetingMinutes, setMeetingMinutes] = useState(initial?.meetingMinutes ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [newMeetings, setNewMeetings] = useState<MeetingFormRow[]>([]);
  const [files, setFiles] = useState<FileInfo[]>(initial?.files ?? []);

  // ---- customer ops ----
  const updateCustomer = (idx: number, patch: Partial<CustomerFormRow>) => {
    setCustomers((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };
  const addCustomer = () => {
    setCustomers((prev) => [
      ...prev,
      { targetType: defaultTargetType, targetId: "", attendees: [] },
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

  // ---- meeting ops (新規追加用) ----
  const addMeeting = () => {
    setNewMeetings((prev) => [
      ...prev,
      { provider: "zoom", joinUrl: "", hostStaffId: "", label: "" },
    ]);
  };
  const updateMeeting = (idx: number, patch: Partial<MeetingFormRow>) => {
    setNewMeetings((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  };
  const removeMeeting = (idx: number) => {
    setNewMeetings((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---- staff ops ----
  const handleStaffToggle = (staffId: number) => {
    setStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId],
    );
  };

  const targetIdOptionsFor = (targetType: string): Option[] => {
    const spec = targetTypeSpecs.find((t) => t.value === targetType);
    return spec?.idOptions ?? [];
  };

  const targetTypeRequiresId = (targetType: string): boolean => {
    const spec = targetTypeSpecs.find((t) => t.value === targetType);
    return spec?.requiresTargetId ?? false;
  };

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
    for (const [idx, c] of customers.entries()) {
      if (targetTypeRequiresId(c.targetType) && !c.targetId) {
        toast.error(`${idx + 1}番目の顧客を選択してください`);
        return;
      }
    }

    // 会議: URL or プロバイダ指定があれば送信対象
    const meetingsPayload: MeetingInput[] = newMeetings
      .filter((m) => m.provider && (m.joinUrl || m.provider === "other" || m.label))
      .map((m) => ({
        provider: m.provider,
        label: m.label || null,
        joinUrl: m.joinUrl || null,
        hostStaffId: m.hostStaffId ? parseInt(m.hostStaffId, 10) : null,
      }));

    const filesPayload: FileInput[] = files.map((f) => ({
      id: f.id,
      filePath: f.filePath ?? null,
      fileName: f.fileName,
      fileSize: f.fileSize ?? null,
      mimeType: f.mimeType ?? null,
      url: f.url ?? null,
    }));

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
        targetId: targetTypeRequiresId(c.targetType) && c.targetId
          ? parseInt(c.targetId, 10)
          : null,
        attendees: c.attendees.map((a) => ({
          name: a.name,
          title: a.title || null,
        })),
      })),
      staffIds,
      meetings: meetingsPayload.length > 0 ? meetingsPayload : undefined,
      files: filesPayload.length > 0 ? filesPayload : undefined,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await onCreate(input)
          : await onUpdate(initial!.id!, input);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "create" ? "作成しました" : "更新しました");
      router.push(`${basePath}/${result.data.id}`);
      router.refresh();
    });
  };

  // 参加スタッフ全員の Option (会議ホスト選択用)
  const allStaffOptions = [
    ...masters.projectStaffOptions,
    ...masters.otherStaffOptions,
  ];
  const selectedStaffOptions = allStaffOptions.filter((s) =>
    staffIds.includes(parseInt(s.value, 10)),
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 基本情報 */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
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
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
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
            targetTypeSpecs={targetTypeSpecs}
            targetIdOptions={targetIdOptionsFor(c.targetType)}
            targetTypeRequiresId={targetTypeRequiresId(c.targetType)}
            onChange={(patch) => updateCustomer(idx, patch)}
            onRemove={() => removeCustomer(idx)}
            onAddAttendee={(name, title) => addAttendee(idx, name, title)}
            onRemoveAttendee={(attendeeIdx) => removeAttendee(idx, attendeeIdx)}
          />
        ))}
      </section>

      {/* 弊社スタッフ */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold border-b pb-2">弊社スタッフ</h2>

        <div>
          <Label>{projectName}プロジェクトのスタッフ（複数選択可）</Label>
          {masters.projectStaffOptions.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">所属スタッフがいません</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {masters.projectStaffOptions.map((s) => {
                const id = parseInt(s.value, 10);
                const checked = staffIds.includes(id);
                return (
                  <label
                    key={s.value}
                    className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-2.5 text-sm hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleStaffToggle(id)}
                    />
                    <span className="font-medium">{s.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {masters.otherStaffOptions.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 select-none py-1">
              その他プロジェクトのスタッフを選択（{masters.otherStaffOptions.length}名）
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
              {masters.otherStaffOptions.map((s) => {
                const id = parseInt(s.value, 10);
                const checked = staffIds.includes(id);
                return (
                  <label
                    key={s.value}
                    className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-2.5 text-sm hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors"
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
          </details>
        )}
      </section>

      {/* 会議 (Zoom/Meet等) */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-semibold">オンライン会議</h2>
          <Button type="button" variant="outline" size="sm" onClick={addMeeting}>
            <Plus className="h-4 w-4 mr-1" /> 会議を追加
          </Button>
        </div>

        {/* 既存会議 (編集モード時のみ、読み取り専用) */}
        {existingMeetings.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm text-gray-500">
              既存の会議（このフォームでは編集できません）
            </div>
            {existingMeetings.map((m) => {
              const stateBadge = getMeetingStateBadge(m.state);
              return (
                <div
                  key={m.id}
                  className="rounded border bg-gray-50 p-3 flex flex-wrap items-center gap-2 text-sm"
                >
                  <Badge>{getProviderLabel(m.provider)}</Badge>
                  <Badge
                    variant="outline"
                    className={stateBadge.className}
                    title={stateBadge.description}
                  >
                    {stateBadge.label}
                  </Badge>
                  {m.label && <span className="text-gray-500">（{m.label}）</span>}
                  {m.isPrimary && <Badge variant="outline">主会議</Badge>}
                  {m.hasRecord && <Badge variant="secondary">記録あり</Badge>}
                  {m.hasAiSummary && <Badge variant="secondary">AI要約</Badge>}
                  {m.hostStaffName && (
                    <span className="text-gray-500">ホスト: {m.hostStaffName}</span>
                  )}
                  {m.joinUrl && (
                    <a
                      href={m.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate max-w-xs"
                    >
                      URL
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 新規追加する会議 */}
        {newMeetings.length > 0 && (
          <div className="space-y-3">
            {existingMeetings.length > 0 && (
              <div className="text-sm text-gray-500">追加する会議</div>
            )}
            {newMeetings.map((m, idx) => (
              <MeetingSection
                key={idx}
                index={idx}
                meeting={m}
                staffOptions={selectedStaffOptions}
                onChange={(patch) => updateMeeting(idx, patch)}
                onRemove={() => removeMeeting(idx)}
              />
            ))}
          </div>
        )}

        {newMeetings.length === 0 && existingMeetings.length === 0 && (
          <p className="text-sm text-gray-400">
            オンライン会議が登録されていません。「会議を追加」ボタンから追加できます。
          </p>
        )}
      </section>

      {/* 議事録 / メモ */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
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

      {/* 添付ファイル */}
      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold border-b pb-2">添付ファイル</h2>
        <MultiFileUpload
          value={files}
          onChange={setFiles}
          entityId={initial?.id}
          entityIdKey="contactHistoryId"
          uploadUrl="/api/contact-histories/upload"
          disabled={pending}
          allowUrl={true}
        />
        <p className="text-xs text-gray-500">
          最大10MBまで。PDF/Word/Excel/画像/テキストに対応。Googleドライブ等の外部URLも追加可能。
        </p>
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

// ============================================================================
// 顧客セクション (1顧客単位)
// ============================================================================

function CustomerSection({
  index,
  customer,
  canRemove,
  targetTypeSpecs,
  targetIdOptions,
  targetTypeRequiresId,
  onChange,
  onRemove,
  onAddAttendee,
  onRemoveAttendee,
}: {
  index: number;
  customer: CustomerFormRow;
  canRemove: boolean;
  targetTypeSpecs: TargetTypeSpec[];
  targetIdOptions: Option[];
  targetTypeRequiresId: boolean;
  onChange: (patch: Partial<CustomerFormRow>) => void;
  onRemove: () => void;
  onAddAttendee: (name: string, title: string) => void;
  onRemoveAttendee: (attendeeIdx: number) => void;
}) {
  const [nameInput, setNameInput] = useState("");
  const [titleInput, setTitleInput] = useState("");

  const handleAttendeeAdd = () => {
    onAddAttendee(nameInput, titleInput);
    setNameInput("");
    setTitleInput("");
  };

  const preventEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-gray-700">顧客 #{index + 1}</div>
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
            onValueChange={(v) => onChange({ targetType: v, targetId: "" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {targetTypeSpecs.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {targetTypeRequiresId && (
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
        {/* 入力行 (先頭固定、「追加」ボタンで追加) */}
        <div className="mt-2 flex gap-2 rounded-md border border-gray-200 bg-white p-3">
          <Input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={preventEnterSubmit}
            placeholder="氏名"
            className="flex-1 bg-white"
          />
          <Input
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={preventEnterSubmit}
            placeholder="役職（任意）"
            className="flex-1 bg-white"
          />
          <Button
            type="button"
            onClick={handleAttendeeAdd}
            disabled={!nameInput.trim()}
          >
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        </div>
        {/* 追加された参加者リスト */}
        {customer.attendees.length > 0 ? (
          <div className="mt-3 space-y-2">
            {customer.attendees.map((a, aIdx) => (
              <div
                key={aIdx}
                className="flex items-center gap-3 rounded-md border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{a.name}</div>
                  {a.title && (
                    <div className="mt-0.5 text-sm text-gray-500">{a.title}</div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveAttendee(aIdx)}
                  aria-label="参加者を削除"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">
            （まだ登録されていません）
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 会議セクション (新規追加用、1会議単位)
// ============================================================================

function MeetingSection({
  index,
  meeting,
  staffOptions,
  onChange,
  onRemove,
}: {
  index: number;
  meeting: MeetingFormRow;
  staffOptions: Option[];
  onChange: (patch: Partial<MeetingFormRow>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-gray-700">新規会議 #{index + 1}</div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div>
        <Label>プロバイダ *</Label>
        <Select
          value={meeting.provider}
          onValueChange={(v) =>
            onChange({ provider: v as MeetingFormRow["provider"] })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>URL</Label>
        <Input
          value={meeting.joinUrl}
          onChange={(e) => onChange({ joinUrl: e.target.value })}
          placeholder="https://..."
        />
        <p className="mt-1 text-xs text-gray-500">
          参加URL。手動入力 or 将来のAPI自動生成で埋まる (Phase 4)。
        </p>
      </div>

      <div>
        <Label>ホスト（参加スタッフから選択）</Label>
        {staffOptions.length === 0 ? (
          <p className="text-xs text-gray-500 mt-1">
            先に「弊社スタッフ」セクションで参加者を選んでください
          </p>
        ) : (
          <Select
            value={meeting.hostStaffId || "none"}
            onValueChange={(v) => onChange({ hostStaffId: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="未指定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未指定</SelectItem>
              {staffOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div>
        <Label>ラベル</Label>
        <Input
          value={meeting.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="通常は空欄 (例: 延長分 / 再実施)"
        />
        <p className="mt-1 text-xs text-gray-500">
          同じ接触履歴に複数の会議を追加する場合の区別用 (Zoom 途中切断での再リンク等)。
        </p>
      </div>
    </div>
  );
}
