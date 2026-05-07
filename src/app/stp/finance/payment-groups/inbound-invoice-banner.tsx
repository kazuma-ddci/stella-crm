"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Mail,
  FileText,
  Check,
  X,
  Link2,
  AlertTriangle,
  Eye,
  ExternalLink,
  Paperclip,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { PendingInboundInvoice } from "./inbound-invoice-actions";
import type { MatchablePaymentGroup } from "./inbound-invoice-actions";
import {
  confirmInboundInvoice,
  rejectInboundInvoice,
  matchInboundInvoiceToGroup,
} from "./inbound-invoice-actions";

type Props = {
  invoices: PendingInboundInvoice[];
  matchableGroups: MatchablePaymentGroup[];
};

const CONFIDENCE_CONFIG: Record<string, { label: string; detail: string; className: string }> = {
  high: {
    label: "高",
    detail: "参照コード + ドメイン一致",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  medium: {
    label: "中",
    detail: "送信元ドメイン不一致",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  low: {
    label: "低",
    detail: "ドメイン推定のみ",
    className: "bg-red-100 text-red-800 border-red-200",
  },
};

// invoice_received 以降のステータス
const ALREADY_RECEIVED_STATUSES = [
  "invoice_received", "confirmed", "awaiting_accounting", "returned", "paid",
];

const STORAGE_KEY = "stp-payment-groups-inbound-invoice-expanded";
const storageListeners = new Set<() => void>();

function subscribeToExpandedStorage(callback: () => void) {
  storageListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    storageListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getExpandedSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getExpandedServerSnapshot() {
  return false;
}

function setStoredExpanded(expanded: boolean) {
  localStorage.setItem(STORAGE_KEY, String(expanded));
  storageListeners.forEach((callback) => callback());
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const config = CONFIDENCE_CONFIG[confidence];
  if (!config) return null;
  return (
    <Badge className={config.className}>
      {config.label}（{config.detail}）
    </Badge>
  );
}

function formatDate(isoString: string) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ============================================
// プレビューモーダル
// ============================================

function InvoicePreviewModal({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: PendingInboundInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            メールプレビュー
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto space-y-3">
          <div className="space-y-3 p-4 border rounded bg-muted/30">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-muted-foreground">差出人:</span>
              <span>
                {invoice.fromName
                  ? `${invoice.fromName} <${invoice.fromEmail}>`
                  : invoice.fromEmail}
              </span>
              <span className="font-medium text-muted-foreground">件名:</span>
              <span>{invoice.subject ?? "(件名なし)"}</span>
              <span className="font-medium text-muted-foreground">受信日時:</span>
              <span>{new Date(invoice.receivedAt).toLocaleString("ja-JP")}</span>
            </div>

            {invoice.attachmentPath ? (
              <div className="flex items-center gap-2 p-2 bg-white border rounded">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">
                  {invoice.attachmentFileName ?? "添付ファイル"}
                  {invoice.attachmentSize ? ` (${formatFileSize(invoice.attachmentSize)})` : ""}
                </span>
                <a
                  href={invoice.attachmentPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  添付書類を確認する
                </a>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">添付ファイルなし</div>
            )}

            <hr />

            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {invoice.emailBody ?? (
                <span className="text-muted-foreground italic">
                  メール本文は保存されていません（次回の受信チェックから保存されます）
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// マッチ済みカード
// ============================================

function MatchedInvoiceCard({
  invoice,
}: {
  invoice: PendingInboundInvoice;
}) {
  const [isPending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmInboundInvoice(invoice.id);
      if (result.success) {
        toast.success("請求書を承認しました");
        if (result.warning) {
          toast.warning(result.warning);
        }
      } else {
        toast.error(result.error ?? "承認に失敗しました");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectInboundInvoice(invoice.id);
      if (result.success) {
        toast.success("請求書を却下しました");
      } else {
        toast.error(result.error ?? "却下に失敗しました");
      }
    });
  };

  const pg = invoice.paymentGroup;
  const alreadyReceived = pg ? ALREADY_RECEIVED_STATUSES.includes(pg.status) : false;

  return (
    <div className="border rounded-lg px-3 py-2.5 space-y-2 bg-white">
      {alreadyReceived && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>この支払は既に請求書受領済みです。承認すると追加の証憑として保存されます。</span>
        </div>
      )}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Badge variant="outline" className="font-mono text-xs">
            {pg?.referenceCode ?? "---"}
          </Badge>
          <span className="font-medium text-sm truncate">
            {pg?.counterpartyName ?? "不明"}
          </span>
          {pg?.totalAmount != null && (
            <span className="text-sm text-muted-foreground">
              ¥{pg.totalAmount.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground mr-1">信頼度:</span>
          <ConfidenceBadge confidence={invoice.matchConfidence} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
        <FileText className="h-3.5 w-3.5" />
        <span className="truncate">{invoice.attachmentFileName ?? "添付ファイルなし"}</span>
        {invoice.attachmentSize && (
          <span className="text-xs">
            ({formatFileSize(invoice.attachmentSize)})
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        <span className="truncate">
          {invoice.fromName
            ? `${invoice.fromName} <${invoice.fromEmail}>`
            : invoice.fromEmail}
        </span>
        <span>受信: {formatDate(invoice.receivedAt)}</span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          プレビュー
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReject}
          disabled={isPending}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          却下
        </Button>
        <Button
          size="sm"
          onClick={handleConfirm}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          承認して添付
        </Button>
      </div>

      <InvoicePreviewModal
        invoice={invoice}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

// ============================================
// 未マッチカード
// ============================================

function UnmatchedInvoiceCard({
  invoice,
  matchableGroups,
}: {
  invoice: PendingInboundInvoice;
  matchableGroups: MatchablePaymentGroup[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleMatch = () => {
    if (!selectedGroupId) return;
    startTransition(async () => {
      const result = await matchInboundInvoiceToGroup(
        invoice.id,
        Number(selectedGroupId)
      );
      if (result.success) {
        toast.success("支払グループにマッチしました");
        setSelectedGroupId("");
      } else {
        toast.error(result.error ?? "マッチに失敗しました");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectInboundInvoice(invoice.id);
      if (result.success) {
        toast.success("請求書を無視しました");
      } else {
        toast.error(result.error ?? "処理に失敗しました");
      }
    });
  };

  return (
    <div className="border rounded-lg px-3 py-2.5 space-y-2 border-orange-200 bg-orange-50/30">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-800 border-orange-200"
        >
          マッチなし
        </Badge>
        <span className="text-sm font-medium truncate">
          {invoice.fromName
            ? `${invoice.fromName} <${invoice.fromEmail}>`
            : invoice.fromEmail}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
        <FileText className="h-3.5 w-3.5" />
        <span className="truncate">{invoice.attachmentFileName ?? "添付ファイルなし"}</span>
        {invoice.attachmentSize && (
          <span className="text-xs">
            ({formatFileSize(invoice.attachmentSize)})
          </span>
        )}
      </div>

      {invoice.subject && (
        <div className="text-xs text-muted-foreground">
          件名: {invoice.subject}
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        受信: {formatDate(invoice.receivedAt)} / {invoice.receivedByEmail}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          プレビュー
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {matchableGroups.length === 0 ? (
            <span className="text-xs text-muted-foreground">マッチ可能な支払グループがありません</span>
          ) : (
            <>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs w-[min(220px,calc(100vw-3rem))]">
                  <SelectValue placeholder="支払グループを選択..." />
                </SelectTrigger>
                <SelectContent>
                  {matchableGroups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.referenceCode ?? `#${g.id}`} {g.counterpartyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMatch}
                disabled={isPending || !selectedGroupId}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                マッチ
              </Button>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReject}
          disabled={isPending}
          className="text-muted-foreground hover:text-red-600"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          無視
        </Button>
      </div>

      <InvoicePreviewModal
        invoice={invoice}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

export function InboundInvoiceBanner({ invoices, matchableGroups }: Props) {
  const expanded = useSyncExternalStore(
    subscribeToExpandedStorage,
    getExpandedSnapshot,
    getExpandedServerSnapshot
  );

  if (invoices.length === 0) return null;

  const matched = invoices.filter((inv) => inv.status === "pending");
  const unmatched = invoices.filter((inv) => inv.status === "unmatched");

  const handleToggle = () => {
    setStoredExpanded(!expanded);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={expanded}
          className="flex w-full flex-col gap-3 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:px-6"
        >
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">
              請求書が届いています ({invoices.length}件)
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {unmatched.length > 0 && (
              <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                マッチなし {unmatched.length}件
              </Badge>
            )}
            {matched.length > 0 && (
              <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                マッチ済み {matched.length}件
              </Badge>
            )}
            <ChevronDown
              className={`h-4 w-4 text-blue-700 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </button>

        {expanded && (
          <div className="space-y-4 border-t border-blue-100 px-4 py-4 sm:px-6">
            {unmatched.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-orange-900">マッチなし</h4>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-700 border-orange-200">
                    {unmatched.length}件
                  </Badge>
                </div>
                <div className="space-y-2">
                  {unmatched.map((inv) => (
                    <UnmatchedInvoiceCard
                      key={inv.id}
                      invoice={inv}
                      matchableGroups={matchableGroups}
                    />
                  ))}
                </div>
              </section>
            )}

            {matched.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-green-900">マッチ済み</h4>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-700 border-green-200">
                    {matched.length}件
                  </Badge>
                </div>
                <div className="space-y-2">
                  {matched.map((inv) => (
                    <MatchedInvoiceCard key={inv.id} invoice={inv} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
