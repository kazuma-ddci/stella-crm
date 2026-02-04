"use client";

import { useState, useEffect } from "react";
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
  addMasterContract,
  getNextContractNumber,
} from "@/app/stp/master-contract-actions";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { CompanySearchCombobox } from "@/components/company-search-combobox";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";

// 日本語ロケールを登録
registerLocale("ja", ja);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  companyId: number | null;
  companyName: string;
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
  companyId: null,
  companyName: "",
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

export function ContractAddModal({
  open,
  onOpenChange,
  contractStatusOptions,
  staffOptions,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM_DATA);
  const [nextContractNumber, setNextContractNumber] = useState<string>("");

  // モーダルが開くたびに次の契約番号を取得
  useEffect(() => {
    if (open) {
      setFormData(EMPTY_FORM_DATA);
      getNextContractNumber()
        .then((number) => setNextContractNumber(number))
        .catch(console.error);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.companyId) {
      toast.error("企業を選択してください");
      return;
    }

    if (!formData.contractType || !formData.title) {
      toast.error("契約種別とタイトルは必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        contractType: formData.contractType,
        title: formData.title,
        startDate: formData.startDate?.toISOString() || null,
        endDate: formData.endDate?.toISOString() || null,
        currentStatusId: formData.currentStatusId ? Number(formData.currentStatusId) : null,
        signedDate: formData.signedDate?.toISOString() || null,
        signingMethod: formData.signingMethod || null,
        filePath: formData.filePath || null,
        fileName: formData.fileName || null,
        assignedTo: formData.assignedTo || null,
        note: formData.note || null,
      };

      const savedContractNumber = await addMasterContract(formData.companyId, data);
      toast.success(`契約書番号「${savedContractNumber}」で保存しました。`);

      setFormData(EMPTY_FORM_DATA);
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      console.error("Error saving contract:", error);
      toast.error("保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const datePickerClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>契約書を追加</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 企業選択 */}
          <div className="space-y-2">
            <Label>
              企業 <span className="text-red-500">*</span>
            </Label>
            <CompanySearchCombobox
              value={formData.companyId}
              onChange={(companyId, company) => {
                setFormData({
                  ...formData,
                  companyId: companyId,
                  companyName: company?.name || "",
                });
              }}
              placeholder="企業を検索..."
            />
          </div>

          {/* 契約番号プレビュー */}
          {nextContractNumber && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <p className="text-sm text-gray-700">
                この契約書データを作成すると契約書番号「<span className="font-mono font-bold">{nextContractNumber}</span>」で保存されます。
              </p>
            </div>
          )}

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
              />
            </div>

            {/* 担当者 */}
            <div className="col-span-2">
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
