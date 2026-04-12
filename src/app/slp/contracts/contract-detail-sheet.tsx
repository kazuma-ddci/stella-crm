"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Download,
  FileText,
  Bell,
  RefreshCw,
  Zap,
  ZapOff,
  Pencil,
  Loader2,
} from "lucide-react";
import {
  CloudsignInputSection,
  type CloudsignInputData,
} from "@/components/cloudsign-input-section";

export type ContractDetailRow = {
  id: number;
  contractNumber: string | null;
  contractType: string;
  memberName: string;
  memberEmail: string;
  memberBounced: boolean;
  title: string;
  statusName: string;
  statusType: "progress" | "signed" | "discarded";
  cloudsignStatus: string | null;
  cloudsignAutoSync: boolean;
  cloudsignDocumentId: string | null;
  cloudsignUrl: string | null;
  sentAt: string;
  completedAt: string;
  signedDate: string;
  lastRemindedAt: string;
  // ソート用 raw 値
  sentAtRaw: string | null;
  completedAtRaw: string | null;
  signedDateRaw: string | null;
  lastRemindedAtRaw: string | null;
  createdAtRaw: string;
  filePath: string | null;
  fileName: string | null;
  note: string | null;
  createdAt: string;
  cloudsignInputData: CloudsignInputData | null;
  contractFiles: Array<{ id: number; filePath: string; fileName: string }>;
  statusHistories: Array<{
    id: number;
    eventType: string;
    fromStatusName: string | null;
    toStatusName: string | null;
    changedBy: string | null;
    note: string | null;
    recordedAt: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: ContractDetailRow | null;
  loading: boolean;
  onOpenStatusDialog: (contractId: number) => void;
  onRemind: (contractId: number) => void;
  onManualSync: (contractId: number) => void;
  onToggleAutoSync: (contractId: number) => void;
};

function statusBadge(statusName: string, statusType: string) {
  const variant =
    statusType === "signed"
      ? "default"
      : statusType === "discarded"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{statusName}</Badge>;
}

export function ContractDetailSheet({
  open,
  onOpenChange,
  contract,
  loading,
  onOpenStatusDialog,
  onRemind,
  onManualSync,
  onToggleAutoSync,
}: Props) {
  if (!contract) return null;

  const canRemind = contract.cloudsignStatus === "sent";
  const canManualSync = !!contract.cloudsignDocumentId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 pr-12 border-b">
          <div className="flex items-start gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px]">
              {contract.contractType || "種別未設定"}
            </Badge>
            {statusBadge(contract.statusName, contract.statusType)}
            {contract.contractNumber && (
              <span className="text-[10px] text-gray-500 font-mono">
                {contract.contractNumber}
              </span>
            )}
          </div>
          <SheetTitle className="text-lg leading-tight break-all text-left">
            {contract.title}
          </SheetTitle>
          <SheetDescription className="text-left text-xs">
            {contract.memberName}（{contract.memberEmail}）
          </SheetDescription>
        </SheetHeader>

        {/* アクションバー */}
        <div className="px-6 py-3 border-b bg-gray-50/50 flex flex-wrap items-center gap-2">
          {loading && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400 mr-1" />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenStatusDialog(contract.id)}
            disabled={loading}
          >
            <Pencil className="h-3 w-3 mr-1" />
            ステータス変更
          </Button>
          {canRemind && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemind(contract.id)}
              disabled={loading}
            >
              <Bell className="h-3 w-3 mr-1" />
              リマインド送付
            </Button>
          )}
          {canManualSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManualSync(contract.id)}
              disabled={loading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              手動同期
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleAutoSync(contract.id)}
            disabled={loading}
          >
            {contract.cloudsignAutoSync ? (
              <>
                <ZapOff className="h-3 w-3 mr-1" />
                自動同期OFF
              </>
            ) : (
              <>
                <Zap className="h-3 w-3 mr-1" />
                自動同期ON
              </>
            )}
          </Button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* 日付情報 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">日付</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <dt className="text-gray-500">送付日時</dt>
              <dd>{contract.sentAt}</dd>
              <dt className="text-gray-500">締結日</dt>
              <dd>{contract.signedDate}</dd>
              <dt className="text-gray-500">CloudSign締結日時</dt>
              <dd>{contract.completedAt}</dd>
              <dt className="text-gray-500">最終リマインド</dt>
              <dd>{contract.lastRemindedAt}</dd>
              <dt className="text-gray-500">作成日時</dt>
              <dd>{contract.createdAt}</dd>
            </dl>
          </section>

          {/* リンク・ファイル */}
          <section>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">リンク・ファイル</h3>
            <div className="flex flex-wrap gap-2">
              {contract.cloudsignDocumentId && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://www.cloudsign.jp/document/${contract.cloudsignDocumentId}/summary`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    CloudSignで開く
                  </a>
                </Button>
              )}
              {contract.filePath && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={contract.filePath}
                    download={contract.fileName ?? undefined}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    署名済PDF
                  </a>
                </Button>
              )}
              {contract.contractFiles.map((f) => (
                <Button key={f.id} variant="outline" size="sm" asChild>
                  <a href={f.filePath} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-3 w-3 mr-1" />
                    {f.fileName}
                  </a>
                </Button>
              ))}
              {!contract.cloudsignUrl &&
                !contract.filePath &&
                contract.contractFiles.length === 0 && (
                  <span className="text-xs text-gray-400">添付なし</span>
                )}
            </div>
          </section>

          {/* メモ */}
          {contract.note && (
            <section>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">メモ</h3>
              <p className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 border rounded p-2">
                {contract.note}
              </p>
            </section>
          )}

          {/* 締結時の入力内容 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-700 mb-2">
              締結時の入力内容
            </h3>
            {contract.cloudsignInputData &&
            Array.isArray(contract.cloudsignInputData.widgets) &&
            contract.cloudsignInputData.widgets.length > 0 ? (
              <div className="border rounded p-3 bg-blue-50/20">
                {(() => {
                  const captured = contract.cloudsignInputData.capturedAt;
                  const d = captured ? new Date(captured) : null;
                  const valid = d && !Number.isNaN(d.getTime());
                  return valid ? (
                    <div className="text-[10px] text-gray-400 mb-2">
                      取得日時:{" "}
                      {d!.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </div>
                  ) : null;
                })()}
                <CloudsignInputSection
                  data={contract.cloudsignInputData}
                  showHeader={false}
                  plain={true}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                締結時の入力データはまだ取得されていません。
              </p>
            )}
          </section>

          {/* ステータス変更履歴 */}
          {contract.statusHistories.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">
                ステータス変更履歴
              </h3>
              <ol className="border rounded divide-y">
                {contract.statusHistories.map((h) => (
                  <li key={h.id} className="px-3 py-2 text-xs">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-gray-500">{h.recordedAt}</span>
                      <span className="font-medium">
                        {h.fromStatusName ?? "-"} → {h.toStatusName ?? "-"}
                      </span>
                      {h.changedBy && (
                        <span className="text-gray-500">by {h.changedBy}</span>
                      )}
                    </div>
                    {h.note && (
                      <div className="text-gray-600 mt-0.5">{h.note}</div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
