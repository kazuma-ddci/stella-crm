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
import { Plus, Pencil, Trash2, X, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { TextPreviewCell } from "@/components/text-preview-cell";
import { FileUpload } from "@/components/file-upload";
import { toLocalDateString } from "@/lib/utils";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { useTimedFormCache } from "@/hooks/use-timed-form-cache";

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
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
  contractStatusOptions: { value: string; label: string }[];
  staffOptions: { value: string; label: string }[];
};

const contractTypeOptions = [
  { value: "業務委託契約", label: "業務委託契約" },
  { value: "秘密保持契約", label: "秘密保持契約" },
  { value: "代理店契約", label: "代理店契約" },
  { value: "利用規約同意書", label: "利用規約同意書" },
  { value: "その他", label: "その他" },
];

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
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM_DATA);
  const [localContracts, setLocalContracts] = useState<Contract[]>([]);
  const [nextContractNumber, setNextContractNumber] = useState<string>("");
  const [initialLoading, setInitialLoading] = useState(true);

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
    return staffOptions.find((o) => o.value === staffId)?.label || staffId;
  };

  const datePickerClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>契約書管理 - {companyName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 追加ボタン */}
          <div className="flex justify-end">
            <Button onClick={handleAdd} size="sm" disabled={formOpen}>
              <Plus className="h-4 w-4 mr-1" />
              契約書を追加
            </Button>
          </div>

          {/* フォーム（折りたたみ） */}
          {formOpen && (
            <div className="border rounded-lg p-4 bg-gray-50">
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

                  {/* 担当者 */}
                  <div>
                    <Label htmlFor="assignedTo">担当者</Label>
                    <Select
                      value={formData.assignedTo}
                      onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>契約番号</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>タイトル</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>締結日</TableHead>
                  <TableHead>締結方法</TableHead>
                  <TableHead>担当者</TableHead>
                  <TableHead>ファイル</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="w-[100px]">操作</TableHead>
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
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(contract)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(contract.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
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
    </Dialog>
  );
}
