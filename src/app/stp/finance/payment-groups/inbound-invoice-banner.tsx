"use client";

import { useState, useTransition } from "react";
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
import { Mail, FileText, Check, X, Link2, AlertTriangle } from "lucide-react";
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

function MatchedInvoiceCard({
  invoice,
}: {
  invoice: PendingInboundInvoice;
}) {
  const [isPending, startTransition] = useTransition();

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
    <div className="border rounded-lg p-4 space-y-2">
      {alreadyReceived && (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>この支払は既に請求書受領済みです。承認すると追加の証憑として保存されます。</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {pg?.referenceCode ?? "---"}
          </Badge>
          <span className="font-medium text-sm">
            {pg?.counterpartyName ?? "不明"}
          </span>
          {pg?.totalAmount != null && (
            <span className="text-sm text-muted-foreground">
              ¥{pg.totalAmount.toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">信頼度:</span>
          <ConfidenceBadge confidence={invoice.matchConfidence} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>{invoice.attachmentFileName ?? "添付ファイルなし"}</span>
        {invoice.attachmentSize && (
          <span className="text-xs">
            ({formatFileSize(invoice.attachmentSize)})
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-3 w-3" />
        <span>
          {invoice.fromName
            ? `${invoice.fromName} <${invoice.fromEmail}>`
            : invoice.fromEmail}
        </span>
        <span>受信: {formatDate(invoice.receivedAt)}</span>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {invoice.attachmentPath && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={invoice.attachmentPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              プレビュー
            </a>
          </Button>
        )}
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
    </div>
  );
}

function UnmatchedInvoiceCard({
  invoice,
  matchableGroups,
}: {
  invoice: PendingInboundInvoice;
  matchableGroups: MatchablePaymentGroup[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

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
    <div className="border rounded-lg p-4 space-y-2 border-orange-200 bg-orange-50/30">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-800 border-orange-200"
        >
          マッチなし
        </Badge>
        <span className="text-sm font-medium">
          {invoice.fromName
            ? `${invoice.fromName} <${invoice.fromEmail}>`
            : invoice.fromEmail}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        <span>{invoice.attachmentFileName ?? "添付ファイルなし"}</span>
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

      <div className="flex items-center justify-end gap-2 pt-1">
        {invoice.attachmentPath && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={invoice.attachmentPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              プレビュー
            </a>
          </Button>
        )}
        <div className="flex items-center gap-1">
          {matchableGroups.length === 0 ? (
            <span className="text-xs text-muted-foreground">マッチ可能な支払グループがありません</span>
          ) : (
            <>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="h-8 text-xs w-[200px]">
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
    </div>
  );
}

export function InboundInvoiceBanner({ invoices, matchableGroups }: Props) {
  if (invoices.length === 0) return null;

  const matched = invoices.filter((inv) => inv.status === "pending");
  const unmatched = invoices.filter((inv) => inv.status === "unmatched");

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">
            請求書が届いています ({invoices.length}件)
          </h3>
        </div>

        {matched.length > 0 && (
          <div className="space-y-3">
            {matched.map((inv) => (
              <MatchedInvoiceCard key={inv.id} invoice={inv} />
            ))}
          </div>
        )}

        {unmatched.length > 0 && (
          <div className="space-y-3">
            {unmatched.map((inv) => (
              <UnmatchedInvoiceCard
                key={inv.id}
                invoice={inv}
                matchableGroups={matchableGroups}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
