"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronsUpDown, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  addAgentContactHistory,
  updateAgentContactHistory,
  deleteAgentContactHistory,
} from "./contact-history-actions";

registerLocale("ja", ja);

// 必須の顧客種別ID（代理店一覧から開く場合は「代理店」が必須）
const REQUIRED_CUSTOMER_TYPE_ID = 2; // 代理店
const REQUIRED_CUSTOMER_TYPE_NAME = "代理店";

type CustomerType = {
  id: number;
  name: string;
  projectId: number;
  displayOrder: number;
  project: {
    id: number;
    name: string;
    displayOrder: number;
  };
};

type ContactHistory = {
  id: number;
  contactDate: string;
  contactMethodId: number | null;
  contactMethodName: string | null;
  assignedTo: string | null;
  assignedToNames: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  customerTypeIds?: number[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: number;
  agentName: string;
  contactHistories: Record<string, unknown>[];
  contactMethodOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  customerTypes: CustomerType[];
  staffByProject: Record<number, { value: string; label: string }[]>;
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

export function ContactHistoryModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  contactHistories: initialHistories,
  contactMethodOptions,
  staffOptions,
  customerTypes,
  staffByProject,
}: Props) {
  const [histories, setHistories] = useState<ContactHistory[]>(
    initialHistories as unknown as ContactHistory[]
  );
  const [isAddMode, setIsAddMode] = useState(false);
  const [editHistory, setEditHistory] = useState<ContactHistory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ContactHistory | null>(null);
  const [editConfirm, setEditConfirm] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<Partial<ContactHistory> | null>(null);
  const [formData, setFormData] = useState<Partial<ContactHistory>>({});
  const [loading, setLoading] = useState(false);
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);
  const [requiredWarning, setRequiredWarning] = useState(false);

  // スタッフIDからスタッフ名を取得するヘルパー
  const getStaffNames = (assignedTo: string | null): string => {
    if (!assignedTo) return "-";
    const ids = assignedTo.split(",").filter(Boolean);
    const names = ids.map((id) => {
      const staff = staffOptions.find((s) => s.value === id);
      return staff?.label || id;
    });
    return names.length > 0 ? names.join(", ") : "-";
  };

  const openAddForm = () => {
    setFormData({
      contactDate: new Date().toISOString(),
      contactMethodId: null,
      assignedTo: "",
      customerParticipants: "",
      meetingMinutes: "",
      note: "",
      customerTypeIds: [REQUIRED_CUSTOMER_TYPE_ID], // デフォルトで「代理店」を選択
    });
    setRequiredWarning(false);
    setIsAddMode(true);
  };

  const openEditForm = (history: ContactHistory) => {
    setFormData({
      ...history,
      customerTypeIds: history.customerTypeIds || [REQUIRED_CUSTOMER_TYPE_ID],
    });
    setRequiredWarning(false);
    setEditHistory(history);
  };

  // 顧客種別のチェック状態を変更
  const handleCustomerTypeChange = (customerTypeId: number, checked: boolean) => {
    const currentIds = formData.customerTypeIds || [REQUIRED_CUSTOMER_TYPE_ID];

    // 必須の顧客種別を外そうとした場合は警告を表示
    if (customerTypeId === REQUIRED_CUSTOMER_TYPE_ID && !checked) {
      setRequiredWarning(true);
      return;
    }

    let newIds: number[];
    if (checked) {
      newIds = [...currentIds, customerTypeId];
    } else {
      newIds = currentIds.filter((id) => id !== customerTypeId);
    }
    setFormData({ ...formData, customerTypeIds: newIds });
  };

  const handleStaffChange = (staffId: string) => {
    const currentIds = (formData.assignedTo || "").split(",").filter(Boolean);
    const isSelected = currentIds.includes(staffId);
    let newIds: string[];
    if (isSelected) {
      newIds = currentIds.filter((id) => id !== staffId);
    } else {
      newIds = [...currentIds, staffId];
    }
    setFormData({ ...formData, assignedTo: newIds.join(",") });
  };

  const handleAdd = async () => {
    if (!formData.contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (!formData.customerTypeIds || formData.customerTypeIds.length === 0) {
      toast.error("顧客種別を1つ以上選択してください");
      return;
    }
    setLoading(true);
    try {
      const newHistory = await addAgentContactHistory(agentId, {
        contactDate: formData.contactDate,
        contactMethodId: formData.contactMethodId,
        assignedTo: formData.assignedTo || null,
        customerParticipants: formData.customerParticipants || null,
        meetingMinutes: formData.meetingMinutes,
        note: formData.note,
        customerTypeIds: formData.customerTypeIds,
      });
      const historyWithNames = {
        ...newHistory,
        assignedToNames: getStaffNames(newHistory.assignedTo),
      } as unknown as ContactHistory;
      setHistories([historyWithNames, ...histories]);
      toast.success("接触履歴を追加しました");
      setIsAddMode(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const confirmEdit = () => {
    setPendingEditData(formData);
    setEditConfirm(true);
  };

  const handleUpdate = async () => {
    if (!editHistory || !pendingEditData?.contactDate) {
      toast.error("接触日時は必須です");
      return;
    }
    if (!pendingEditData.customerTypeIds || pendingEditData.customerTypeIds.length === 0) {
      toast.error("顧客種別を1つ以上選択してください");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateAgentContactHistory(editHistory.id, {
        contactDate: pendingEditData.contactDate,
        contactMethodId: pendingEditData.contactMethodId,
        assignedTo: pendingEditData.assignedTo || null,
        customerParticipants: pendingEditData.customerParticipants || null,
        meetingMinutes: pendingEditData.meetingMinutes,
        note: pendingEditData.note,
        customerTypeIds: pendingEditData.customerTypeIds,
      });
      const updatedWithNames = {
        ...updated,
        assignedToNames: getStaffNames(updated.assignedTo),
      } as unknown as ContactHistory;
      setHistories(
        histories.map((h) =>
          h.id === editHistory.id ? updatedWithNames : h
        )
      );
      toast.success("接触履歴を更新しました");
      setEditHistory(null);
      setFormData({});
      setEditConfirm(false);
      setPendingEditData(null);
    } catch {
      toast.error("更新に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setLoading(true);
    try {
      await deleteAgentContactHistory(deleteConfirm.id);
      setHistories(histories.filter((h) => h.id !== deleteConfirm.id));
      toast.success("接触履歴を削除しました");
      setDeleteConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const selectedStaffIds = (formData.assignedTo || "").split(",").filter(Boolean);

  // 選択されたプロジェクトに応じて担当者をフィルタリング
  const getAvailableStaffOptions = () => {
    const selectedCustomerTypeIds = formData.customerTypeIds || [];
    if (selectedCustomerTypeIds.length === 0) {
      return staffOptions; // プロジェクト未選択時は全スタッフ
    }

    // 選択されたcustomerTypeIdsからprojectIdを取得
    const selectedProjectIds = new Set<number>();
    selectedCustomerTypeIds.forEach((ctId) => {
      const ct = customerTypes.find((c) => c.id === ctId);
      if (ct) {
        selectedProjectIds.add(ct.projectId);
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

    const availableStaff = Array.from(availableStaffMap.values());
    // スタッフがいない場合は全スタッフを表示
    return availableStaff.length > 0 ? availableStaff : staffOptions;
  };

  const availableStaffOptions = getAvailableStaffOptions();

  const renderForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            接触日時 <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            selected={formData.contactDate ? new Date(formData.contactDate) : null}
            onChange={(date: Date | null) => {
              setFormData({
                ...formData,
                contactDate: date ? date.toISOString() : undefined,
              });
            }}
            showTimeSelect
            timeFormat="HH:mm"
            timeIntervals={15}
            dateFormat="yyyy/MM/dd HH:mm"
            locale="ja"
            placeholderText="日時を選択"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label>接触方法</Label>
          <Select
            value={formData.contactMethodId ? String(formData.contactMethodId) : ""}
            onValueChange={(v) =>
              setFormData({ ...formData, contactMethodId: v ? Number(v) : null })
            }
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
      <div className="space-y-2">
        <Label>担当者（複数選択可）</Label>
        <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between min-h-10 h-auto"
            >
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
          <PopoverContent className="w-[400px] p-0">
            <Command>
              <CommandInput placeholder="担当者を検索..." />
              <CommandList>
                <CommandEmpty>
                  {availableStaffOptions.length === 0
                    ? "選択されたプロジェクトに担当者が割り当てられていません"
                    : "見つかりませんでした"}
                </CommandEmpty>
                <CommandGroup>
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
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {/* 顧客種別選択（プロジェクトごとにグループ化） */}
      <div className="space-y-2">
        <Label>プロジェクト・顧客種別 <span className="text-destructive">*</span></Label>
        <div className="border rounded-lg p-3 space-y-4">
          {/* プロジェクトごとにグループ化 */}
          {(() => {
            const projectGroups = customerTypes.reduce((acc, ct) => {
              const projectName = ct.project.name;
              if (!acc[projectName]) {
                acc[projectName] = { projectId: ct.projectId, displayOrder: ct.project.displayOrder, types: [] };
              }
              acc[projectName].types.push(ct);
              return acc;
            }, {} as Record<string, { projectId: number; displayOrder: number; types: CustomerType[] }>);

            return Object.entries(projectGroups)
              .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
              .map(([projectName, group]) => (
                <div key={projectName}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{projectName}</p>
                  <div className="flex flex-wrap gap-4 ml-2">
                    {group.types.map((ct) => {
                      const isRequired = ct.id === REQUIRED_CUSTOMER_TYPE_ID;
                      const isChecked = (formData.customerTypeIds || []).includes(ct.id);
                      return (
                        <div key={ct.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`customer-type-${ct.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => handleCustomerTypeChange(ct.id, !!checked)}
                          />
                          <label
                            htmlFor={`customer-type-${ct.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {ct.name}
                            {isRequired && <span className="text-muted-foreground ml-1">（必須）</span>}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
          })()}
          {/* 必須顧客種別を外そうとした場合の警告 */}
          {requiredWarning && (
            <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                「{REQUIRED_CUSTOMER_TYPE_NAME}」を外す場合は、
                <a href="/stp/companies" className="underline font-medium">STP企業一覧</a>
                ページから接触履歴を追加してください。
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2"
                onClick={() => setRequiredWarning(false)}
              >
                閉じる
              </Button>
            </div>
          )}
        </div>
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
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditHistory(null);
            setFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddMode ? handleAdd : confirmEdit}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  // 日付でソート（降順）
  const sortedHistories = [...histories].sort(
    (a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime()
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>接触履歴管理 - {agentName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 追加ボタン */}
            {!isAddMode && !editHistory && (
              <div className="flex justify-end">
                <Button onClick={openAddForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  接触履歴を追加
                </Button>
              </div>
            )}

            {/* 追加/編集フォーム */}
            {(isAddMode || editHistory) && renderForm()}

            {/* 接触履歴一覧 */}
            {sortedHistories.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                接触履歴が登録されていません
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>接触日時</TableHead>
                    <TableHead>接触方法</TableHead>
                    <TableHead>担当者</TableHead>
                    <TableHead>先方参加者</TableHead>
                    <TableHead>議事録</TableHead>
                    <TableHead>備考</TableHead>
                    <TableHead className="w-[100px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistories.map((history) => (
                    <TableRow key={history.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(history.contactDate)}
                      </TableCell>
                      <TableCell>{history.contactMethodName || "-"}</TableCell>
                      <TableCell>{history.assignedToNames || getStaffNames(history.assignedTo)}</TableCell>
                      <TableCell>{history.customerParticipants || "-"}</TableCell>
                      <TableCell className="max-w-xs">
                        <div
                          className="overflow-y-auto whitespace-pre-wrap text-sm"
                          style={{ maxHeight: "4.5em", lineHeight: "1.5" }}
                        >
                          {history.meetingMinutes || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div
                          className="overflow-y-auto whitespace-pre-wrap text-sm"
                          style={{ maxHeight: "4.5em", lineHeight: "1.5" }}
                        >
                          {history.note || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditForm(history)}
                            disabled={isAddMode || !!editHistory}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(history)}
                            disabled={isAddMode || !!editHistory}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 編集確認ダイアログ */}
      <AlertDialog open={editConfirm} onOpenChange={setEditConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接触履歴を更新しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作により、接触履歴の内容が更新されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEditConfirm(false)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdate} disabled={loading}>
              {loading ? "更新中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>接触履歴を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm && (
                <>
                  {formatDateTime(deleteConfirm.contactDate)}の接触履歴を削除します。
                  この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirm(null)}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "削除中..." : "はい"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
