"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import { MultiFileUpload, type FileInfo } from "@/components/multi-file-upload";
import {
  addSlpLineUsersContactHistory,
  updateSlpContactHistory,
} from "@/app/slp/contact-histories/actions";

registerLocale("ja", ja);

type LineFriendOption = { id: number; label: string };

type EditTarget = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactCategoryId: number | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  targetType: "company_record" | "agency" | "line_users" | string;
  customerTypeIds: number[];
  companyRecordId?: number | null;
  companyRecordName?: string | null;
  agencyId?: number | null;
  agencyName?: string | null;
  lineFriends: { id: number; snsname: string | null; uid: string }[];
  files?: FileInfo[];
} | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineFriendOptions: LineFriendOption[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  contactCategories: ContactCategoryOption[];
  editTarget: EditTarget;
};

type TargetChoice = "company_record" | "agency" | "line_users";

export function LineUsersContactFormModal({
  open,
  onOpenChange,
  lineFriendOptions,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  contactCategories,
  editTarget,
}: Props) {
  const router = useRouter();
  const isEdit = !!editTarget;
  const [target, setTarget] = useState<TargetChoice>("line_users");
  const [contactDate, setContactDate] = useState<Date | null>(null);
  const [contactMethodId, setContactMethodId] = useState<string>("none");
  const [contactCategoryId, setContactCategoryId] = useState<string>("none");
  const [lineFriendIds, setLineFriendIds] = useState<number[]>([]);
  const [lineFriendPopoverOpen, setLineFriendPopoverOpen] = useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [customerParticipants, setCustomerParticipants] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [note, setNote] = useState("");
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [customerTypeIds, setCustomerTypeIds] = useState<number[]>([]);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setTarget("line_users");
        setContactDate(new Date(editTarget.contactDate));
        setContactMethodId(
          editTarget.contactMethodId ? String(editTarget.contactMethodId) : "none"
        );
        setContactCategoryId(
          editTarget.contactCategoryId ? String(editTarget.contactCategoryId) : "none"
        );
        setLineFriendIds(editTarget.lineFriends.map((lf) => lf.id));
        setCustomerParticipants(editTarget.customerParticipants ?? "");
        setMeetingMinutes(editTarget.meetingMinutes ?? "");
        setNote(editTarget.note ?? "");
        setAssignedTo(
          (editTarget.assignedTo ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        );
        setCustomerTypeIds(editTarget.customerTypeIds);
        setFiles(editTarget.files ?? []);
      } else {
        setTarget("line_users");
        setContactDate(new Date());
        setContactMethodId("none");
        setContactCategoryId("none");
        setLineFriendIds([]);
        setCustomerParticipants("");
        setMeetingMinutes("");
        setNote("");
        setAssignedTo([]);
        setCustomerTypeIds([]);
        setFiles([]);
      }
    }
  }, [open, editTarget]);

  const toggleLineFriend = (id: number) => {
    setLineFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const removeLineFriend = (id: number) =>
    setLineFriendIds((prev) => prev.filter((x) => x !== id));

  const toggleCustomerType = (id: number) =>
    setCustomerTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleAssignedStaff = (value: string) =>
    setAssignedTo((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );

  const handleSubmit = async () => {
    if (!contactDate) {
      toast.error("接触日時を入力してください");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        contactDate: contactDate.toISOString(),
        contactMethodId: contactMethodId !== "none" ? Number(contactMethodId) : null,
        contactCategoryId: contactCategoryId !== "none" ? Number(contactCategoryId) : null,
        assignedTo: assignedTo.join(",") || null,
        customerParticipants: customerParticipants || null,
        meetingMinutes: meetingMinutes || null,
        note: note || null,
        customerTypeIds,
        lineFriendIds,
        files,
      };

      if (isEdit && editTarget) {
        await updateSlpContactHistory(editTarget.id, payload);
        toast.success("接触履歴を更新しました");
      } else {
        const result = await addSlpLineUsersContactHistory(0, payload);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("接触履歴を登録しました");
      }
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const lineFriendLabelById = new Map(
    lineFriendOptions.map((o) => [o.id, o.label])
  );

  const customerTypesByProject = customerTypes.reduce(
    (acc, ct) => {
      const key = ct.project.id;
      if (!acc[key]) acc[key] = { projectName: ct.project.name, items: [] };
      acc[key].items.push(ct);
      return acc;
    },
    {} as Record<number, { projectName: string; items: CustomerType[] }>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="fullwidth" className="sm:!max-w-[880px] max-h-[74vh] h-[74vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b flex-shrink-0">
          <DialogTitle>
            {isEdit ? "接触履歴を編集" : "接触履歴を追加"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {/* 相手種別選択（新規のときだけ） */}
          {!isEdit && (
            <div>
              <Label>相手種別</Label>
              <Select value={target} onValueChange={(v) => setTarget(v as TargetChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="line_users">LINEユーザー</SelectItem>
                  <SelectItem value="company_record">事業者</SelectItem>
                  <SelectItem value="agency">代理店</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 事業者・代理店を選んだ場合は案内のみ */}
          {!isEdit && target === "company_record" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
              <p className="font-semibold mb-1">事業者への接触履歴はこちらからは登録できません</p>
              <p className="text-gray-700 mb-2">
                事業者ごとの接触履歴は、
                <Link href="/slp/companies" className="text-blue-600 underline mx-1">
                  事業者名簿
                </Link>
                から該当の事業者ページを開いて登録してください。
              </p>
            </div>
          )}
          {!isEdit && target === "agency" && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
              <p className="font-semibold mb-1">代理店への接触履歴はこちらからは登録できません</p>
              <p className="text-gray-700 mb-2">
                代理店ごとの接触履歴は、
                <Link href="/slp/agencies" className="text-blue-600 underline mx-1">
                  代理店管理
                </Link>
                から該当の代理店ページを開いて登録してください。
              </p>
            </div>
          )}

          {/* 編集時: 事業者/代理店の場合はラベル表示 */}
          {isEdit && editTarget?.targetType === "company_record" && (
            <div className="rounded-lg bg-gray-50 border p-3 text-sm">
              <div className="text-xs text-gray-500 mb-1">相手（事業者）</div>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {editTarget.companyRecordName ?? `事業者#${editTarget.companyRecordId}`}
                </span>
                {editTarget.companyRecordId && (
                  <Link
                    href={`/slp/companies/${editTarget.companyRecordId}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    事業者ページを開く ↗
                  </Link>
                )}
              </div>
            </div>
          )}
          {isEdit && editTarget?.targetType === "agency" && (
            <div className="rounded-lg bg-gray-50 border p-3 text-sm">
              <div className="text-xs text-gray-500 mb-1">相手（代理店）</div>
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {editTarget.agencyName ?? `代理店#${editTarget.agencyId}`}
                </span>
                {editTarget.agencyId && (
                  <Link
                    href={`/slp/agencies/${editTarget.agencyId}`}
                    target="_blank"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    代理店ページを開く ↗
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* LINEユーザー（または編集時）はフォーム表示 */}
          {(target === "line_users" || isEdit) && (
            <>
              {/* LINEユーザー選択（line_users のときのみ） */}
              {(!isEdit || editTarget?.targetType === "line_users") && (
              <div>
                <Label>LINEユーザー（複数選択可・未選択も可）</Label>
                <Popover open={lineFriendPopoverOpen} onOpenChange={setLineFriendPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className="text-gray-500">
                        {lineFriendIds.length === 0
                          ? "選択してください（省略可）"
                          : `${lineFriendIds.length}名を選択中`}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="IDまたは名前で検索..." />
                      <CommandList>
                        <CommandEmpty>候補なし</CommandEmpty>
                        <CommandGroup>
                          {lineFriendOptions.map((opt) => {
                            const checked = lineFriendIds.includes(opt.id);
                            return (
                              <CommandItem
                                key={opt.id}
                                onSelect={() => toggleLineFriend(opt.id)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    checked ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {opt.label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {lineFriendIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lineFriendIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1">
                        {lineFriendLabelById.get(id) ?? `#${id}`}
                        <button
                          type="button"
                          onClick={() => removeLineFriend(id)}
                          className="ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 接触日時 */}
              <div>
                <Label>接触日時 *</Label>
                <DatePicker
                  selected={contactDate}
                  onChange={(date: Date | null) => setContactDate(date)}
                  showTimeSelect
                  timeFormat="HH:mm"
                  timeIntervals={15}
                  dateFormat="yyyy/MM/dd HH:mm"
                  locale="ja"
                  placeholderText="日時を選択"
                  preventOpenOnFocus
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  wrapperClassName="w-full"
                />
              </div>

              {/* 接触方法 */}
              <div>
                <Label>接触方法</Label>
                <Select value={contactMethodId} onValueChange={setContactMethodId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未指定</SelectItem>
                    {contactMethodOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 接触種別 */}
              <div>
                <Label>接触種別</Label>
                <Select value={contactCategoryId} onValueChange={setContactCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">未指定</SelectItem>
                    {contactCategories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 担当者（複数選択プルダウン） */}
              <div>
                <Label>担当者（複数選択可）</Label>
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between min-h-10 h-auto font-normal"
                    >
                      <span className="flex flex-wrap gap-1">
                        {assignedTo.length === 0 ? (
                          <span className="text-muted-foreground">選択してください...</span>
                        ) : (
                          assignedTo.map((id) => {
                            const s = staffOptions.find((o) => o.value === id);
                            return (
                              <span
                                key={id}
                                className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm"
                              >
                                {s?.label ?? id}
                              </span>
                            );
                          })
                        )}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="担当者を検索..." />
                      <CommandList>
                        <CommandEmpty>見つかりませんでした</CommandEmpty>
                        <CommandGroup>
                          {staffOptions.map((s) => {
                            const isSelected = assignedTo.includes(s.value);
                            return (
                              <CommandItem
                                key={s.value}
                                value={s.label}
                                onSelect={() => toggleAssignedStaff(s.value)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    isSelected ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                {s.label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 顧客種別タグ（クロスプロジェクト対応） */}
              <div>
                <Label>顧客種別タグ（複数選択可）</Label>
                <div className="space-y-2 mt-1 border rounded p-2">
                  {Object.entries(customerTypesByProject).map(([pid, { projectName, items }]) => (
                    <div key={pid}>
                      <div className="text-xs font-semibold text-gray-500">
                        {projectName}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {items.map((ct) => {
                          const checked = customerTypeIds.includes(ct.id);
                          return (
                            <label
                              key={ct.id}
                              className="flex items-center gap-1 text-sm cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleCustomerType(ct.id)}
                              />
                              {ct.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 先方参加者 */}
              <div>
                <Label>先方参加者</Label>
                <Input
                  value={customerParticipants}
                  onChange={(e) => setCustomerParticipants(e.target.value)}
                  placeholder="担当者の氏名など"
                />
              </div>

              {/* 議事録 */}
              <div>
                <Label>議事録</Label>
                <Textarea
                  value={meetingMinutes}
                  onChange={(e) => setMeetingMinutes(e.target.value)}
                  rows={4}
                />
              </div>

              {/* 備考 */}
              <div>
                <Label>備考</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              {/* 添付ファイル・URL */}
              <div>
                <Label>添付ファイル・URL</Label>
                <MultiFileUpload value={files} onChange={setFiles} />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          {(target === "line_users" || isEdit) && (
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEdit ? "更新" : "登録"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
