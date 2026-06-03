"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  type ApplicationBpoAttachments,
  type ApplicationBpoField,
  type ApplicationBpoFileInfo,
  groupApplicationBpoFields,
  STAFF_BPO_FIELDS,
  VENDOR_BPO_FIELDS,
} from "@/lib/hojo/application-bpo-fields";
import {
  createApplicationBpoRequestByVendor,
  deleteApplicationBpoRequestByStaff,
  deleteApplicationBpoRequestByVendor,
  updateApplicationBpoRequestByStaff,
  updateApplicationBpoRequestByVendor,
} from "./actions";

export type ApplicationBpoRow = {
  id: number;
  vendorId: number;
  vendorName: string;
  vendorCustomerNo: number;
  requestDate: string;
  doubleCheckStatus: string;
  scheduledAt: string;
  companyName: string;
  applicantType: string;
  repeatType: string;
  wageIncreaseAvailability: string;
  completionDate: string;
  nextAction: string;
  vendorInput: Record<string, unknown>;
  staffInput: Record<string, unknown>;
  attachments: ApplicationBpoAttachments;
  staffMemo: string;
};

type Props = {
  data: ApplicationBpoRow[];
  mode: "staff" | "vendor";
  vendorId?: number;
  canEdit?: boolean;
};

type EditState = {
  id: number | null;
  vendorInput: Record<string, string>;
  staffInput: Record<string, string>;
  attachments: ApplicationBpoAttachments;
  staffMemo: string;
  originalVendorInput: Record<string, string>;
  originalAttachments: ApplicationBpoAttachments;
};

function asStringRecord(input: Record<string, unknown> | null | undefined) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === null || value === undefined) continue;
    result[key] = String(value);
  }
  return result;
}

function normalizeAttachments(input: ApplicationBpoAttachments | null | undefined): ApplicationBpoAttachments {
  const result: ApplicationBpoAttachments = {};
  for (const [key, files] of Object.entries(input ?? {})) {
    if (Array.isArray(files)) result[key] = files;
  }
  return result;
}

function formatDate(value: string) {
  return value ? value.replace(/-/g, "/") : "-";
}

function hasVendorSideChange(state: EditState) {
  return (
    JSON.stringify(state.vendorInput) !== JSON.stringify(state.originalVendorInput) ||
    JSON.stringify(state.attachments) !== JSON.stringify(state.originalAttachments)
  );
}

function emptyState(): EditState {
  return {
    id: null,
    vendorInput: {},
    staffInput: {},
    attachments: {},
    staffMemo: "",
    originalVendorInput: {},
    originalAttachments: {},
  };
}

function stateFromRow(row: ApplicationBpoRow): EditState {
  const vendorInput = asStringRecord(row.vendorInput);
  const attachments = normalizeAttachments(row.attachments);
  return {
    id: row.id,
    vendorInput,
    staffInput: asStringRecord(row.staffInput),
    attachments,
    staffMemo: row.staffMemo,
    originalVendorInput: { ...vendorInput },
    originalAttachments: JSON.parse(JSON.stringify(attachments)) as ApplicationBpoAttachments,
  };
}

function fieldLayoutClass(field: ApplicationBpoField) {
  const compactKeys = new Set([
    "doubleCheckStatus",
    "applicantType",
    "repeatType",
    "wageIncreaseAvailability",
    "hasEmployees",
    "minimumWagePoint1",
    "minimumWagePoint2",
  ]);
  const shortKeys = new Set([
    "requestDate",
    "establishedDate",
    "fiscalMonth",
    "completionDate",
  ]);
  const mediumKeys = new Set([
    "repeatTypeComment",
    "wageIncreaseComment",
    "scheduledAt",
    "companyName",
    "vendorName",
    "accountId",
    "accountPassword",
    "gbizEmail",
    "selfDeclarationId",
    "capitalText",
    "securityCloudSystemName",
    "securityCloudSystemNo",
    "mimamoriSystemName",
    "mimamoriSystemNo",
  ]);

  if (field.type === "textarea") return "space-y-1 md:col-span-12";
  if (field.type === "file") return "space-y-1 md:col-span-6 xl:col-span-4";
  if (compactKeys.has(field.key)) return "space-y-1 md:col-span-3 xl:col-span-2";
  if (shortKeys.has(field.key)) return "space-y-1 md:col-span-4 xl:col-span-3";
  if (field.type === "number") return "space-y-1 md:col-span-3";
  if (mediumKeys.has(field.key)) return "space-y-1 md:col-span-6 xl:col-span-4";
  return "space-y-1 md:col-span-6";
}

