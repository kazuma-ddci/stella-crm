"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import {
  addContract,
  updateContract,
  deleteContract,
} from "./contract-actions";

registerLocale("ja", ja);

type Contract = {
  id: number;
  contractUrl: string;
  signedDate: string | null;
  title: string | null;
  externalId: string | null;
  externalService: string | null;
  status: string;
  note: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: number;
  agentName: string;
  contracts: Record<string, unknown>[];
};

const contractStatusOptions = [
  { value: "draft", label: "下書き" },
  { value: "pending", label: "署名待ち" },
  { value: "signed", label: "締結済み" },
  { value: "expired", label: "期限切れ" },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusLabel(status: string): string {
  const opt = contractStatusOptions.find((o) => o.value === status);
  return opt ? opt.label : status;
}

export function ContractsModal({
  open,
  onOpenChange,
  agentId,
  agentName,
  contracts: initialContracts,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>(
    initialContracts as unknown as Contract[]
  );
  const [isAddMode, setIsAddMode] = useState(false);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Contract | null>(null);
  const [formData, setFormData] = useState<Partial<Contract>>({});
  const [loading, setLoading] = useState(false);

  const openAddForm = () => {
    setFormData({
      contractUrl: "",
      signedDate: null,
      title: "",
      externalId: null,
      externalService: null,
      status: "signed",
      note: "",
    });
    setIsAddMode(true);
  };

  const openEditForm = (contract: Contract) => {
    setFormData({ ...contract });
    setEditContract(contract);
  };

  const handleAdd = async () => {
    if (!formData.contractUrl) {
      toast.error("契約書URLは必須です");
      return;
    }
    setLoading(true);
    try {
      const newContract = await addContract(agentId, formData);
      setContracts([...contracts, newContract as unknown as Contract]);
      toast.success("契約書を追加しました");
      setIsAddMode(false);
      setFormData({});
    } catch {
      toast.error("追加に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editContract || !formData.contractUrl) {
      toast.error("契約書URLは必須です");
      return;
    }
    setLoading(true);
    try {
      const updated = await updateContract(editContract.id, formData);
      setContracts(
        contracts.map((c) =>
          c.id === editContract.id ? (updated as unknown as Contract) : c
        )
      );
      toast.success("契約書を更新しました");
      setEditContract(null);
      setFormData({});
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
      await deleteContract(deleteConfirm.id);
      setContracts(contracts.filter((c) => c.id !== deleteConfirm.id));
      toast.success("契約書を削除しました");
      setDeleteConfirm(null);
    } catch {
      toast.error("削除に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
      <div className="space-y-2">
        <Label>
          契約書URL <span className="text-destructive">*</span>
        </Label>
        <Input
          value={formData.contractUrl || ""}
          onChange={(e) =>
            setFormData({ ...formData, contractUrl: e.target.value })
          }
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label>契約書タイトル</Label>
        <Input
          value={formData.title || ""}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="業務委託基本契約書"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>締結日</Label>
          <DatePicker
            selected={formData.signedDate ? new Date(formData.signedDate) : null}
            onChange={(date: Date | null) => {
              setFormData({
                ...formData,
                signedDate: date ? date.toISOString() : null,
              });
            }}
            dateFormat="yyyy/MM/dd"
            locale="ja"
            placeholderText="日付を選択"
            isClearable
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            wrapperClassName="w-full"
          />
        </div>
        <div className="space-y-2">
          <Label>ステータス</Label>
          <Select
            value={formData.status || "signed"}
            onValueChange={(v) => setFormData({ ...formData, status: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contractStatusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>外部サービス名</Label>
          <Input
            value={formData.externalService || ""}
            onChange={(e) =>
              setFormData({ ...formData, externalService: e.target.value || null })
            }
            placeholder="cloudsign"
          />
        </div>
        <div className="space-y-2">
          <Label>外部サービスID</Label>
          <Input
            value={formData.externalId || ""}
            onChange={(e) =>
              setFormData({ ...formData, externalId: e.target.value || null })
            }
            placeholder="DOC-123456"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>備考</Label>
        <Textarea
          value={formData.note || ""}
          onChange={(e) => setFormData({ ...formData, note: e.target.value || null })}
          rows={2}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setIsAddMode(false);
            setEditContract(null);
            setFormData({});
          }}
        >
          キャンセル
        </Button>
        <Button
          onClick={isAddMode ? handleAdd : handleUpdate}
          disabled={loading}
        >
          {loading ? "保存中..." : isAddMode ? "追加" : "更新"}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>契約書管理 - {agentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 追加ボタン */}
          {!isAddMode && !editContract && (
            <div className="flex justify-end">
              <Button onClick={openAddForm}>
                <Plus className="mr-2 h-4 w-4" />
                契約書を追加
              </Button>
            </div>
          )}

          {/* 追加/編集フォーム */}
          {(isAddMode || editContract) && renderForm()}

          {/* 契約書一覧 */}
          {contracts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              契約書が登録されていません
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイトル</TableHead>
                  <TableHead>締結日</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>外部サービス</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell>
                      <a
                        href={contract.contractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:underline"
                      >
                        {contract.title || "契約書"}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>{formatDate(contract.signedDate)}</TableCell>
                    <TableCell>{getStatusLabel(contract.status)}</TableCell>
                    <TableCell>
                      {contract.externalService || "-"}
                      {contract.externalId && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({contract.externalId})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {contract.note || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditForm(contract)}
                          disabled={isAddMode || !!editContract}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(contract)}
                          disabled={isAddMode || !!editContract}
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

          {/* 削除確認ダイアログ */}
          {deleteConfirm && (
            <div className="border rounded-lg p-4 bg-destructive/10">
              <p className="mb-4">
                「{deleteConfirm.title || "契約書"}」を削除しますか？
                この操作は取り消せません。
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  {loading ? "削除中..." : "削除"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
