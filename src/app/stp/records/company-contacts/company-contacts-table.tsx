"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronsUpDown, Check, AlertTriangle, X, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { addCompanyContact, updateCompanyContact, deleteCompanyContact } from "./actions";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { FileDisplay, type FileInfo } from "@/components/multi-file-upload";
import { CompanyCodeLabel } from "@/components/company-code-label";

registerLocale("ja", ja);

type Props = {
  data: Record<string, unknown>[];
  stpCompanyOptions: { value: string; label: string }[];
  contactMethodOptions: { value: string; label: string }[];
  customerTypeOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  staffByProject: Record<number, { value: string; label: string }[]>;
  customerTypeProjectMap: Record<string, number>;
};

type FormData = {
  stpCompanyId?: string | null;
  contactDate?: string;
  contactMethodId?: string | null;
  assignedTo?: string[];
  customerParticipants?: string;
  meetingMinutes?: string;
  note?: string;
  customerTypeIds?: string[];
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CompanyContactsTable({
  data,
  stpCompanyOptions,
  contactMethodOptions,
  customerTypeOptions,
  staffOptions,
  staffByProject,
  customerTypeProjectMap,
}: Props) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [deleteItem, setDeleteItem] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [loading, setLoading] = useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState(false);
  const [filterValue, setFilterValue] = useState("");
  const [mismatchWarning, setMismatchWarning] = useState<string[] | null>(null);

  // 選択されたプロジェクトに基づいて利用可能なスタッフを取得
  const getAvailableStaffOptions = useCallback(() => {
    const selectedCustomerTypeIds = formData.customerTypeIds || [];
    if (selectedCustomerTypeIds.length === 0) {
      return staffOptions;
    }

    // 選択されたcustomerTypeIdsからprojectIdを取得
    const selectedProjectIds = new Set<number>();
    selectedCustomerTypeIds.forEach((ctId) => {
      const projectId = customerTypeProjectMap[ctId];
      if (projectId) {
        selectedProjectIds.add(projectId);
      }
    });

    // 選択されたプロジェクトに割り当てられたスタッフを取得（重複除去）
    const availableStaffMap = new Map<string, { value: string; label: string }>();
    selectedProjectIds.forEach((projectId) => {
      const projectStaff = staffByProject[projectId] || [];
      projectStaff.forEach((s) => {
        if (!availableStaffMap.has(s.value)) {
          availableStaffMap.set(s.value, s);
        }
      });
    });

    return Array.from(availableStaffMap.values());
  }, [formData.customerTypeIds, customerTypeProjectMap, staffByProject, staffOptions]);

  // 担当者とプロジェクトの不整合をチェック
  const checkMismatch = useCallback((assignedTo: string[], customerTypeIds: string[]): string[] => {
    if (assignedTo.length === 0 || customerTypeIds.length === 0) {
      return [];
    }

    // 選択されたcustomerTypeIdsからprojectIdを取得
    const selectedProjectIds = new Set<number>();
    customerTypeIds.forEach((ctId) => {
      const projectId = customerTypeProjectMap[ctId];
      if (projectId) {
        selectedProjectIds.add(projectId);
      }
    });

    // 各担当者がいずれかのプロジェクトに紐づいているかチェック
    const mismatchedStaff: string[] = [];
    assignedTo.forEach((staffId) => {
      let hasMatch = false;
      selectedProjectIds.forEach((projectId) => {
        const projectStaff = staffByProject[projectId] || [];
        if (projectStaff.some((s) => s.value === staffId)) {
          hasMatch = true;
        }
      });
      if (!hasMatch) {
        const staff = staffOptions.find((s) => s.value === staffId);
        mismatchedStaff.push(staff?.label || staffId);
      }
    });

    return mismatchedStaff;
  }, [customerTypeProjectMap, staffByProject, staffOptions]);

  const availableStaffOptions = useMemo(() => getAvailableStaffOptions(), [getAvailableStaffOptions]);

  const openAddDialog = () => {
    setFormData({
      customerTypeIds: ["1"], // デフォルトで「企業」を選択
      assignedTo: [],
    });
    setMismatchWarning(null);
    setIsAddOpen(true);
  };

  const openEditDialog = (item: Record<string, unknown>) => {
    // assignedToをカンマ区切り文字列から配列に変換
    const assignedToStr = item.assignedTo as string | null;
    const assignedToArray = assignedToStr ? assignedToStr.split(",").filter(Boolean) : [];

    // customerTypeIdsを文字列配列に変換
    const customerTypeIds = (item.customerTypeIds as number[] || []).map(String);

    setEditItem(item);
    setFormData({
      stpCompanyId: item.stpCompanyId ? String(item.stpCompanyId) : null,
      contactDate: item.contactDate as string,
      contactMethodId: item.contactMethodId ? String(item.contactMethodId) : null,
      assignedTo: assignedToArray,
      customerParticipants: (item.customerParticipants as string) || "",
      meetingMinutes: (item.meetingMinutes as string) || "",
      note: (item.note as string) || "",
      customerTypeIds,
    });
    setMismatchWarning(null);
  };

  const handleStaffChange = (staffId: string) => {
    const currentIds = formData.assignedTo || [];
    const isSelected = currentIds.includes(staffId);
    const newIds = isSelected
      ? currentIds.filter((id) => id !== staffId)
      : [...currentIds, staffId];
    setFormData({ ...formData, assignedTo: newIds });
  };

  const handleCustomerTypeChange = (customerTypeId: string, checked: boolean) => {
    const currentIds = formData.customerTypeIds || [];
    const newIds = checked
      ? [...currentIds, customerTypeId]
      : currentIds.filter((id) => id !== customerTypeId);
    setFormData({ ...formData, customerTypeIds: newIds });
  };

  const handleSave = async (isAdd: boolean) => {
    if (!formData.contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (isAdd && !formData.stpCompanyId) {
      toast.error("企業は必須です");
      return;
    }
    if (!formData.customerTypeIds || formData.customerTypeIds.length === 0) {
      toast.error("プロジェクト（顧客種別）を1つ以上選択してください");
      return;
    }

    // 不整合チェック
    const mismatched = checkMismatch(formData.assignedTo || [], formData.customerTypeIds);
    if (mismatched.length > 0) {
      setMismatchWarning(mismatched);
      return;
    }

    await doSave(isAdd);
  };

  const doSave = async (isAdd: boolean) => {
    setLoading(true);
    try {
      const saveData = {
        stpCompanyId: formData.stpCompanyId,
        contactDate: formData.contactDate,
        contactMethodId: formData.contactMethodId,
        assignedTo: formData.assignedTo || [],
        customerParticipants: formData.customerParticipants,
        meetingMinutes: formData.meetingMinutes,
        note: formData.note,
        customerTypeIds: formData.customerTypeIds,
      };

      if (isAdd) {
        await addCompanyContact(saveData);
        toast.success("追加しました");
        setIsAddOpen(false);
      } else if (editItem) {
        await updateCompanyContact(editItem.id as number, saveData);
        toast.success("更新しました");
        setEditItem(null);
      }
      setFormData({});
      setMismatchWarning(null);
    } catch {
      toast.error(isAdd ? "追加に失敗しました" : "更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setLoading(true);
    try {
      await deleteCompanyContact(deleteItem.id as number);
      toast.success("削除しました");
      setDeleteItem(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!filterValue) return data;
    const searchTerm = filterValue.toLowerCase();
    return data.filter((item) => {
      return (
        (item.companyCode as string)?.toLowerCase().includes(searchTerm) ||
        (item.companyName as string)?.toLowerCase().includes(searchTerm) ||
        (item.staffName as string)?.toLowerCase().includes(searchTerm) ||
        (item.contactMethodName as string)?.toLowerCase().includes(searchTerm)
      );
    });
  }, [data, filterValue]);

  const selectedStaffIds = formData.assignedTo || [];

  // 現在選択中の担当者で、プロジェクトに紐づいていないものを特定
  const getMismatchedInForm = useMemo(() => {
    return checkMismatch(selectedStaffIds, formData.customerTypeIds || []);
  }, [checkMismatch, selectedStaffIds, formData.customerTypeIds]);

  const renderForm = (isAdd: boolean) => (
    <div className="space-y-4">
      {isAdd && (
        <div className="space-y-2">
          <Label>企業 <span className="text-destructive">*</span></Label>
          <Popover open={companyPopoverOpen} onOpenChange={setCompanyPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {formData.stpCompanyId
                  ? stpCompanyOptions.find((c) => c.value === formData.stpCompanyId)?.label
                  : "選択してください..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
              <Command>
                <CommandInput placeholder="企業を検索..." />
                <CommandList maxHeight={300}>
                  <CommandEmpty>見つかりませんでした</CommandEmpty>
                  <CommandGroup>
                    {stpCompanyOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          setFormData({ ...formData, stpCompanyId: opt.value });
                          setCompanyPopoverOpen(false);
                        }}
                      >
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>接触日時 <span className="text-destructive">*</span></Label>
          <DatePicker
            selected={formData.contactDate ? new Date(formData.contactDate) : null}
            onChange={(date: Date | null) => {
              setFormData({ ...formData, contactDate: date ? date.toISOString() : undefined });
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy/MM/dd HH:mm"
            locale="ja"
            placeholderText="日付を入力する"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label>接触方法</Label>
          <Select
            value={formData.contactMethodId || ""}
            onValueChange={(v) => setFormData({ ...formData, contactMethodId: v || null })}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {contactMethodOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* プロジェクト・顧客種別選択 */}
      <div className="space-y-2">
        <Label>プロジェクト・顧客種別 <span className="text-destructive">*</span></Label>
        <div className="border rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap gap-4">
            {customerTypeOptions.map((opt) => {
              const isChecked = (formData.customerTypeIds || []).includes(opt.value);
              return (
                <div key={opt.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`ct-${opt.value}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => handleCustomerTypeChange(opt.value, !!checked)}
                  />
                  <label htmlFor={`ct-${opt.value}`} className="text-sm font-medium">
                    {opt.label}
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 担当者選択 */}
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
                    const isMismatched = getMismatchedInForm.includes(staff?.label || id);
                    return (
                      <span
                        key={id}
                        className={`px-2 py-0.5 rounded text-sm ${
                          isMismatched
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {isMismatched && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                        {staff?.label || id}
                      </span>
                    );
                  })
                )}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0">
            <Command>
              <CommandInput placeholder="担当者を検索..." />
              <CommandList maxHeight={300}>
                <CommandEmpty>
                  {availableStaffOptions.length === 0
                    ? "選択されたプロジェクトに担当者が割り当てられていません"
                    : "見つかりませんでした"}
                </CommandEmpty>
                <CommandGroup heading="プロジェクトに紐づく担当者">
                  {availableStaffOptions.map((staff) => {
                    const isSelected = selectedStaffIds.includes(staff.value);
                    return (
                      <CommandItem
                        key={staff.value}
                        value={staff.label}
                        onSelect={() => handleStaffChange(staff.value)}
                      >
                        {isSelected && <Check className="mr-2 h-4 w-4" />}
                        {!isSelected && <span className="mr-2 w-4" />}
                        {staff.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {/* 現在選択中でプロジェクトに紐づいていない担当者も表示 */}
                {getMismatchedInForm.length > 0 && (
                  <CommandGroup heading="プロジェクトに紐づいていない担当者">
                    {selectedStaffIds
                      .filter((id) => {
                        const staff = staffOptions.find((s) => s.value === id);
                        return getMismatchedInForm.includes(staff?.label || id);
                      })
                      .map((id) => {
                        const staff = staffOptions.find((s) => s.value === id);
                        return (
                          <CommandItem
                            key={id}
                            value={staff?.label || id}
                            onSelect={() => handleStaffChange(id)}
                            className="text-amber-700"
                          >
                            <Check className="mr-2 h-4 w-4" />
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {staff?.label || id}
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* 不整合警告 */}
        {getMismatchedInForm.length > 0 && (
          <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">担当者とプロジェクトの不整合があります</p>
              <p className="mt-1">
                以下の担当者は選択されたプロジェクトに紐づいていません：
                <strong className="ml-1">{getMismatchedInForm.join(", ")}</strong>
              </p>
              <p className="mt-2 text-xs">
                対応方法：担当者を変更するか、
                <a href="/settings/staff" className="underline font-medium">スタッフ設定</a>
                でプロジェクトを付与してください。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>先方参加者</Label>
        <Input
          value={formData.customerParticipants || ""}
          onChange={(e) => setFormData({ ...formData, customerParticipants: e.target.value })}
          placeholder="先方の参加者名を入力"
        />
      </div>

      <div className="space-y-2">
        <Label>議事録</Label>
        <Textarea
          value={formData.meetingMinutes || ""}
          onChange={(e) => setFormData({ ...formData, meetingMinutes: e.target.value })}
          rows={4}
          placeholder="議事録を入力"
        />
      </div>

      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          rows={2}
          placeholder="備考"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 検索バーと追加ボタン */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="検索（企業名、担当者、接触方法）..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="w-[300px]"
        />
        {filterValue && (
          <Button variant="ghost" size="icon" onClick={() => setFilterValue("")}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="ml-auto">
          <Button onClick={openAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            新規追加
          </Button>
        </div>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>企業名</TableHead>
              <TableHead>接触日時</TableHead>
              <TableHead>接触方法</TableHead>
              <TableHead>プロジェクト</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>先方参加者</TableHead>
              <TableHead>議事録</TableHead>
              <TableHead>備考</TableHead>
              <TableHead>添付</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground">
                  {data.length === 0 ? "接触履歴がありません" : "検索条件に一致するデータがありません"}
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((item) => (
                <TableRow key={item.id as number}>
                  <TableCell className="whitespace-nowrap">
                    <CompanyCodeLabel code={item.companyCode as string} name={item.companyName as string} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(item.contactDate as string)}
                  </TableCell>
                  <TableCell>{(item.contactMethodName as string) || "-"}</TableCell>
                  <TableCell>{(item.customerTypeLabels as string) || "-"}</TableCell>
                  <TableCell>
                    {item.hasMismatch ? (
                      <span className="text-amber-600">
                        <AlertTriangle className="inline h-3 w-3 mr-1" />
                        {item.staffName as string}
                      </span>
                    ) : (
                      (item.staffName as string) || "-"
                    )}
                  </TableCell>
                  <TableCell>{(item.customerParticipants as string) || "-"}</TableCell>
                  <TableCell>
                    <TextPreviewCell text={item.meetingMinutes as string | null} title="議事録" />
                  </TableCell>
                  <TableCell>
                    <TextPreviewCell text={item.note as string | null} title="備考" />
                  </TableCell>
                  <TableCell>
                    <FileDisplay files={(item.files as FileInfo[]) || []} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteItem(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 追加ダイアログ */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>企業接触履歴を追加</DialogTitle>
          </DialogHeader>
          {renderForm(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={() => handleSave(true)} disabled={loading}>
              {loading ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>企業接触履歴を編集</DialogTitle>
          </DialogHeader>
          {renderForm(false)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              キャンセル
            </Button>
            <Button onClick={() => handleSave(false)} disabled={loading}>
              {loading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 不整合警告ダイアログ */}
      <AlertDialog open={!!mismatchWarning} onOpenChange={(open) => !open && setMismatchWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              担当者とプロジェクトの不整合
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  以下の担当者は選択されたプロジェクトに紐づいていません：
                </p>
                <p className="font-medium text-foreground">
                  {mismatchWarning?.join(", ")}
                </p>
                <div className="text-sm space-y-2 mt-4">
                  <p className="font-medium">対応方法：</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>担当者を変更する</li>
                    <li>
                      <a href="/settings/staff" className="underline text-primary">スタッフ設定</a>
                      で該当スタッフにプロジェクトを付与する
                    </li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  このまま保存することもできますが、後で修正することをお勧めします。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMismatchWarning(null)}>
              戻って修正する
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMismatchWarning(null);
                doSave(isAddOpen);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              このまま保存する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>削除確認</AlertDialogTitle>
            <AlertDialogDescription>
              この接触履歴を削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteItem(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
