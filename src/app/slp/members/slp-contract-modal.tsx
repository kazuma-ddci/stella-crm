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
  RotateCcw,
  Link2,
  Copy,
  ChevronRight,
  Cloud,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { MultiFileUpload, type FileInfo } from "@/components/multi-file-upload";
import {
  getSlpMemberContracts,
  getSlpNextContractNumber,
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

type FormData = {
  contractType: string;
  title: string;
  currentStatusId: string;
  signedDate: string;
  signingMethod: string;
  note: string;
  cloudsignDocumentId: string;
  files: FileInfo[];
};

const EMPTY_FORM: FormData = {
  contractType: "",
  title: "",
  currentStatusId: "",
  signedDate: "",
  signingMethod: "cloudsign",
  note: "",
  cloudsignDocumentId: "",
  files: [],
};

// --- 契約書カード ---
function ContractCard({
  contract,
  onEdit,
  onReload,
}: {
  contract: Contract;
  onEdit: (contract: Contract) => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!confirm("この契約書を削除してもよろしいですか？")) return;
    await handleAction("delete", () => deleteSlpMemberContract(contract.id));
  };

  const handleRemind = () =>
    handleAction("remind", async () => {
      await remindCloudsignDocument(contract.id);
      toast.success("催促メールを送付しました");
    });

  const handleSync = () =>
    handleAction("sync", async () => {
      const result = await syncContractCloudsignStatus(contract.id);
      if (result.previousStatus === result.newStatus) {
        toast.info("ステータスに変更はありません");
      } else {
        toast.success(`同期しました: ${result.previousStatus} → ${result.newStatus}`);
      }
    });

  const handleToggleAutoSync = () => {
    const newState = !contract.cloudsignAutoSync;
    if (!newState && !confirm("CloudSign側のステータス変更がCRMに反映されなくなります。よろしいですか？")) return;
    handleAction("autoSync", async () => {
      await toggleCloudsignAutoSync(contract.id, newState);
      toast.success(newState ? "自動同期をONにしました" : "自動同期をOFFにしました");
    });
  };

  const handleLinkCloudsign = () => {
    const docId = prompt("CloudSignのドキュメントIDを入力してください");
    if (!docId?.trim()) return;
    if (!confirm(`ドキュメントID「${docId.trim()}」で同期しますか？`)) return;
    handleAction("link", async () => {
      await linkCloudsignDocument(contract.id, docId.trim());
      toast.success("CloudSignと紐付けました");
    });
  };

  return (
    <div className="border rounded-lg">
      {/* ヘッダー行 */}
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
          <Button variant="ghost" size="sm" onClick={() => onEdit(contract)} title="編集">
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
              {contract.cloudsignDocumentId ? (
                <>
                  <DropdownMenuItem
                    onClick={() => window.open(contract.cloudsignUrl || `https://www.cloudsign.jp/documents/${contract.cloudsignDocumentId}`, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    CloudSignで開く
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={actionLoading === "sync"} onClick={handleSync}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    {actionLoading === "sync" ? "同期中..." : "手動で同期"}
                  </DropdownMenuItem>
                  {contract.cloudsignStatus !== "completed" && !contract.cloudsignStatus?.startsWith("canceled") && (
                    <DropdownMenuItem disabled={actionLoading === "autoSync"} onClick={handleToggleAutoSync}>
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
              ) : (
                <DropdownMenuItem disabled={actionLoading === "link"} onClick={handleLinkCloudsign}>
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
          {(contract.cloudsignTitle || hasFiles ||
            (contract.cloudsignDocumentId && !contract.cloudsignAutoSync)) && (
            <div className="px-4 py-2 bg-gray-50/30 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {contract.cloudsignTitle && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <Cloud className="h-3 w-3" />
                  {contract.cloudsignTitle}
                </span>
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
                  {cf.fileName}
                </button>
              ))}
            </div>
          )}

          {/* 日付・備考 */}
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

          {/* 契約書への入力内容 */}
          {contract.cloudsignInputData && contract.cloudsignInputData.widgets.length > 0 && (
            <CloudsignInputSection data={contract.cloudsignInputData} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 締結完了時にお客様が契約書内に入力した widget 値を表示するセクション
 */
function CloudsignInputSection({
  data,
}: {
  data: {
    capturedAt: string;
    widgets: Array<{
      label: string | null;
      text: string;
      widgetType: number;
      widgetTypeName: string;
      page: number;
      status: number;
      participantId: string;
      participantEmail: string | null;
    }>;
  };
}) {
  // 受信者(participantEmail が null でない = participants[1]以降のうちフィルタ)だけを対象に
  // 実務上、送信元(自社)のwidgetは通常 pre-fill されているので、
  // 表示は participantEmail でグルーピング。1人だけならそのまま表示
  const byParticipant = new Map<string, typeof data.widgets>();
  for (const w of data.widgets) {
    const key = w.participantEmail ?? w.participantId ?? "unknown";
    if (!byParticipant.has(key)) byParticipant.set(key, []);
    byParticipant.get(key)!.push(w);
  }

  return (
    <div className="border-t px-4 py-3 bg-blue-50/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-blue-900">
          📝 お客様が契約書に入力した内容
        </span>
        <span className="text-[10px] text-gray-400">
          取得日時: {new Date(data.capturedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </span>
      </div>

      <div className="space-y-3">
        {Array.from(byParticipant.entries()).map(([participantKey, widgets]) => {
          const firstWithEmail = widgets.find((w) => w.participantEmail);
          const label = firstWithEmail?.participantEmail ?? participantKey;
          // フリーテキスト(1), チェックボックス(2) を優先表示、署名(0) は最後
          const sorted = [...widgets].sort((a, b) => {
            const order = (t: number) => (t === 1 ? 0 : t === 2 ? 1 : 2);
            return order(a.widgetType) - order(b.widgetType) || a.page - b.page;
          });
          return (
            <div key={participantKey} className="rounded border border-blue-100 bg-white p-2">
              <div className="text-[10px] text-gray-500 mb-1.5">参加者: {label}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                {sorted.map((w, i) => {
                  const labelText = w.label || `（ラベルなし / ページ ${w.page} / ${w.widgetTypeName}）`;
                  let valueNode;
                  if (w.widgetType === 0) {
                    // 署名
                    valueNode =
                      w.status === 1 ? (
                        <span className="text-green-700 font-medium">押印済み</span>
                      ) : (
                        <span className="text-gray-400">未押印</span>
                      );
                  } else if (w.widgetType === 2) {
                    // チェックボックス
                    valueNode = w.text === "1" ? (
                      <span className="text-green-700">✓ チェック</span>
                    ) : (
                      <span className="text-gray-400">未チェック</span>
                    );
                  } else {
                    // フリーテキスト
                    valueNode = w.text ? (
                      <span className="text-gray-900 whitespace-pre-wrap">{w.text}</span>
                    ) : (
                      <span className="text-gray-400">（未入力）</span>
                    );
                  }
                  return (
                    <div key={i} className="flex items-baseline gap-2 text-xs border-b border-gray-100 py-1 last:border-b-0">
                      <span className="text-gray-500 shrink-0 min-w-[6rem]">{labelText}</span>
                      <span className="flex-1">{valueNode}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [nextContractNumber, setNextContractNumber] = useState("");

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
      resetForm();
    }
  }, [open, loadContracts]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
    setNextContractNumber("");
  };

  const handleAdd = async () => {
    resetForm();
    setFormData({
      ...EMPTY_FORM,
      contractType: contractTypeOptions[0]?.value ?? "",
    });
    setFormOpen(true);
    try {
      const number = await getSlpNextContractNumber();
      setNextContractNumber(number);
    } catch {
      // ignore
    }
  };

  const handleEdit = (contract: Contract) => {
    setFormData({
      contractType: contract.contractType,
      title: contract.title,
      currentStatusId: contract.currentStatusId ? String(contract.currentStatusId) : "",
      signedDate: contract.signedDate ?? "",
      signingMethod: contract.signingMethod ?? "cloudsign",
      note: contract.note ?? "",
      cloudsignDocumentId: contract.cloudsignDocumentId ?? "",
      files: contract.contractFiles.map((cf) => ({
        id: cf.id,
        filePath: cf.filePath,
        fileName: cf.fileName,
        fileSize: 0,
        mimeType: "",
      })),
    });
    setEditingId(contract.id);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contractType || !formData.title) {
      toast.error("契約種別とタイトルは必須です");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        contractType: formData.contractType,
        title: formData.title,
        currentStatusId: formData.currentStatusId ? Number(formData.currentStatusId) : null,
        signedDate: formData.signedDate || null,
        signingMethod: formData.signingMethod || "cloudsign",
        note: formData.note || null,
        files: formData.files,
      };

      let savedId: number | null = editingId;

      if (editingId) {
        await updateSlpMemberContract(editingId, data);
        toast.success("契約書を更新しました");
      } else {
        const result = await addSlpMemberContract({
          memberId,
          ...data,
        });
        savedId = result.contractId;
        toast.success(`契約書番号「${result.contractNumber}」で保存しました`);
      }

      // CloudSign書類IDが新たに入力された場合、紐付け＆同期
      const docId = formData.cloudsignDocumentId.trim();
      if (docId && savedId) {
        const existingContract = contracts.find((c) => c.id === savedId);
        if (!existingContract?.cloudsignDocumentId) {
          if (confirm(`CloudSignドキュメントID「${docId}」で同期しますか？\nCloudSign側のステータスがCRMに反映されます。`)) {
            try {
              await linkCloudsignDocument(savedId, docId);
              toast.success("CloudSignと紐付けました");
            } catch {
              toast.error("CloudSign紐付けに失敗しました。ドキュメントIDを確認してください。");
            }
          }
        }
      }

      resetForm();
      await loadContracts();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  // CloudSign同期中かどうか判定
  const editingContract = editingId ? contracts.find((c) => c.id === editingId) : null;
  const isCloudSignSynced = !!(editingContract?.cloudsignDocumentId && editingContract?.cloudsignAutoSync);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="mixed"
        className="p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>契約管理 — {memberName}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 flex flex-col gap-4 flex-1 min-h-0">
          {/* ボタン行 */}
          {!formOpen && (
            <div className="flex justify-end shrink-0">
              <Button size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-1" />
                契約書を作成
              </Button>
            </div>
          )}

          {/* 契約書フォーム */}
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
                    <Label>契約種別 <span className="text-red-500">*</span></Label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(v) => setFormData({ ...formData, contractType: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        {contractTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* タイトル */}
                  <div>
                    <Label>タイトル <span className="text-red-500">*</span></Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="契約書タイトル"
                    />
                    {editingContract?.cloudsignTitle && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Cloud className="h-3 w-3 shrink-0" />
                        CloudSign上のタイトル: {editingContract.cloudsignTitle}
                      </p>
                    )}
                  </div>

                  {/* ステータス */}
                  <div>
                    <Label>ステータス</Label>
                    <Select
                      value={formData.currentStatusId}
                      onValueChange={(v) => setFormData({ ...formData, currentStatusId: v })}
                      disabled={isCloudSignSynced}
                    >
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        {contractStatusOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isCloudSignSynced && (
                      <p className="text-xs text-blue-600 mt-1">
                        CloudSign同期中のため自動更新されます。手動で変更するには同期をOFFにしてください。
                      </p>
                    )}
                  </div>

                  {/* 締結日 */}
                  <div>
                    <Label>締結日</Label>
                    <Input
                      type="date"
                      value={formData.signedDate}
                      onChange={(e) => setFormData({ ...formData, signedDate: e.target.value })}
                      disabled={isCloudSignSynced}
                    />
                    {isCloudSignSynced && (
                      <p className="text-xs text-blue-600 mt-1">
                        CloudSign同期中のため自動更新されます。
                      </p>
                    )}
                  </div>

                  {/* 契約書ファイル */}
                  <div className="col-span-2">
                    <Label>契約書ファイル</Label>
                    <MultiFileUpload
                      value={formData.files}
                      onChange={(files) => setFormData({ ...formData, files })}
                      uploadUrl="/api/contracts/upload"
                      entityIdKey="contractId"
                      entityId={editingId || undefined}
                    />
                  </div>
                </div>

                {/* 備考 */}
                <div>
                  <Label>備考</Label>
                  <Textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="備考"
                    rows={2}
                  />
                </div>

                {/* CloudSign ドキュメントID */}
                {!(editingId && editingContract?.cloudsignDocumentId) && (
                  <div>
                    <Label>CloudSign ドキュメントID（任意）</Label>
                    <Input
                      value={formData.cloudsignDocumentId}
                      onChange={(e) => setFormData({ ...formData, cloudsignDocumentId: e.target.value })}
                      placeholder="例: abcdef12-3456-7890-abcd-ef1234567890"
                    />
                    {formData.cloudsignDocumentId.trim() && (
                      <p className="text-xs text-blue-600 mt-1">
                        保存後にCloudSignと同期するか確認されます。同期するとCloudSign側のステータスがCRMに反映されます。
                      </p>
                    )}
                  </div>
                )}

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

          {/* 契約書一覧 */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
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
              contracts.map((c) => (
                <ContractCard
                  key={c.id}
                  contract={c}
                  onEdit={handleEdit}
                  onReload={loadContracts}
                />
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
