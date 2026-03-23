"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  MoreVertical,
  Zap,
  ZapOff,
  Bell,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSlpMemberContracts,
  addSlpMemberContract,
  updateSlpMemberContract,
  deleteSlpMemberContract,
} from "./slp-contract-actions";
import {
  syncContractCloudsignStatus,
  toggleCloudsignAutoSync,
  remindCloudsignDocument,
  linkCloudsignDocument,
} from "@/app/stp/cloudsign-actions";

type Contract = Awaited<ReturnType<typeof getSlpMemberContracts>>[number];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: number;
  memberName: string;
  contractStatusOptions: { value: string; label: string }[];
  contractTypeOptions: { value: string; label: string }[];
};

const signingMethodOptions = [
  { value: "cloudsign", label: "クラウドサイン" },
  { value: "paper", label: "紙" },
  { value: "other", label: "その他" },
];

function statusBadge(statusName: string | null, statusType: string | null) {
  if (!statusName) return <Badge variant="outline">未設定</Badge>;
  const variant =
    statusType === "signed"
      ? "default"
      : statusType === "discarded"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{statusName}</Badge>;
}

export function SlpContractModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  contractStatusOptions,
  contractTypeOptions,
}: Props) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 新規作成/編集フォーム
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    contractType: "",
    title: "",
    currentStatusId: "",
    signingMethod: "",
    signedDate: "",
    note: "",
    cloudsignDocumentId: "",
  });

  // リンク用
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkDocumentId, setLinkDocumentId] = useState("");

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSlpMemberContracts(memberId);
      setContracts(data);
    } catch {
      toast.error("契約書の読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (open) {
      loadContracts();
      setShowForm(false);
      setEditingId(null);
      setLinkingId(null);
    }
  }, [open, loadContracts]);

  const resetForm = () => {
    setFormData({
      contractType: "",
      title: "",
      currentStatusId: "",
      signingMethod: "",
      signedDate: "",
      note: "",
      cloudsignDocumentId: "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForm();
    setFormData((prev) => ({
      ...prev,
      contractType: contractTypeOptions[0]?.value ?? "",
    }));
    setShowForm(true);
  };

  const handleEdit = (c: Contract) => {
    setFormData({
      contractType: c.contractType,
      title: c.title,
      currentStatusId: c.currentStatusId ? String(c.currentStatusId) : "",
      signingMethod: c.signingMethod ?? "",
      signedDate: c.signedDate ?? "",
      note: c.note ?? "",
      cloudsignDocumentId: c.cloudsignDocumentId ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setActionLoading("save");
    try {
      if (editingId) {
        await updateSlpMemberContract(editingId, {
          title: formData.title,
          currentStatusId: formData.currentStatusId ? parseInt(formData.currentStatusId) : null,
          signingMethod: formData.signingMethod || null,
          signedDate: formData.signedDate || null,
          note: formData.note || null,
        });
        toast.success("契約書を更新しました");
      } else {
        await addSlpMemberContract({
          memberId,
          contractType: formData.contractType,
          title: formData.title,
          currentStatusId: formData.currentStatusId ? parseInt(formData.currentStatusId) : null,
          signingMethod: formData.signingMethod || null,
          note: formData.note || null,
        });
        toast.success("契約書を作成しました");
      }
      resetForm();
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("この契約書を削除しますか？")) return;
    setActionLoading(`delete-${id}`);
    try {
      await deleteSlpMemberContract(id);
      toast.success("契約書を削除しました");
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSync = async (id: number) => {
    setActionLoading(`sync-${id}`);
    try {
      await syncContractCloudsignStatus(id);
      toast.success("同期しました");
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "同期に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAutoSync = async (id: number, enabled: boolean) => {
    setActionLoading(`autoSync-${id}`);
    try {
      await toggleCloudsignAutoSync(id, enabled);
      toast.success(enabled ? "自動同期をONにしました" : "自動同期をOFFにしました");
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "切替に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemind = async (id: number) => {
    setActionLoading(`remind-${id}`);
    try {
      await remindCloudsignDocument(id);
      toast.success("リマインドを送付しました");
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "リマインド送付に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLink = async () => {
    if (!linkingId || !linkDocumentId.trim()) return;
    setActionLoading(`link-${linkingId}`);
    try {
      await linkCloudsignDocument(linkingId, linkDocumentId.trim());
      toast.success("CloudSign書類IDを紐付けました");
      setLinkingId(null);
      setLinkDocumentId("");
      await loadContracts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "紐付けに失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>契約管理 — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 新規追加ボタン */}
          {!showForm && (
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-1" />
              新規契約書
            </Button>
          )}

          {/* 新規作成/編集フォーム */}
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{editingId ? "契約書を編集" : "新規契約書"}</h3>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!editingId && (
                  <div className="space-y-1">
                    <Label>契約種別</Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(v) => setFormData((p) => ({ ...p, contractType: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                      <SelectContent>
                        {contractTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label>タイトル</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    placeholder="契約書名"
                  />
                </div>
                <div className="space-y-1">
                  <Label>ステータス</Label>
                  <Select
                    value={formData.currentStatusId}
                    onValueChange={(v) => setFormData((p) => ({ ...p, currentStatusId: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {contractStatusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>署名方法</Label>
                  <Select
                    value={formData.signingMethod}
                    onValueChange={(v) => setFormData((p) => ({ ...p, signingMethod: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {signingMethodOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingId && (
                  <div className="space-y-1">
                    <Label>署名日</Label>
                    <Input
                      type="date"
                      value={formData.signedDate}
                      onChange={(e) => setFormData((p) => ({ ...p, signedDate: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label>メモ</Label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
                  rows={2}
                  placeholder="備考"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={actionLoading === "save" || (!editingId && !formData.contractType) || !formData.title}
                >
                  {actionLoading === "save" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : null}
                  {editingId ? "更新" : "作成"}
                </Button>
                <Button size="sm" variant="outline" onClick={resetForm}>
                  キャンセル
                </Button>
              </div>
            </div>
          )}

          {/* 契約書一覧 */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              読み込み中...
            </div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              契約書はまだありません
            </div>
          ) : (
            <div className="space-y-2">
              {contracts.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.title}</span>
                        {statusBadge(c.currentStatusName, c.currentStatusType)}
                        {c.cloudsignAutoSync !== undefined && c.cloudsignDocumentId && (
                          c.cloudsignAutoSync ? (
                            <Badge variant="outline" className="text-green-600 border-green-300 text-xs">自動同期</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">手動</Badge>
                          )
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-x-3">
                        <span>種別: {c.contractType}</span>
                        {c.signingMethod && <span>署名: {signingMethodOptions.find((o) => o.value === c.signingMethod)?.label ?? c.signingMethod}</span>}
                        {c.cloudsignSentAt && <span>送付: {new Date(c.cloudsignSentAt).toLocaleDateString("ja-JP")}</span>}
                        {c.signedDate && <span>署名日: {c.signedDate}</span>}
                        {c.cloudsignLastRemindedAt && <span>最終リマインド: {new Date(c.cloudsignLastRemindedAt).toLocaleDateString("ja-JP")}</span>}
                      </div>
                      {c.note && (
                        <p className="text-xs text-muted-foreground mt-1">{c.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(c)}
                        title="編集"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={actionLoading?.startsWith(`${c.id}`) ?? false}
                          >
                            {actionLoading?.endsWith(`-${c.id}`) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MoreVertical className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {c.cloudsignDocumentId && (
                            <>
                              <DropdownMenuItem onClick={() => handleSync(c.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                手動同期
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleAutoSync(c.id, !c.cloudsignAutoSync)}
                              >
                                {c.cloudsignAutoSync ? (
                                  <><ZapOff className="h-4 w-4 mr-2" />自動同期OFF</>
                                ) : (
                                  <><Zap className="h-4 w-4 mr-2" />自動同期ON</>
                                )}
                              </DropdownMenuItem>
                              {c.cloudsignStatus === "sent" && (
                                <DropdownMenuItem onClick={() => handleRemind(c.id)}>
                                  <Bell className="h-4 w-4 mr-2" />
                                  リマインド送付
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {!c.cloudsignDocumentId && (
                            <DropdownMenuItem
                              onClick={() => {
                                setLinkingId(c.id);
                                setLinkDocumentId("");
                              }}
                            >
                              <Link2 className="h-4 w-4 mr-2" />
                              CloudSign書類ID紐付け
                            </DropdownMenuItem>
                          )}
                          {c.cloudsignUrl && (
                            <DropdownMenuItem asChild>
                              <a href={c.cloudsignUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                CloudSignで確認
                              </a>
                            </DropdownMenuItem>
                          )}
                          {c.filePath && (
                            <DropdownMenuItem asChild>
                              <a href={c.filePath} download={c.fileName}>
                                PDF ダウンロード
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(c.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* CloudSign書類ID紐付けインライン */}
                  {linkingId === c.id && (
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <Input
                        placeholder="CloudSign書類IDを入力"
                        value={linkDocumentId}
                        onChange={(e) => setLinkDocumentId(e.target.value)}
                        className="text-sm h-8"
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={handleLink}
                        disabled={!linkDocumentId.trim() || actionLoading === `link-${c.id}`}
                      >
                        {actionLoading === `link-${c.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "紐付け"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => setLinkingId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
