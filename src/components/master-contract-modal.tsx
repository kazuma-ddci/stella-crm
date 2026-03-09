"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
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
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addMasterContract,
  updateMasterContract,
  deleteMasterContract,
  getNextContractNumber,
  getMasterContracts,
} from "@/app/stp/master-contract-actions";
import { Plus, Pencil, Trash2, X, FileText, ExternalLink, Send, Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { FileUpload } from "@/components/file-upload";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";
import { ContractSendModal } from "@/components/contract-send-modal";

// 日本語ロケールを登録
registerLocale("ja", ja);

type Contract = {
  id: number;
  contractType: string;
  title: string;
  contractNumber?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  currentStatusId?: number | null;
  currentStatusName?: string | null;
  signedDate?: string | null;
  signingMethod?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  assignedTo?: string | null;
  note?: string | null;
  cloudsignDocumentId?: string | null;
  cloudsignStatus?: string | null;
  cloudsignUrl?: string | null;
  cloudsignAutoSync?: boolean;
  cloudsignExpectedStatusName?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  contractStatusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
};

const signingMethodOptions = [
  { value: "cloudsign", label: "クラウドサイン" },
  { value: "paper", label: "紙" },
  { value: "other", label: "その他" },
];

type FormData = {
  contractType: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  currentStatusId: string;
  signedDate: Date | null;
  signingMethod: string;
  filePath: string;
  fileName: string;
  assignedTo: string;
  note: string;
};

const EMPTY_FORM_DATA: FormData = {
  contractType: "",
  title: "",
  startDate: null,
  endDate: null,
  currentStatusId: "",
  signedDate: null,
  signingMethod: "",
  filePath: "",
  fileName: "",
  assignedTo: "",
  note: "",
};

export function MasterContractModal({
  open,
  onOpenChange,
  companyId,
  companyName,
  contractStatusOptions,
  staffOptions,
  contractTypeOptions,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM_DATA);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [nextContractNumber, setNextContractNumber] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [syncingContractId, setSyncingContractId] = useState<number | null>(null);
  const [togglingAutoSyncId, setTogglingAutoSyncId] = useState<number | null>(null);

  // 下書き管理
  const [draftSelectOpen, setDraftSelectOpen] = useState(false);
  const [drafts, setDrafts] = useState<{
    id: number;
    contractNumber: string;
    title: string;
    contractType: string;
    cloudsignDocumentId: string | null;
    cloudsignTitle: string | null;
    assignedTo: string | null;
    note: string | null;
    createdAt: string;
  }[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);
  const [resumeDraft, setResumeDraft] = useState<{
    contractId: number;
    contractNumber: string;
    cloudsignDocumentId: string;
    contractType: string;
    title: string;
    cloudsignTitle?: string | null;
    assignedTo?: string | null;
    note?: string | null;
  } | undefined>(undefined);

  // CloudSign送付モーダル用のデータ（遅延ロード）
  const [cloudsignData, setCloudsignData] = useState<{
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null>(null);
  const [loadingCloudsign, setLoadingCloudsign] = useState(false);

  type CachedState = {
    formData: FormData;
    editingId: number | null;
    formOpen: boolean;
    nextContractNumber: string;
  };
  const { restore, save, clear } = useTimedFormCache<CachedState>(
    `master-contract-${companyId}`
  );
  const formStateRef = useRef<CachedState>({
    formData: EMPTY_FORM_DATA,
    editingId: null,
    formOpen: false,
    nextContractNumber: "",
  });
  formStateRef.current = { formData, editingId, formOpen, nextContractNumber };

  // クローズ時にキャッシュ保存
  useEffect(() => {
    if (!open) return;
    return () => {
      save(formStateRef.current);
    };
  }, [open, save]);

  // モーダルが開くたびにサーバーから最新データを取得
  const loadContracts = useCallback(async () => {
    setInitialLoading(true);
    try {
      const data = await getMasterContracts(companyId);
      setLocalContracts(data);
    } catch (error) {
      console.error("Error fetching contracts:", error);
    } finally {
      setInitialLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      loadContracts();
      const cached = restore();
      if (cached) {
        setFormData(cached.formData);
        setEditingId(cached.editingId);
        setFormOpen(cached.formOpen);
        setNextContractNumber(cached.nextContractNumber);
      } else {
        setFormData(EMPTY_FORM_DATA);
        setEditingId(null);
        setFormOpen(false);
        setNextContractNumber("");
      }
    }
  }, [open, loadContracts, restore]);

  const resetForm = () => {
    setFormData(EMPTY_FORM_DATA);
    setEditingId(null);
    setFormOpen(false);
    setNextContractNumber("");
  };

  const handleAdd = async () => {
    resetForm();
    setFormOpen(true);
    // 次の契約番号を取得
    try {
      const number = await getNextContractNumber();
      setNextContractNumber(number);
    } catch (error) {
      console.error("Error fetching next contract number:", error);
    }
  };

  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    return new Date(dateStr);
  };

  const handleEdit = (contract: Contract) => {
    setFormData({
      contractType: contract.contractType || "",
      title: contract.title || "",
      startDate: parseDate(contract.startDate),
      endDate: parseDate(contract.endDate),
      currentStatusId: contract.currentStatusId ? String(contract.currentStatusId) : "",
      signedDate: parseDate(contract.signedDate),
      signingMethod: contract.signingMethod || "",
      filePath: contract.filePath || "",
      fileName: contract.fileName || "",
      assignedTo: contract.assignedTo || "",
      note: contract.note || "",
    });
    setEditingId(contract.id);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この契約書を削除してもよろしいですか？")) return;

    try {
      await deleteMasterContract(id);
      setLocalContracts((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (error) {
      console.error("Error deleting contract:", error);
      alert("削除に失敗しました");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.contractType || !formData.title) {
      alert("契約種別とタイトルは必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        contractType: formData.contractType,
        title: formData.title,
        startDate: formData.startDate ? toLocalDateString(formData.startDate) : null,
        endDate: formData.endDate ? toLocalDateString(formData.endDate) : null,
        currentStatusId: formData.currentStatusId ? Number(formData.currentStatusId) : null,
        signedDate: formData.signedDate ? toLocalDateString(formData.signedDate) : null,
        signingMethod: formData.signingMethod || null,
        filePath: formData.filePath || null,
        fileName: formData.fileName || null,
        assignedTo: formData.assignedTo || null,
        note: formData.note || null,
      };

      if (editingId) {
        await updateMasterContract(editingId, data);
        toast.success("契約書を更新しました");
      } else {
        const savedContractNumber = await addMasterContract(companyId, data);
        toast.success(`契約書番号「${savedContractNumber}」で保存しました。`);
      }

      resetForm();
      // 最新データを再取得
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("ja-JP");
  };

  const getSigningMethodLabel = (method: string | null | undefined) => {
    if (!method) return "-";
    return signingMethodOptions.find((o) => o.value === method)?.label || method;
  };

  const getStaffName = (staffId: string | null | undefined) => {
    if (!staffId) return "-";
    return staffId
      .split(",")
      .map((id) => staffOptions.find((o) => o.value === id.trim())?.label || id.trim())
      .join(", ");
  };

  const datePickerClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="mixed"
        className="p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>契約書管理 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* 追加・送付ボタン */}
          <div className="flex justify-end gap-2 shrink-0">
            <Button
              onClick={async () => {
                // CloudSignデータを取得
                if (!cloudsignData) {
                  setLoadingCloudsign(true);
                  try {
                    const { getCloudsignModalData } = await import("@/app/stp/cloudsign-actions");
                    const data = await getCloudsignModalData(companyId);
                    setCloudsignData(data);
                    if (!data.operatingCompany?.cloudsignClientId) {
                      toast.error("運営法人にクラウドサインのクライアントIDが設定されていません。設定画面から登録してください。");
                      return;
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error("クラウドサイン情報の取得に失敗しました");
                    return;
                  } finally {
                    setLoadingCloudsign(false);
                  }
                }

                // 下書きをチェック
                setLoadingDrafts(true);
                try {
                  const { getDraftsForCompany } = await import("@/app/stp/cloudsign-actions");
                  const existingDrafts = await getDraftsForCompany(companyId);
                  if (existingDrafts.length > 0) {
                    setDrafts(existingDrafts);
                    setDraftSelectOpen(true);
                  } else {
                    setResumeDraft(undefined);
                    setSendModalOpen(true);
                  }
                } catch (error) {
                  console.error(error);
                  // 下書きチェック失敗でも送付モーダルは開ける
                  setResumeDraft(undefined);
                  setSendModalOpen(true);
                } finally {
                  setLoadingDrafts(false);
                }
              }}
              size="sm"
              variant="outline"
              disabled={formOpen || loadingCloudsign || loadingDrafts}
            >
              <Send className="h-4 w-4 mr-1" />
              {loadingCloudsign || loadingDrafts ? "読込中..." : "契約書を送付"}
            </Button>
            <Button onClick={handleAdd} size="sm" disabled={formOpen}>
              <Plus className="h-4 w-4 mr-1" />
              契約書を追加
            </Button>
          </div>

          {/* フォーム（折りたたみ） */}
          {formOpen && (
            <div className="border rounded-lg p-4 bg-gray-50 shrink-0 max-h-[50vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">
                  {editingId ? "契約書を編集" : "新規契約書を追加"}
                </h3>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* 新規作成時の契約番号プレビュー */}
              {!editingId && nextContractNumber && (
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    この契約書データを作成すると契約書番号「<span className="font-mono font-bold">{nextContractNumber}</span>」で保存されます。
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 契約種別 */}
                  <div>
                    <Label htmlFor="contractType">
                      契約種別 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* タイトル */}
                  <div>
                    <Label htmlFor="title">
                      タイトル <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="契約書タイトル"
                    />
                  </div>

                  {/* ステータス */}
                  <div>
                    <Label htmlFor="currentStatusId">ステータス</Label>
                    <Select
                      value={formData.currentStatusId}
                      onValueChange={(value) => setFormData({ ...formData, currentStatusId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractStatusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 締結方法 */}
                  <div>
                    <Label htmlFor="signingMethod">締結方法</Label>
                    <Select
                      value={formData.signingMethod}
                      onValueChange={(value) => setFormData({ ...formData, signingMethod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {signingMethodOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 締結日 */}
                  <div>
                    <Label htmlFor="signedDate">締結日</Label>
                    <DatePicker
                      selected={formData.signedDate}
                      onChange={(date: Date | null) => setFormData({ ...formData, signedDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>

                  {/* 契約開始日 */}
                  <div>
                    <Label htmlFor="startDate">契約開始日</Label>
                    <DatePicker
                      selected={formData.startDate}
                      onChange={(date: Date | null) => setFormData({ ...formData, startDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>

                  {/* 契約終了日 */}
                  <div>
                    <Label htmlFor="endDate">契約終了日</Label>
                    <DatePicker
                      selected={formData.endDate}
                      onChange={(date: Date | null) => setFormData({ ...formData, endDate: date })}
                      dateFormat="yyyy/MM/dd"
                      locale="ja"
                      placeholderText="日付を選択"
                      isClearable
                      className={datePickerClassName}
                      wrapperClassName="w-full"
                      calendarClassName="shadow-lg"
                    />
                  </div>

                  {/* 契約書ファイル */}
                  <div className="col-span-2">
                    <Label htmlFor="fileUpload">契約書ファイル</Label>
                    <FileUpload
                      value={{
                        filePath: formData.filePath || null,
                        fileName: formData.fileName || null,
                      }}
                      onChange={(newValue) => {
                        setFormData({
                          ...formData,
                          filePath: newValue.filePath || "",
                          fileName: newValue.fileName || "",
                        });
                      }}
                      contractId={editingId || undefined}
                    />
                  </div>

                  {/* 担当者（複数選択可） */}
                  <div className="col-span-2">
                    <Label htmlFor="assignedTo">担当者</Label>
                    <MultiSelectCombobox
                      options={staffOptions}
                      value={formData.assignedTo ? formData.assignedTo.split(",").filter(Boolean) : []}
                      onChange={(values) => setFormData({ ...formData, assignedTo: values.join(",") })}
                      placeholder="担当者を選択"
                    />
                  </div>
                </div>

                {/* 備考 */}
                <div>
                  <Label htmlFor="note">備考</Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="備考"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "保存中..." : "保存"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 契約書一覧テーブル */}
          {initialLoading ? (
            <div className="text-center py-8 text-gray-500">
              読み込み中...
            </div>
          ) : localContracts.length > 0 ? (
            <Table containerClassName="border rounded-lg flex-1 min-h-0" containerStyle={{ overflow: 'auto' }}>
              <TableHeader>
                <TableRow>
                  <TableHead>契約番号</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>タイトル</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>締結日</TableHead>
                  <TableHead>締結方法</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>クラウドサイン</TableHead>
                  <TableHead>ファイル</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="w-[100px] sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localContracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-sm">{contract.contractNumber || "-"}</TableCell>
                    <TableCell className="font-medium">{contract.contractType}</TableCell>
                    <TableCell>{contract.title}</TableCell>
                    <TableCell>{contract.currentStatusName || "-"}</TableCell>
                    <TableCell>{formatDate(contract.signedDate)}</TableCell>
                    <TableCell>{getSigningMethodLabel(contract.signingMethod)}</TableCell>
                    <TableCell>{getStaffName(contract.assignedTo)}</TableCell>
                    <TableCell>
                      {contract.cloudsignDocumentId ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(contract.cloudsignUrl || `https://www.cloudsign.jp/documents/${contract.cloudsignDocumentId}`, "_blank")}
                            className="flex items-center gap-1 text-blue-600 text-xs px-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {contract.cloudsignStatus === "sent" ? "送付済" :
                             contract.cloudsignStatus === "completed" ? "締結済" :
                             contract.cloudsignStatus === "draft" ? "下書き" :
                             contract.cloudsignStatus?.startsWith("canceled") ? "破棄" :
                             contract.cloudsignStatus || "-"}
                          </Button>
                          {/* ステータス不一致警告 */}
                          {contract.cloudsignExpectedStatusName &&
                           contract.currentStatusName &&
                           contract.currentStatusName !== contract.cloudsignExpectedStatusName && (
                            <span
                              className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 cursor-help"
                              title={`CRM: ${contract.currentStatusName} / CloudSign: ${contract.cloudsignExpectedStatusName}`}
                            >
                              不一致
                            </span>
                          )}
                          {/* 自動同期停止中 */}
                          {contract.cloudsignAutoSync === false && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              同期停止
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contract.filePath && contract.fileName ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(contract.filePath!, "_blank")}
                          className="flex items-center gap-1 text-blue-600"
                        >
                          <FileText className="h-4 w-4" />
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <TextPreviewCell text={contract.note} title="備考" />
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="flex gap-1">
                        {/* CloudSign連携: 手動同期ボタン */}
                        {contract.cloudsignDocumentId && contract.cloudsignStatus !== "draft" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="CloudSignから最新ステータスを取得"
                            disabled={syncingContractId === contract.id}
                            onClick={async () => {
                              setSyncingContractId(contract.id);
                              try {
                                const { syncContractCloudsignStatus } = await import("@/app/stp/cloudsign-actions");
                                const result = await syncContractCloudsignStatus(contract.id);
                                if (result.previousStatus === result.newStatus) {
                                  toast.info("ステータスに変更はありません");
                                } else {
                                  toast.success(`ステータスを同期しました: ${result.previousStatus} → ${result.newStatus}`);
                                }
                                await loadContracts();
                                router.refresh();
                              } catch (error) {
                                console.error(error);
                                toast.error("同期に失敗しました");
                              } finally {
                                setSyncingContractId(null);
                              }
                            }}
                          >
                            {syncingContractId === contract.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4 text-blue-500" />
                            )}
                          </Button>
                        )}
                        {/* CloudSign連携: 自動同期ON/OFFトグル */}
                        {contract.cloudsignDocumentId && contract.cloudsignStatus !== "draft" &&
                         contract.cloudsignStatus !== "completed" &&
                         !contract.cloudsignStatus?.startsWith("canceled") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={contract.cloudsignAutoSync ? "自動同期をOFFにする" : "自動同期をONにする"}
                            disabled={togglingAutoSyncId === contract.id}
                            onClick={async () => {
                              const newState = !contract.cloudsignAutoSync;
                              if (!newState) {
                                if (!confirm("CloudSign側のステータス変更がCRMに反映されなくなります。よろしいですか？")) return;
                              }
                              setTogglingAutoSyncId(contract.id);
                              try {
                                const { toggleCloudsignAutoSync } = await import("@/app/stp/cloudsign-actions");
                                await toggleCloudsignAutoSync(contract.id, newState);
                                toast.success(newState ? "自動同期をONにしました" : "自動同期をOFFにしました");
                                await loadContracts();
                                router.refresh();
                              } catch (error) {
                                console.error(error);
                                toast.error("切替に失敗しました");
                              } finally {
                                setTogglingAutoSyncId(null);
                              }
                            }}
                            className={contract.cloudsignAutoSync ? "text-green-600" : "text-gray-400"}
                          >
                            {togglingAutoSyncId === contract.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : contract.cloudsignAutoSync ? (
                              <span className="text-[10px] font-bold">自動</span>
                            ) : (
                              <span className="text-[10px]">停止</span>
                            )}
                          </Button>
                        )}
                        {contract.cloudsignStatus === "draft" && contract.cloudsignDocumentId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="送付を再開"
                            onClick={async () => {
                              // CloudSignデータを取得
                              if (!cloudsignData) {
                                setLoadingCloudsign(true);
                                try {
                                  const { getCloudsignModalData } = await import("@/app/stp/cloudsign-actions");
                                  const data = await getCloudsignModalData(companyId);
                                  setCloudsignData(data);
                                  if (!data.operatingCompany?.cloudsignClientId) {
                                    toast.error("クラウドサインのクライアントIDが未設定です");
                                    return;
                                  }
                                } catch (error) {
                                  console.error(error);
                                  toast.error("クラウドサイン情報の取得に失敗しました");
                                  return;
                                } finally {
                                  setLoadingCloudsign(false);
                                }
                              }
                              setResumeDraft({
                                contractId: contract.id,
                                contractNumber: contract.contractNumber || "",
                                cloudsignDocumentId: contract.cloudsignDocumentId!,
                                contractType: contract.contractType,
                                title: contract.title,
                              });
                              setSendModalOpen(true);
                            }}
                          >
                            <Play className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contract)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {contract.cloudsignStatus === "draft" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={deletingDraftId === contract.id}
                            onClick={async () => {
                              if (!confirm("この下書きを削除しますか？CloudSign側のドラフトも削除されます。")) return;
                              setDeletingDraftId(contract.id);
                              try {
                                const { deleteDraftContract } = await import("@/app/stp/cloudsign-actions");
                                await deleteDraftContract(contract.id);
                                toast.success("下書きを削除しました");
                                await loadContracts();
                                router.refresh();
                              } catch (error) {
                                console.error(error);
                                toast.error("削除に失敗しました");
                              } finally {
                                setDeletingDraftId(null);
                              }
                            }}
                          >
                            {deletingDraftId === contract.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(contract.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              契約書が登録されていません
            </div>
          )}
        </div>
      </DialogContent>

      {/* 下書き選択ダイアログ */}
      <Dialog open={draftSelectOpen} onOpenChange={setDraftSelectOpen}>
        <DialogContent size="form" className="p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>下書きが{drafts.length}件あります</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {drafts.map((draft) => (
              <div key={draft.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{draft.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {draft.contractType} ・ {draft.contractNumber}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      作成: {new Date(draft.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResumeDraft({
                          contractId: draft.id,
                          contractNumber: draft.contractNumber,
                          cloudsignDocumentId: draft.cloudsignDocumentId || "",
                          contractType: draft.contractType,
                          title: draft.title,
                          cloudsignTitle: draft.cloudsignTitle,
                          assignedTo: draft.assignedTo,
                          note: draft.note,
                        });
                        setDraftSelectOpen(false);
                        setSendModalOpen(true);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      再開
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deletingDraftId === draft.id}
                      onClick={async () => {
                        if (!confirm("この下書きを削除しますか？")) return;
                        setDeletingDraftId(draft.id);
                        try {
                          const { deleteDraftContract } = await import("@/app/stp/cloudsign-actions");
                          await deleteDraftContract(draft.id);
                          toast.success("下書きを削除しました");
                          setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
                          await loadContracts();
                          // 下書きが全部削除された場合はダイアログを閉じて新規作成へ
                          if (drafts.length <= 1) {
                            setDraftSelectOpen(false);
                            setResumeDraft(undefined);
                            setSendModalOpen(true);
                          }
                        } catch (error) {
                          console.error(error);
                          toast.error("削除に失敗しました");
                        } finally {
                          setDeletingDraftId(null);
                        }
                      }}
                    >
                      {deletingDraftId === draft.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t shrink-0 flex justify-between">
            <Button variant="outline" onClick={() => setDraftSelectOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                setDraftSelectOpen(false);
                setResumeDraft(undefined);
                setSendModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新規で作成
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 契約書送付モーダル */}
      {cloudsignData && cloudsignData.operatingCompany && (
        <ContractSendModal
          open={sendModalOpen}
          onOpenChange={(v) => {
            setSendModalOpen(v);
            if (!v) setResumeDraft(undefined);
          }}
          companyId={companyId}
          companyName={companyName}
          projectId={cloudsignData.projectId}
          contractTypes={cloudsignData.contractTypes}
          contacts={cloudsignData.contacts}
          operatingCompany={cloudsignData.operatingCompany}
          staffOptions={staffOptions}
          onSuccess={loadContracts}
          resumeDraft={resumeDraft}
        />
      )}
    </Dialog>
  );
}
