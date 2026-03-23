"use client";

import { useState, useEffect, useCallback } from "react";
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
  Pause,
  Zap,
  RotateCcw,
  Link2,
  Copy,
  ChevronRight,
  Cloud,
  FileText,
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

// CloudSignステータスのラベルと色
function getCsStatusConfig(status: string | null) {
  if (status === "completed") return { label: "締結済", color: "bg-green-50 text-green-700 border-green-200" };
  if (status === "sent") return { label: "送付済", color: "bg-blue-50 text-blue-700 border-blue-200" };
  if (status === "draft") return { label: "下書き", color: "bg-gray-50 text-gray-600 border-gray-200" };
  if (status?.startsWith("canceled")) return { label: "破棄", color: "bg-red-50 text-red-700 border-red-200" };
  return null;
}

// --- 契約書カード ---
function ContractCard({
  contract,
  contractStatusOptions,
  onReload,
}: {
  contract: Contract;
  contractStatusOptions: { value: string; label: string }[];
  onReload: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 編集フォーム
  const [editTitle, setEditTitle] = useState(contract.title);
  const [editStatusId, setEditStatusId] = useState(contract.currentStatusId ? String(contract.currentStatusId) : "");
  const [editSignedDate, setEditSignedDate] = useState(contract.signedDate ?? "");
  const [editNote, setEditNote] = useState(contract.note ?? "");

  const csStatusConfig = contract.cloudsignDocumentId ? getCsStatusConfig(contract.cloudsignStatus) : null;
  const hasFiles = !!contract.filePath || contract.contractFiles.length > 0;

  const handleAction = async (key: string, fn: () => Promise<void>) => {
    setActionLoading(key);
    try {
      await fn();
      onReload();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveEdit = async () => {
    setActionLoading("save");
    try {
      await updateSlpMemberContract(contract.id, {
        title: editTitle,
        currentStatusId: editStatusId ? parseInt(editStatusId) : null,
        signedDate: editSignedDate || null,
        note: editNote || null,
      });
      toast.success("更新しました");
      setEditing(false);
      onReload();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("この契約書を削除しますか？関連する履歴も削除されます。")) return;
    await handleAction("delete", () => deleteSlpMemberContract(contract.id));
  };

  const handleRemind = async () => {
    await handleAction("remind", async () => {
      await remindCloudsignDocument(contract.id);
      toast.success("催促メールを送付しました");
    });
  };

  const handleSync = async () => {
    await handleAction("sync", async () => {
      const result = await syncContractCloudsignStatus(contract.id);
      if (result.previousStatus === result.newStatus) {
        toast.info("ステータスに変更はありません");
      } else {
        toast.success(`同期しました: ${result.previousStatus} → ${result.newStatus}`);
      }
    });
  };

  const handleToggleAutoSync = async () => {
    const newState = !contract.cloudsignAutoSync;
    if (!newState && !confirm("CloudSign側のステータス変更がCRMに反映されなくなります。よろしいですか？")) return;
    await handleAction("autoSync", async () => {
      await toggleCloudsignAutoSync(contract.id, newState);
      toast.success(newState ? "自動同期をONにしました" : "自動同期をOFFにしました");
    });
  };

  const handleLinkCloudsign = async () => {
    const docId = prompt("CloudSignのドキュメントIDを入力してください");
    if (!docId?.trim()) return;
    if (!confirm(`ドキュメントID「${docId.trim()}」で紐付けしますか？`)) return;
    await handleAction("link", async () => {
      await linkCloudsignDocument(contract.id, docId.trim());
      toast.success("CloudSignと紐付けました");
    });
  };

  return (
    <div className="border rounded-lg">
      {/* ヘッダー行（常に表示） */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
        {contract.contractNumber && (
          <span className="font-mono text-xs text-gray-400 shrink-0">{contract.contractNumber}</span>
        )}
        <Badge variant="outline" className="text-[10px] shrink-0">{contract.contractType}</Badge>
        <span className="font-medium text-sm truncate">{contract.title}</span>
        {contract.currentStatusName && (
          <Badge variant="secondary" className="text-[10px] shrink-0">{contract.currentStatusName}</Badge>
        )}
        {csStatusConfig && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ${csStatusConfig.color}`}>
            {csStatusConfig.label}
          </span>
        )}

        {/* アクションボタン */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
          {contract.cloudsignStatus === "sent" && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-40"
              disabled={actionLoading === "remind"}
              onClick={handleRemind}
            >
              {actionLoading === "remind" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              催促
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setExpanded(true); }} title="編集">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={actionLoading === "delete"} title="削除">
            {actionLoading === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-red-500" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex items-center justify-center rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {contract.cloudsignDocumentId && (
                <>
                  <DropdownMenuItem
                    onClick={() => window.open(contract.cloudsignUrl || `https://www.cloudsign.jp/documents/${contract.cloudsignDocumentId}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    CloudSignで開く
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={actionLoading === "sync"}
                    onClick={handleSync}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    {actionLoading === "sync" ? "同期中..." : "手動で同期"}
                  </DropdownMenuItem>
                  {contract.cloudsignStatus !== "completed" && !contract.cloudsignStatus?.startsWith("canceled") && (
                    <DropdownMenuItem
                      disabled={actionLoading === "autoSync"}
                      onClick={handleToggleAutoSync}
                    >
                      <Pause className="h-3.5 w-3.5 mr-2" />
                      {contract.cloudsignAutoSync ? "自動同期を停止" : "自動同期を再開"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      navigator.clipboard.writeText(contract.cloudsignDocumentId || "");
                      toast.success("ドキュメントIDをコピーしました");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    <span className="truncate">ID: {contract.cloudsignDocumentId?.slice(0, 12)}...</span>
                  </DropdownMenuItem>
                </>
              )}
              {!contract.cloudsignDocumentId && (
                <DropdownMenuItem
                  disabled={actionLoading === "link"}
                  onClick={handleLinkCloudsign}
                >
                  <Link2 className="h-3.5 w-3.5 mr-2" />
                  {actionLoading === "link" ? "紐付け中..." : "CloudSignと紐付け"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 展開部分 */}
      {expanded && (
        <div className="border-t">
          {/* 詳細情報行 */}
          {(contract.cloudsignTitle || contract.signingMethod || hasFiles ||
            (contract.cloudsignDocumentId && !contract.cloudsignAutoSync)) && (
            <div className="px-4 py-2 bg-gray-50/30 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {contract.cloudsignTitle && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <Cloud className="h-3 w-3" />
                  {contract.cloudsignTitle}
                </span>
              )}
              {contract.signingMethod && (
                <span>方法: クラウドサイン</span>
              )}
              {contract.cloudsignDocumentId && !contract.cloudsignAutoSync && (
                <span className="inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 border border-orange-200">
                  同期停止中
                </span>
              )}
              {contract.filePath && contract.fileName && (
                <button
                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                  onClick={() => window.open(contract.filePath!, "_blank")}
                  title={`署名PDF: ${contract.fileName}`}
                >
                  <FileText className="h-3 w-3" />
                  署名PDF
                </button>
              )}
              {contract.contractFiles.map((cf) => (
                <button
                  key={cf.id}
                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                  onClick={() => window.open(cf.filePath, "_blank")}
                  title={cf.fileName}
                >
                  <FileText className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {/* 日付・備考情報 */}
          <div className="px-4 py-2 text-xs text-gray-500 space-y-1">
            <div className="flex gap-4 flex-wrap">
              {contract.cloudsignSentAt && <span>送付日: {new Date(contract.cloudsignSentAt).toLocaleDateString("ja-JP")}</span>}
              {contract.signedDate && <span>署名日: {contract.signedDate}</span>}
              {contract.cloudsignCompletedAt && <span>締結日: {new Date(contract.cloudsignCompletedAt).toLocaleDateString("ja-JP")}</span>}
              {contract.cloudsignLastRemindedAt && <span>最終催促: {new Date(contract.cloudsignLastRemindedAt).toLocaleDateString("ja-JP")}</span>}
              <span>作成日: {new Date(contract.createdAt).toLocaleDateString("ja-JP")}</span>
            </div>
            {contract.note && <p className="text-gray-400">{contract.note}</p>}
          </div>

          {/* 編集フォーム */}
          {editing && (
            <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">タイトル</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ステータス</Label>
                  <Select value={editStatusId} onValueChange={setEditStatusId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {contractStatusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">署名日</Label>
                  <Input type="date" value={editSignedDate} onChange={(e) => setEditSignedDate(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">メモ</Label>
                <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} className="text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={actionLoading === "save" || !editTitle}>
                  {actionLoading === "save" && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  保存
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>キャンセル</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- メインモーダル ---
export function SlpContractModal({
  open,
  onOpenChange,
  memberId,
  memberName,
  contractStatusOptions,
  contractTypeOptions,
}: Props) {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // 新規作成フォーム
  const [newContractType, setNewContractType] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newStatusId, setNewStatusId] = useState("");
  const [newNote, setNewNote] = useState("");

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
      setShowAddForm(false);
    }
  }, [open, loadContracts]);

  const handleAdd = async () => {
    if (!newContractType || !newTitle) return;
    setAddLoading(true);
    try {
      await addSlpMemberContract({
        memberId,
        contractType: newContractType,
        title: newTitle,
        currentStatusId: newStatusId ? parseInt(newStatusId) : null,
        signingMethod: "cloudsign",
        note: newNote || null,
      });
      toast.success("契約書を作成しました");
      setShowAddForm(false);
      setNewContractType("");
      setNewTitle("");
      setNewStatusId("");
      setNewNote("");
      await loadContracts();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>契約管理 — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* 新規追加ボタン */}
          {!showAddForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setNewContractType(contractTypeOptions[0]?.value ?? "");
                setShowAddForm(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              新規契約書
            </Button>
          )}

          {/* 新規作成フォーム */}
          {showAddForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">新規契約書を作成</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAddForm(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">契約種別</Label>
                  <Select value={newContractType} onValueChange={setNewContractType}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {contractTypeOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">タイトル</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="契約書名" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">ステータス</Label>
                  <Select value={newStatusId} onValueChange={setNewStatusId}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      {contractStatusOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">メモ</Label>
                <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} placeholder="備考" className="text-sm" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} disabled={addLoading || !newContractType || !newTitle}>
                  {addLoading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  作成
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>キャンセル</Button>
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
                <ContractCard
                  key={c.id}
                  contract={c}
                  contractStatusOptions={contractStatusOptions}
                  onReload={loadContracts}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
