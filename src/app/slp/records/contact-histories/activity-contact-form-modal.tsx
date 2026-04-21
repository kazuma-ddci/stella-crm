"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ChevronsUpDown, Check, Loader2, X } from "lucide-react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import type {
  CustomerType,
  ContactCategoryOption,
} from "@/components/contact-history-modal";
import { MultiFileUpload, type FileInfo } from "@/components/multi-file-upload";
import {
  addSlpContactHistoryUnified,
  updateSlpContactHistory,
} from "@/app/slp/contact-histories/actions";
import {
  ZoomEntriesForAdd,
  type ZoomAddEntry,
} from "@/app/slp/contact-histories/zoom-entries-for-add";
import { ZoomRecordingSection } from "@/app/slp/contact-histories/zoom-recording-section";
import { addManualZoomToContactHistory } from "@/app/slp/contact-histories/zoom-actions";

registerLocale("ja", ja);

type LineFriendOption = { id: number; label: string };

export type EditTarget = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactCategoryId: number | null;
  assignedTo: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  targetType: string;
  companyRecordId: number | null;
  agencyId: number | null;
  sessionId: number | null;
  customerTypeIds: number[];
  lineFriends: { id: number; snsname: string | null; uid: string }[];
  files?: FileInfo[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  editTarget?: EditTarget | null;
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  contactCategories: ContactCategoryOption[];
  companyRecordOptions: { value: string; label: string }[];
  agencyOptions: { value: string; label: string }[];
  lineFriendOptions: LineFriendOption[];
  sessionOptionsByCompany: Record<number, { value: string; label: string }[]>;
  slpCompanyCustomerTypeId: number;
  slpAgencyCustomerTypeId: number;
  slpLineUsersCustomerTypeId: number;
  slpOtherCustomerTypeId: number;
  onSaved?: () => void;
};