const pairedFieldKeys: Record<string, string> = {
  repeatType: "repeatTypeComment",
  wageIncreaseAvailability: "wageIncreaseComment",
};

const pairedCommentKeys = new Set(Object.values(pairedFieldKeys));
const ESTABLISHED_DATE_START_MONTH = new Date(1900, 0);
const DATE_PICKER_END_MONTH = new Date(new Date().getFullYear() + 5, 11);

export function ApplicationBpoTable({ data, mode, vendorId, canEdit = true }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditState | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<"request" | "bpo">("request");
  const [isPending, startTransition] = useTransition();
  const groupedVendorFields = useMemo(() => groupApplicationBpoFields(VENDOR_BPO_FIELDS), []);
  const groupedStaffFields = useMemo(() => groupApplicationBpoFields(STAFF_BPO_FIELDS), []);
  const canCreate = canEdit && mode === "vendor" && !!vendorId;

  const updateInput = (role: "vendor" | "staff", key: string, value: string) => {
    setEditing((current) => {
      if (!current) return current;
      const targetKey = role === "vendor" ? "vendorInput" : "staffInput";
      return {
        ...current,
        [targetKey]: {
          ...current[targetKey],
          [key]: value,
        },
      };
    });
  };

  const updateAttachments = (fieldKey: string, files: ApplicationBpoFileInfo[]) => {
    setEditing((current) => {
      if (!current) return current;
      return {
        ...current,
        attachments: {
          ...current.attachments,
          [fieldKey]: files,
        },
      };
    });
  };

  const handleUpload = async (field: ApplicationBpoField, fileList: FileList | null) => {
    if (!fileList?.length || !editing) return;
    const uploaded: ApplicationBpoFileInfo[] = [];
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldKey", field.key);
      const response = await fetch("/api/hojo/application-bpo/upload", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? "アップロードに失敗しました");
        return;
      }
      uploaded.push({
        filePath: json.filePath,
        fileName: json.fileName,
        fileSize: json.fileSize,
        mimeType: json.mimeType,
      });
    }
    updateAttachments(field.key, [...(editing.attachments[field.key] ?? []), ...uploaded]);
  };

  const openCreate = () => {
    setActiveEditTab("request");
    setEditing(emptyState());
  };
  const openEdit = (row: ApplicationBpoRow) => {
    setActiveEditTab(mode === "staff" ? "bpo" : "request");
    setEditing(stateFromRow(row));
  };

  const save = () => {
    if (!editing) return;
    if (mode === "staff" && hasVendorSideChange(editing)) {
      const confirmed = window.confirm("本来はベンダー側が入力する部分ですが、上書きしてよろしいですか？");
      if (!confirmed) return;
    }
    startTransition(async () => {
      const result = mode === "vendor"
        ? editing.id
          ? await updateApplicationBpoRequestByVendor(editing.id, vendorId!, {
            vendorInput: editing.vendorInput,
            attachments: editing.attachments,
          })
          : await createApplicationBpoRequestByVendor(vendorId!, {
            vendorInput: editing.vendorInput,
            attachments: editing.attachments,
          })
        : await updateApplicationBpoRequestByStaff(editing.id!, {
          vendorInput: editing.vendorInput,
          staffInput: editing.staffInput,
          attachments: editing.attachments,
          staffMemo: editing.staffMemo,
        });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("保存しました");
      setEditing(null);
      router.refresh();
    });
  };

  const remove = (row: ApplicationBpoRow) => {
    if (!window.confirm("削除してよろしいですか？")) return;
    startTransition(async () => {
      const result = mode === "vendor"
        ? await deleteApplicationBpoRequestByVendor(row.id, vendorId!)
        : await deleteApplicationBpoRequestByStaff(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("削除しました");
      router.refresh();
    });
  };

  const renderField = (field: ApplicationBpoField, role: "vendor" | "staff", editable: boolean) => {
    if (!editing) return null;
    const value = role === "vendor"
      ? editing.vendorInput[field.key] ?? ""
      : editing.staffInput[field.key] ?? "";

    if (field.type === "file") {
      const files = editing.attachments[field.key] ?? [];
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {files.length === 0 ? <span className="text-sm text-muted-foreground">未アップロード</span> : files.map((file, index) => (
              <span key={`${file.filePath}-${index}`} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                <a href={file.filePath} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {file.fileName}
                </a>
                {editable && (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-red-600"
                    onClick={() => updateAttachments(field.key, files.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {editable && (
            <Label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              アップロード
              <input type="file" multiple className="hidden" onChange={(e) => handleUpload(field, e.target.files)} />
            </Label>
          )}
        </div>
      );
    }

    if (!editable) {
      return <div className="min-h-9 rounded-md border bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap break-words">{value || "-"}</div>;
    }

    if (field.type === "textarea") {
      return (
        <Textarea
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => updateInput(role, field.key, e.target.value)}
          className="min-h-[96px]"
        />
      );
    }
    if (field.type === "date") {
      if (field.key === "establishedDate") {
        return (
          <DatePicker
            value={value}
            placeholder={field.placeholder || "日付を選択"}
            onChange={(next) => updateInput(role, field.key, next)}
            captionLayout="dropdown"
            startMonth={ESTABLISHED_DATE_START_MONTH}
            endMonth={DATE_PICKER_END_MONTH}
          />
        );
      }
      return (
        <DatePicker
          value={value}
          placeholder={field.placeholder || "日付を選択"}
          onChange={(next) => updateInput(role, field.key, next)}
        />
      );
    }
    if (field.type === "datetime") {
      return (
        <DateTimePicker
          value={value}
          placeholder={field.placeholder || "日時を選択"}
          onChange={(next) => updateInput(role, field.key, next)}
        />
      );
    }
    if (field.type === "select") {
      return (
        <Select value={value || undefined} onValueChange={(next) => updateInput(role, field.key, next)}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || "選択"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => updateInput(role, field.key, e.target.value)}
      />
    );
  };

  const renderGroups = (groups: { name: string; fields: ApplicationBpoField[] }[], role: "vendor" | "staff") => (
    <div className="space-y-5">
      {groups.map((group, groupIndex) => (
        <section key={`${role}-${group.name}-${groupIndex}`} className="space-y-3">
          <h3 className="border-b pb-1 text-sm font-semibold text-muted-foreground">{group.name}</h3>
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-12">
            {group.fields.map((field) => {
              const pairedFieldKey = pairedFieldKeys[field.key];
              if (pairedFieldKey) {
                const pairedField = group.fields.find((candidate) => candidate.key === pairedFieldKey);
                if (pairedField) {
                  const fieldEditable = canEdit && (mode === "staff" || field.role === mode);
                  const pairedFieldEditable = canEdit && (mode === "staff" || pairedField.role === mode);
                  return (
                    <div key={`${field.key}-${pairedField.key}`} className="grid gap-x-3 gap-y-3 md:col-span-12 md:grid-cols-[minmax(140px,180px)_minmax(0,1fr)] xl:col-span-6">
                      <div className="space-y-1">
                        <Label className="text-sm">
                          {field.label}
                        </Label>
                        {renderField(field, role, fieldEditable)}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">
                          {pairedField.label}
                        </Label>
                        {renderField(pairedField, role, pairedFieldEditable)}
                      </div>
                    </div>
                  );
                }
              }
              if (pairedCommentKeys.has(field.key)) return null;
              const editable = canEdit && (mode === "staff" || field.role === mode);
              return (
                <div key={field.key} className={fieldLayoutClass(field)}>
                  <Label className="text-sm">
                    {field.label}
                  </Label>
                  {renderField(field, role, editable)}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">BPO 申請顧客情報</h2>
          <p className="text-sm text-muted-foreground">一覧は主要項目のみ表示しています。詳細から全項目を確認・編集できます。</p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />新規追加
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>顧客No.</TableHead>
              {mode === "staff" && <TableHead>ベンダー</TableHead>}
              {mode === "staff" && <TableHead>ベンダー側顧客No.</TableHead>}
              <TableHead>依頼日</TableHead>
              <TableHead>正誤チェック</TableHead>
              <TableHead>事業者名</TableHead>
              <TableHead>事業体</TableHead>
              <TableHead>おかわり判定</TableHead>
              <TableHead>賃上げ可否</TableHead>
              <TableHead>完了日</TableHead>
              <TableHead>次回</TableHead>
              <TableHead className="w-[160px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={mode === "staff" ? 12 : 10} className="py-10 text-center text-muted-foreground">データがありません</TableCell></TableRow>
            ) : data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{mode === "staff" ? row.id : row.vendorCustomerNo}</TableCell>
                {mode === "staff" && <TableCell>{row.vendorName}</TableCell>}
                {mode === "staff" && <TableCell>{row.vendorCustomerNo}</TableCell>}
                <TableCell>{formatDate(row.requestDate)}</TableCell>
                <TableCell>{row.doubleCheckStatus || "-"}</TableCell>
                <TableCell className="min-w-[180px]">{row.companyName || "-"}</TableCell>
                <TableCell>{row.applicantType || "-"}</TableCell>
                <TableCell>{row.repeatType || "-"}</TableCell>
                <TableCell>{row.wageIncreaseAvailability || "-"}</TableCell>
                <TableCell>{formatDate(row.completionDate)}</TableCell>
                <TableCell className="max-w-[220px] truncate">{row.nextAction || "-"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                      {canEdit ? <Pencil className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                      {canEdit ? "編集" : "詳細"}
                    </Button>
                    {canEdit && (
                      <Button type="button" size="sm" variant="outline" onClick={() => remove(row)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent size="fullwidth" className="flex max-h-[92vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "BPO 申請顧客情報 詳細" : "BPO 申請顧客情報 新規追加"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto pr-2">
              <Tabs value={activeEditTab} onValueChange={(value) => setActiveEditTab(value as "request" | "bpo")} className="space-y-5">
                <TabsList>
                  <TabsTrigger value="request">依頼情報</TabsTrigger>
                  <TabsTrigger value="bpo">BPO側</TabsTrigger>
                </TabsList>
                <TabsContent value="request" className="mt-0">
                  {renderGroups(groupedVendorFields, "vendor")}
                </TabsContent>
                <TabsContent value="bpo" className="mt-0 space-y-7">
                  {renderGroups(groupedStaffFields, "staff")}
                  {mode === "staff" && (
                    <section className="space-y-3">
                      <h3 className="border-b pb-1 text-sm font-semibold text-muted-foreground">弊社専用</h3>
                      <div className="space-y-1">
                        <Label>弊社専用備考</Label>
                        <Textarea
                          value={editing.staffMemo}
                          onChange={(e) => setEditing((current) => current ? { ...current, staffMemo: e.target.value } : current)}
                          className="min-h-[120px]"
                        />
                      </div>
                    </section>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={isPending}>キャンセル</Button>
            <Button type="button" onClick={save} disabled={!canEdit || isPending || (mode === "staff" && !editing?.id)}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
