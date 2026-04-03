"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FileText, ExternalLink, Loader2, Play, RotateCcw, Link2, PenTool, MoreVertical, Copy, RefreshCw, Pause, ChevronRight, Cloud } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  syncContractCloudsignStatus,
  toggleCloudsignAutoSync,
  linkCloudsignDocument,
  getCloudsignModalData,
  deleteDraftContract,
  remindCloudsignDocument,
  getCloudsignSelfSigningUrl,
} from "@/app/stp/cloudsign-actions";
import type { Contract, ContractHistory, AgentContractHistory } from "@/types/master-contract";
import { signingMethodOptions } from "@/types/master-contract";
import { ContractHistoryRow } from "./contract-history-components";
import { AgentContractHistoryRow } from "./agent-history-components";

export function ContractCard({
  contract,
  onEdit,
  onDelete,
  onEditHistory,
  onDeleteHistory,
  onAddHistoryForContract,
  isAgentMode,
  onEditAgentHistory,
  onDeleteAgentHistory,
  onAddAgentHistoryForContract,
  // CloudSign related
  cloudsignData,
  setCloudsignData,
  setLoadingCloudsign,
  syncingContractId,
  setSyncingContractId,
  togglingAutoSyncId,
  setTogglingAutoSyncId,
  linkingContractId,
  setLinkingContractId,
  remindingContractId,
  setRemindingContractId,
  fetchingSigningUrlId,
  setFetchingSigningUrlId,
  deletingDraftId,
  setDeletingDraftId,
  loadContracts,
  companyId,
  setResumeDraft,
  setSendModalOpen,
  router,
}: {
  contract: Contract;
  onEdit: () => void;
  onDelete: () => void;
  onEditHistory: (history: ContractHistory) => void;
  onDeleteHistory: (historyId: number) => void;
  onAddHistoryForContract: (contractId: number) => void;
  isAgentMode?: boolean;
  onEditAgentHistory?: (history: AgentContractHistory) => void;
  onDeleteAgentHistory?: (historyId: number) => void;
  onAddAgentHistoryForContract?: (contractId: number) => void;
  cloudsignData: {
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null;
  setCloudsignData: (data: {
    contractTypes: { id: number; name: string; templates: { id: number; cloudsignTemplateId: string; name: string; description: string | null }[] }[];
    contacts: { id: number; name: string; email: string | null; position: string | null }[];
    operatingCompany: { id: number; companyName: string; cloudsignClientId: string | null } | null;
    projectId: number;
  } | null) => void;
  setLoadingCloudsign: (v: boolean) => void;
  syncingContractId: number | null;
  setSyncingContractId: (v: number | null) => void;
  togglingAutoSyncId: number | null;
  setTogglingAutoSyncId: (v: number | null) => void;
  linkingContractId: number | null;
  setLinkingContractId: (v: number | null) => void;
  remindingContractId: number | null;
  setRemindingContractId: (v: number | null) => void;
  fetchingSigningUrlId: number | null;
  setFetchingSigningUrlId: (v: number | null) => void;
  deletingDraftId: number | null;
  setDeletingDraftId: (v: number | null) => void;
  loadContracts: () => Promise<void>;
  companyId: number;
  setResumeDraft: (v: {
    contractId: number;
    contractNumber: string;
    cloudsignDocumentId: string;
    contractType: string;
    title: string;
    cloudsignTitle?: string | null;
    assignedTo?: string | null;
    note?: string | null;
  } | undefined) => void;
  setSendModalOpen: (v: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [expanded, setExpanded] = useState(false);

  // CloudSign操作のハンドラ群
  const handleRemind = async () => {
    if (!confirm("先方にリマインドメールを送信しますか？")) return;
    setRemindingContractId(contract.id);
    try {
      const result = await remindCloudsignDocument(contract.id);
      if (result.success) {
        toast.success("リマインドを送信しました");
        await loadContracts();
      } else {
        toast.error(result.error ?? "リマインドの送信に失敗しました");
      }
    } catch (error) {
      console.error(error);
      toast.error("リマインドの送信に失敗しました");
    } finally {
      setRemindingContractId(null);
    }
  };

  const handleSelfSign = async () => {
    if (contract.cloudsignSelfSigningUrl) {
      window.open(contract.cloudsignSelfSigningUrl, "_blank");
      return;
    }
    setFetchingSigningUrlId(contract.id);
    try {
      const result = await getCloudsignSelfSigningUrl(contract.id);
      if (result.url) {
        window.open(result.url, "_blank");
        await loadContracts();
      } else {
        toast.info("署名用URLがまだ届いていません。しばらく経ってからお試しください。");
      }
    } catch (error) {
      console.error(error);
      toast.error("署名用URLの取得に失敗しました");
    } finally {
      setFetchingSigningUrlId(null);
    }
  };

  const handleResumeDraft = async () => {
    if (!cloudsignData) {
      setLoadingCloudsign(true);
      try {
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
  };

  const handleDeleteDraft = async () => {
    if (!confirm("この下書きを削除しますか？CloudSign側のドラフトも削除されます。")) return;
    setDeletingDraftId(contract.id);
    try {
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
  };

  const handleLinkCloudsign = async () => {
    const docId = prompt("CloudSignのドキュメントIDを入力してください");
    if (!docId?.trim()) return;
    if (!confirm(`ドキュメントID「${docId.trim()}」で同期しますか？`)) return;
    setLinkingContractId(contract.id);
    try {
      const result = await linkCloudsignDocument(contract.id, docId.trim());
      toast.success(`CloudSignと紐付けました（ステータス: ${result.newStatus}）`);
      await loadContracts();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("紐付けに失敗しました。ドキュメントIDが正しいか確認してください。");
    } finally {
      setLinkingContractId(null);
    }
  };

  // CloudSignステータスのラベルと色
  const csStatusConfig = contract.cloudsignDocumentId ? (() => {
    const s = contract.cloudsignStatus;
    if (s === "completed") return { label: "締結済", color: "bg-green-50 text-green-700 border-green-200" };
    if (s === "sent") return { label: "送付済", color: "bg-blue-50 text-blue-700 border-blue-200" };
    if (s === "draft") return { label: "下書き", color: "bg-gray-50 text-gray-600 border-gray-200" };
    if (s?.startsWith("canceled")) return { label: "破棄", color: "bg-red-50 text-red-700 border-red-200" };
    return { label: s || "-", color: "bg-gray-50 text-gray-600 border-gray-200" };
  })() : null;

  // ファイルリンク（署名PDF + 添付ファイル）
  const hasFiles = (contract.filePath && contract.fileName) || (contract.contractFiles && contract.contractFiles.length > 0);

  return (
    <div className="border rounded-lg">
      {/* ヘッダー（常に表示 — コンパクトな1行） */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 bg-gray-50/50 cursor-pointer hover:bg-gray-100/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span className="font-mono text-xs text-gray-400 shrink-0">{contract.contractNumber}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">{contract.contractType}</Badge>
        <span className="font-medium text-sm truncate">{contract.title}</span>
        {/* 主要ステータスだけ表示 */}
        {contract.currentStatusName && (
          <Badge variant="secondary" className="text-[10px] shrink-0">{contract.currentStatusName}</Badge>
        )}
        {csStatusConfig && (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border shrink-0 ${csStatusConfig.color}`}>
            {csStatusConfig.label}
          </span>
        )}
        {/* アクションボタン（右端） */}
        <div className="flex items-center gap-0.5 shrink-0 ml-auto" onClick={(e) => e.stopPropagation()}>
          {contract.cloudsignStatus === "sent" && (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-40"
                disabled={remindingContractId === contract.id}
                onClick={handleRemind}
              >
                {remindingContractId === contract.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3" />
                )}
                催促
              </button>
              {contract.cloudsignSelfSigningEmailId && !contract.cloudsignSelfSignedAt && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors disabled:opacity-40"
                  disabled={fetchingSigningUrlId === contract.id}
                  title="CloudSignに送信者アカウントでログイン中の場合は、シークレットウィンドウで開くか、メールのリンクから署名してください。"
                  onClick={handleSelfSign}
                >
                  {fetchingSigningUrlId === contract.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <PenTool className="h-3 w-3" />
                  )}
                  署名
                </button>
              )}
            </>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit} title="編集"><Pencil className="h-3.5 w-3.5" /></Button>
          {contract.cloudsignStatus === "draft" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={deletingDraftId === contract.id}
              onClick={handleDeleteDraft}
              title="削除"
            >
              {deletingDraftId === contract.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              )}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onDelete} title="削除"><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
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
                  {contract.cloudsignStatus === "draft" && (
                    <DropdownMenuItem onClick={handleResumeDraft}>
                      <Play className="h-3.5 w-3.5 mr-2" />
                      送付を再開
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={syncingContractId === contract.id}
                    onClick={async () => {
                      setSyncingContractId(contract.id);
                      try {
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
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    {syncingContractId === contract.id ? "同期中..." : "手動で同期"}
                  </DropdownMenuItem>
                  {contract.cloudsignStatus !== "completed" &&
                   !contract.cloudsignStatus?.startsWith("canceled") && (
                    <DropdownMenuItem
                      disabled={togglingAutoSyncId === contract.id}
                      onClick={async () => {
                        const newState = !contract.cloudsignAutoSync;
                        if (!newState) {
                          if (!confirm("CloudSign側のステータス変更がCRMに反映されなくなります。よろしいですか？")) return;
                        }
                        setTogglingAutoSyncId(contract.id);
                        try {
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
                    >
                      <Pause className="h-3.5 w-3.5 mr-2" />
                      {togglingAutoSyncId === contract.id
                        ? "切替中..."
                        : contract.cloudsignAutoSync
                        ? "自動同期を停止"
                        : "自動同期を再開"}
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
                  disabled={linkingContractId === contract.id}
                  onClick={handleLinkCloudsign}
                >
                  <Link2 className="h-3.5 w-3.5 mr-2" />
                  {linkingContractId === contract.id ? "紐付け中..." : "CloudSignと紐付け"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 展開部分 */}
      {expanded && (
        <div className="border-t">
          {/* 契約書の詳細情報（展開時のみ表示） */}
          {(contract.signingMethod || hasFiles || contract.parentContract || contract.cloudsignTitle != null ||
            (contract.cloudsignDocumentId && contract.cloudsignAutoSync === false) ||
            (contract.cloudsignSelfSigningEmailId && contract.cloudsignSelfSignedAt)) && (
            <div className="px-4 py-2 bg-gray-50/30 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {contract.cloudsignTitle != null && (
                <span className="flex items-center gap-0.5 text-muted-foreground">
                  <Cloud className="h-3 w-3" />
                  {contract.cloudsignTitle}
                </span>
              )}
              {contract.signingMethod && (
                <span>方法: {signingMethodOptions.find(o => o.value === contract.signingMethod)?.label}</span>
              )}
              {contract.parentContract && (
                <span>親契約: {contract.parentContract.contractNumber}</span>
              )}
              {contract.cloudsignDocumentId && contract.cloudsignAutoSync === false && (
                <span className="inline-flex items-center rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 border border-orange-200">
                  同期停止中
                </span>
              )}
              {contract.cloudsignSelfSigningEmailId && contract.cloudsignSelfSignedAt && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700 border border-green-200">
                  <PenTool className="h-2.5 w-2.5" />
                  自社署名済
                </span>
              )}
              {contract.filePath && contract.fileName && (
                <button
                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                  onClick={() => window.open(contract.filePath!, "_blank")}
                  title={`署名PDF: ${contract.fileName}`}
                >
                  <PenTool className="h-2.5 w-2.5" />
                  <FileText className="h-3 w-3" />
                </button>
              )}
              {contract.contractFiles && contract.contractFiles.length > 0 && (
                <span className="flex items-center gap-1">
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
                </span>
              )}
            </div>
          )}
          {isAgentMode ? (
            <>
              {(contract.agentContractHistories || []).length > 0 ? (
                <div className="divide-y">
                  {(contract.agentContractHistories || []).map((history) => (
                    <AgentContractHistoryRow
                      key={history.id}
                      history={history}
                      onEdit={() => onEditAgentHistory?.(history)}
                      onDelete={() => onDeleteAgentHistory?.(history.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2 text-xs text-gray-400">紐づく契約条件なし</div>
              )}
              <div className="px-4 py-2 border-t bg-gray-50/30">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  onClick={() => onAddAgentHistoryForContract?.(contract.id)}
                >
                  <Plus className="h-3 w-3" />
                  この契約書に契約条件を追加
                </button>
              </div>
            </>
          ) : (
            <>
              {contract.contractHistories.length > 0 ? (
                <div className="divide-y">
                  {contract.contractHistories.map((history) => (
                    <ContractHistoryRow
                      key={history.id}
                      history={history}
                      onEdit={() => onEditHistory(history)}
                      onDelete={() => onDeleteHistory(history.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2 text-xs text-gray-400">紐づく契約履歴なし</div>
              )}
              <div className="px-4 py-2 border-t bg-gray-50/30">
                <button
                  type="button"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  onClick={() => onAddHistoryForContract(contract.id)}
                >
                  <Plus className="h-3 w-3" />
                  この契約書に契約履歴を追加
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