export function ActivityContactForm({
  open,
  onClose,
  editTarget,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
  contactCategories,
  companyRecordOptions,
  agencyOptions,
  lineFriendOptions,
  sessionOptionsByCompany,
  slpCompanyCustomerTypeId,
  slpAgencyCustomerTypeId,
  slpLineUsersCustomerTypeId,
  slpOtherCustomerTypeId,
  onSaved,
}: Props) {
  const router = useRouter();

  // 新規作成直後に自動編集モードへ切り替えるための内部 state
  // 親から渡される editTarget が優先、無ければ localNewTarget が使われる
  const [localNewTarget, setLocalNewTarget] = useState<EditTarget | null>(null);
  const effectiveEditTarget = editTarget ?? localNewTarget;
  const isEdit = !!effectiveEditTarget;

  const [contactDate, setContactDate] = useState<Date | null>(null);
  const [contactMethodId, setContactMethodId] = useState<string>("");
  const [contactCategoryId, setContactCategoryId] = useState<string>("");
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [customerTypeIds, setCustomerTypeIds] = useState<number[]>([]);
  const [customerParticipants, setCustomerParticipants] = useState("");
  const [meetingMinutes, setMeetingMinutes] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  // エンティティ選択
  const [companyRecordId, setCompanyRecordId] = useState<string>("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [lineFriendIds, setLineFriendIds] = useState<number[]>([]);
  const [sessionId, setSessionId] = useState<string>("__none__");
  // Popover状態
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [lineFriendPopoverOpen, setLineFriendPopoverOpen] = useState(false);
  // Zoom議事録連携
  const [zoomEntries, setZoomEntries] = useState<ZoomAddEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const lineFriendLabelById = useMemo(() => {
    const m = new Map<number, string>();
    lineFriendOptions.forEach((o) => m.set(o.id, o.label));
    return m;
  }, [lineFriendOptions]);

  // フォームが閉じたら localNewTarget をリセット
  useEffect(() => {
    if (!open) setLocalNewTarget(null);
  }, [open]);

  // 編集時の初期値ロード（effectiveEditTarget を参照）
  useEffect(() => {
    if (!open) return;
    if (effectiveEditTarget) {
      setContactDate(effectiveEditTarget.contactDate ? new Date(effectiveEditTarget.contactDate) : null);
      setContactMethodId(effectiveEditTarget.contactMethodId ? String(effectiveEditTarget.contactMethodId) : "");
      setContactCategoryId(effectiveEditTarget.contactCategoryId ? String(effectiveEditTarget.contactCategoryId) : "");
      setSelectedStaffIds(
        effectiveEditTarget.assignedTo
          ? effectiveEditTarget.assignedTo.split(",").map((s) => s.trim()).filter(Boolean)
          : []
      );
      setCustomerTypeIds(effectiveEditTarget.customerTypeIds);
      setCustomerParticipants(effectiveEditTarget.customerParticipants ?? "");
      setMeetingMinutes(effectiveEditTarget.meetingMinutes ?? "");
      setNote(effectiveEditTarget.note ?? "");
      setFiles(effectiveEditTarget.files ?? []);
      setCompanyRecordId(effectiveEditTarget.companyRecordId ? String(effectiveEditTarget.companyRecordId) : "");
      setAgencyId(effectiveEditTarget.agencyId ? String(effectiveEditTarget.agencyId) : "");
      setLineFriendIds(effectiveEditTarget.lineFriends.map((lf) => lf.id));
      setSessionId(effectiveEditTarget.sessionId ? String(effectiveEditTarget.sessionId) : "__none__");
      setZoomEntries([]);
    } else {
      setContactDate(new Date());
      setContactMethodId("");
      setContactCategoryId("");
      setSelectedStaffIds([]);
      setCustomerTypeIds([]);
      setCustomerParticipants("");
      setMeetingMinutes("");
      setNote("");
      setFiles([]);
      setCompanyRecordId("");
      setAgencyId("");
      setLineFriendIds([]);
      setSessionId("__none__");
      setZoomEntries([]);
    }
  }, [open, effectiveEditTarget]);

  const toggleCustomerType = (id: number) => {
    setCustomerTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleStaff = (id: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleLineFriend = (id: number) => {
    setLineFriendIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // プロジェクトごとにグループ化
  const projectGroups = useMemo(() => {
    const groups: Record<string, { projectId: number; displayOrder: number; types: CustomerType[] }> = {};
    customerTypes.forEach((ct) => {
      const key = ct.project.name;
      if (!groups[key]) {
        groups[key] = { projectId: ct.projectId, displayOrder: ct.project.displayOrder, types: [] };
      }
      groups[key].types.push(ct);
    });
    return Object.entries(groups).sort(([, a], [, b]) => a.displayOrder - b.displayOrder);
  }, [customerTypes]);

  // 選択中のプロジェクトIDから担当者候補を絞る
  const availableStaffOptions = useMemo(() => {
    if (customerTypeIds.length === 0) return staffOptions;
    const projectIds = new Set<number>();
    customerTypeIds.forEach((ctId) => {
      const ct = customerTypes.find((c) => c.id === ctId);
      if (ct) projectIds.add(ct.projectId);
    });
    const staffMap = new Map<string, { value: string; label: string }>();
    projectIds.forEach((pid) => {
      (staffByProject[pid] || []).forEach((s) => {
        if (!staffMap.has(s.value)) staffMap.set(s.value, s);
      });
    });
    const list = Array.from(staffMap.values());
    return list.length > 0 ? list : staffOptions;
  }, [customerTypeIds, customerTypes, staffByProject, staffOptions]);

  // 選択中のプロジェクトIDから接触種別を絞る
  const availableCategories = useMemo(() => {
    if (customerTypeIds.length === 0) return contactCategories;
    const projectIds = new Set<number>();
    customerTypeIds.forEach((ctId) => {
      const ct = customerTypes.find((c) => c.id === ctId);
      if (ct) projectIds.add(ct.projectId);
    });
    return contactCategories.filter((cc) => projectIds.has(cc.projectId));
  }, [customerTypeIds, customerTypes, contactCategories]);

  const showCompanySelector = customerTypeIds.includes(slpCompanyCustomerTypeId);
  const showAgencySelector = customerTypeIds.includes(slpAgencyCustomerTypeId);
  const showLineUsersSelector = customerTypeIds.includes(slpLineUsersCustomerTypeId);
  const showSessionSelector = showCompanySelector && companyRecordId !== "";

  const sessionOptions = useMemo(() => {
    if (!showSessionSelector) return [];
    const cid = parseInt(companyRecordId, 10);
    return sessionOptionsByCompany[cid] ?? [];
  }, [showSessionSelector, companyRecordId, sessionOptionsByCompany]);

  // Zoomエントリ処理（新規追加時のみ）
  const processZoomEntries = async (
    contactHistoryId: number,
    toastId: string | number
  ) => {
    const valid = zoomEntries.filter((e) => e.zoomUrl.trim() !== "");
    if (valid.length === 0) {
      toast.success("接触履歴を追加しました", { id: toastId });
      return;
    }
    toast.loading(`Zoom議事録を連携中... (0/${valid.length})`, { id: toastId });
    let successCount = 0;
    let failCount = 0;
    const failReasons: string[] = [];
    for (let i = 0; i < valid.length; i++) {
      const entry = valid[i];
      toast.loading(`Zoom議事録を連携中... (${i + 1}/${valid.length})`, { id: toastId });
      if (!entry.hostStaffId) {
        failCount++;
        failReasons.push(`"${entry.zoomUrl.slice(0, 40)}..." ホストスタッフ未選択`);
        continue;
      }
      const r = await addManualZoomToContactHistory({
        contactHistoryId,
        zoomUrl: entry.zoomUrl,
        hostStaffId: parseInt(entry.hostStaffId, 10),
        label: entry.label.trim() || undefined,
        mode: entry.mode,
      });
      if (r.ok) successCount++;
      else {
        failCount++;
        failReasons.push(r.error);
      }
    }
    if (failCount === 0) {
      toast.success(`接触履歴を追加しました（Zoom議事録${successCount}件連携）`, { id: toastId });
    } else if (successCount > 0) {
      toast.warning(
        `接触履歴を追加しました（Zoom連携: 成功${successCount}件・失敗${failCount}件）`,
        { id: toastId, description: failReasons.slice(0, 3).join(" / "), duration: 10000 }
      );
    } else {
      toast.warning("接触履歴は追加しましたが、Zoom議事録連携に失敗しました", {
        id: toastId,
        description: failReasons.slice(0, 3).join(" / "),
        duration: 10000,
      });
    }
  };

  const handleSubmit = async () => {
    if (!contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (customerTypeIds.length === 0) {
      toast.error("顧客種別を1つ以上選択してください");
      return;
    }
    // SLP顧客種別の必須チェック
    const hasSlpType =
      customerTypeIds.includes(slpCompanyCustomerTypeId) ||
      customerTypeIds.includes(slpAgencyCustomerTypeId) ||
      customerTypeIds.includes(slpLineUsersCustomerTypeId) ||
      customerTypeIds.includes(slpOtherCustomerTypeId);
    if (!hasSlpType) {
      toast.error("SLPの顧客種別（事業者・代理店・LINEユーザー・その他）を1つ以上選択してください");
      return;
    }
    // エンティティ必須チェック
    if (showCompanySelector && !companyRecordId) {
      toast.error("事業者を選択してください");
      return;
    }
    if (showAgencySelector && !agencyId) {
      toast.error("代理店を選択してください");
      return;
    }
    if (showLineUsersSelector && lineFriendIds.length === 0) {
      toast.error("LINE友達を1名以上選択してください");
      return;
    }
    setSubmitting(true);
    const toastId = toast.loading(isEdit ? "更新中..." : "追加中...");
    try {
      const payload = {
        contactDate: contactDate.toISOString(),
        contactMethodId: contactMethodId ? parseInt(contactMethodId, 10) : null,
        contactCategoryId: contactCategoryId ? parseInt(contactCategoryId, 10) : null,
        assignedTo: selectedStaffIds.length > 0 ? selectedStaffIds.join(",") : null,
        customerParticipants: customerParticipants.trim() || null,
        meetingMinutes: meetingMinutes.trim() || null,
        note: note.trim() || null,
        customerTypeIds,
        files,
        companyRecordId: showCompanySelector && companyRecordId ? parseInt(companyRecordId, 10) : null,
        agencyId: showAgencySelector && agencyId ? parseInt(agencyId, 10) : null,
        lineFriendIds: showLineUsersSelector ? lineFriendIds : [],
        sessionId: showSessionSelector && sessionId !== "__none__" ? parseInt(sessionId, 10) : null,
      };

      if (isEdit && effectiveEditTarget) {
        await updateSlpContactHistory(effectiveEditTarget.id, payload);
        toast.success("接触履歴を更新しました", { id: toastId });
        onClose();
        onSaved?.();
        router.refresh();
      } else {
        const r = await addSlpContactHistoryUnified(payload);
        if (!r.ok) {
          toast.error(r.error, { id: toastId });
          setSubmitting(false);
          return;
        }
        const created = r.data as unknown as {
          id: number;
          contactDate: string;
          contactMethodId: number | null;
          contactCategoryId: number | null;
          assignedTo: string | null;
          customerParticipants: string | null;
          meetingMinutes: string | null;
          note: string | null;
          targetType: string;
          companyRecordId: number | null;
          agencyId: number | null;
          sessionId: number | null;
          customerTypeIds: number[];
          lineFriends: { id: number; snsname: string | null; uid: string }[];
          files: FileInfo[];
        };
        await processZoomEntries(created.id, toastId);

        // 新規成功後は自動で編集モードへ遷移（Zoom追加やメタデータ微調整を続けて可能に）
        setLocalNewTarget({
          id: created.id,
          contactDate: created.contactDate,
          contactMethodId: created.contactMethodId,
          contactCategoryId: created.contactCategoryId,
          assignedTo: created.assignedTo,
          customerParticipants: created.customerParticipants,
          meetingMinutes: created.meetingMinutes,
          note: created.note,
          targetType: created.targetType,
          companyRecordId: created.companyRecordId,
          agencyId: created.agencyId,
          sessionId: created.sessionId,
          customerTypeIds: created.customerTypeIds,
          lineFriends: created.lineFriends,
          files: created.files,
        });
        onSaved?.();
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "エラーが発生しました", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="rounded-lg border bg-white p-4 space-y-4">
      <h3 className="text-lg font-semibold">
        {isEdit ? "接触履歴を編集" : "接触履歴を追加"}
      </h3>
      <div className="space-y-4">
        <div className="space-y-4">
          {/* 日時 / 接触方法 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                接触日時 <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                selected={contactDate}
                onChange={(d: Date | null) => setContactDate(d)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy/MM/dd HH:mm"
                locale="ja"
                placeholderText="日時を選択"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                wrapperClassName="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>接触方法</Label>
              <Select value={contactMethodId} onValueChange={setContactMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {contactMethodOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* プロジェクト・顧客種別（相手種別を兼ねる） */}
          <div className="space-y-2">
            <Label>
              プロジェクト・顧客種別 <span className="text-destructive">*</span>
            </Label>
            <div className="border rounded-lg p-3 space-y-4">
              {projectGroups.map(([projectName, group]) => (
                <div key={projectName}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{projectName}</p>
                  <div className="flex flex-wrap gap-4 ml-2">
                    {group.types.map((ct) => (
                      <div key={ct.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`ct-${ct.id}`}
                          checked={customerTypeIds.includes(ct.id)}
                          onCheckedChange={() => toggleCustomerType(ct.id)}
                          disabled={isEdit}
                        />
                        <label
                          htmlFor={`ct-${ct.id}`}
                          className="text-sm font-medium leading-none"
                        >
                          {ct.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                編集時は顧客種別とエンティティ紐付けは変更できません
              </p>
            )}
          </div>

          {/* エンティティ選択UI（顧客種別チェックに連動） */}
          {showCompanySelector && (
            <div className="space-y-2">
              <Label>
                事業者 <span className="text-destructive">*</span>
              </Label>
              <Select value={companyRecordId} onValueChange={setCompanyRecordId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="事業者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {companyRecordOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showAgencySelector && (
            <div className="space-y-2">
              <Label>
                代理店 <span className="text-destructive">*</span>
              </Label>
              <Select value={agencyId} onValueChange={setAgencyId} disabled={isEdit}>
                <SelectTrigger>
                  <SelectValue placeholder="代理店を選択" />
                </SelectTrigger>
                <SelectContent>
                  {agencyOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showLineUsersSelector && (
            <div className="space-y-2">
              <Label>LINEユーザー（複数選択可）</Label>
              <Popover open={lineFriendPopoverOpen} onOpenChange={setLineFriendPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between" disabled={isEdit}>
                    {lineFriendIds.length === 0
                      ? "選択してください"
                      : `${lineFriendIds.length}名を選択中`}
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
                            <CommandItem key={opt.id} onSelect={() => toggleLineFriend(opt.id)}>
                              <Check className={`mr-2 h-4 w-4 ${checked ? "opacity-100" : "opacity-0"}`} />
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
                      {!isEdit && (
                        <button onClick={() => toggleLineFriend(id)} className="ml-1">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 接触種別 */}
          <div className="space-y-2">
            <Label>接触種別</Label>
            <Select value={contactCategoryId} onValueChange={setContactCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((cc) => (
                  <SelectItem key={cc.id} value={String(cc.id)}>{cc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 担当者（複数選択可） */}
          <div className="space-y-2">
            <Label>担当者（複数選択可）</Label>
            <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between min-h-10 h-auto">
                  <span className="flex flex-wrap gap-1">
                    {selectedStaffIds.length === 0 ? (
                      <span className="text-muted-foreground">選択してください...</span>
                    ) : (
                      selectedStaffIds.map((id) => {
                        const staff = staffOptions.find((s) => s.value === id);
                        return (
                          <span key={id} className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-sm">
                            {staff?.label || id}
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
                    <CommandEmpty>
                      {availableStaffOptions.length === 0 ? "担当者なし" : "見つかりません"}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableStaffOptions.map((staff) => {
                        const isSelected = selectedStaffIds.includes(staff.value);
                        return (
                          <CommandItem
                            key={staff.value}
                            value={staff.label}
                            onSelect={() => toggleStaff(staff.value)}
                          >
                            {isSelected && <Check className="mr-2 h-4 w-4" />}
                            {!isSelected && <span className="mr-2 w-4" />}
                            {staff.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* 先方参加者 */}
          <div className="space-y-2">
            <Label>先方参加者</Label>
            <Input
              value={customerParticipants}
              onChange={(e) => setCustomerParticipants(e.target.value)}
              placeholder="先方の参加者名を入力"
            />
          </div>

          {/* 議事録 */}
          <div className="space-y-2">
            <Label>議事録</Label>
            <Textarea
              value={meetingMinutes}
              onChange={(e) => setMeetingMinutes(e.target.value)}
              rows={4}
              placeholder="議事録を入力"
            />
          </div>

          {/* 備考 */}
          <div className="space-y-2">
            <Label>備考</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="備考"
            />
          </div>

          {/* 打ち合わせに紐付け（事業者選択+SLPのみ） */}
          {showSessionSelector && (
            <div className="space-y-2">
              <Label>打ち合わせに紐付け（任意）</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">紐付けなし</SelectItem>
                  {sessionOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                商談タブの該当打ち合わせからこの接触履歴を確認できるようになります。
              </p>
            </div>
          )}

          {/* 添付ファイル */}
          <div className="space-y-2">
            <Label>添付ファイル</Label>
            <MultiFileUpload
              value={files}
              onChange={setFiles}
              contactHistoryId={effectiveEditTarget?.id}
            />
          </div>

          {/* 編集時: Zoom録画一覧（自動遷移後の新規作成直後もここで追加可能） */}
          {isEdit && effectiveEditTarget && (
            <div className="rounded border p-3 bg-muted/20">
              <ZoomRecordingSection contactHistoryId={effectiveEditTarget.id} />
            </div>
          )}

          {/* 新規追加時: Zoom議事録連携エントリ */}
          {!isEdit && (
            <div className="rounded border p-3 bg-muted/20">
              <ZoomEntriesForAdd entries={zoomEntries} onChange={setZoomEntries} />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          キャンセル
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isEdit ? "更新する" : "追加する"}
        </Button>
      </div>
    </div>
  );
}
