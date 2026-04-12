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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Send,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Info,
  Mail,
  ExternalLink,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  getContractAttempts,
  declineContractAttempt,
  manualSendContract,
  saveManualCheckResult,
  getMemberGuidanceStatus,
} from "./contract-attempt-actions";

// --- Types ---

type Attempt = Awaited<ReturnType<typeof getContractAttempts>>[number];
type GuidanceStatus = Awaited<ReturnType<typeof getMemberGuidanceStatus>>;

interface ContractAttemptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: number;
  memberName: string;
}

// --- Guidance config ---

const GUIDANCE_CONFIG: Record<
  string,
  {
    icon: typeof CheckCircle2;
    iconColor: string;
    bgColor: string;
    borderColor: string;
    title: string;
    description: string;
    actions: string[];
  }
> = {
  delivered_pending: {
    icon: Send,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    title: "契約書送付済み",
    description: "契約書はお客様に送付済みです。署名をお待ちください。",
    actions: [],
  },
  completed: {
    icon: CheckCircle2,
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    title: "契約書締結済み",
    description: "契約書は正常に締結されています。",
    actions: [],
  },
  bounced: {
    icon: XCircle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    title: "メール不達",
    description:
      "送付先メールアドレスにメールが届きませんでした。",
    actions: [
      "下の送付履歴から、未到達の契約書を「クラウドサインで破棄する」で破棄してください",
      "正しいメールアドレスで再送付してください",
    ],
  },
  bounce_confirmed: {
    icon: AlertTriangle,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    title: "メール不達（お客様確認済み）",
    description:
      "お客様に確認済みのメールアドレスでも不達が発生しました。",
    actions: [
      "下の送付履歴から、未到達の契約書を破棄してください",
      "手動送付フォームから契約書を送付してください",
    ],
  },
  api_error: {
    icon: AlertCircle,
    iconColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    title: "システムエラー",
    description:
      "クラウドサインへの送付時にシステムエラーが発生しました。",
    actions: [
      "クラウドサインにログインして、書類が作成されているか手動で確認してください",
      "下の送付履歴から「確認結果を入力」で結果を記録してください",
    ],
  },
  email_change_failed: {
    icon: XCircle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    title: "メアド変更後の送付失敗",
    description:
      "メールアドレス変更後の再送付に失敗しました。",
    actions: [
      "下の送付履歴から、失敗した契約書を破棄してください",
      "公式LINEでお客様に送付先メールアドレスを確認してください",
      "手動送付フォームから契約書を送付してください",
    ],
  },
  auto_send_locked: {
    icon: AlertTriangle,
    iconColor: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    title: "自動送付の上限",
    description:
      "自動送付の上限に達したため、自動での再送付が停止されています。",
    actions: [
      "下の送付履歴から、不要な契約書を破棄してください",
      "手動送付フォームから契約書を送付してください",
    ],
  },
  no_valid_contract: {
    icon: XCircle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    title: "有効な契約書なし",
    description:
      "現在有効な契約書がありません。手動で送付してください。",
    actions: ["手動送付フォームから契約書を送付してください"],
  },
  parallel_contracts: {
    icon: Info,
    iconColor: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    title: "2通の契約書が並行中",
    description:
      "新旧2通の契約書が同時に存在しています。新しい方で締結されると、旧い方は自動で破棄されます。",
    actions: [],
  },
};

// --- Send result badge ---

function SendResultBadge({ result }: { result: string }) {
  switch (result) {
    case "delivered":
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
          送信済み
        </Badge>
      );
    case "bounced":
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50">
          メール不達
        </Badge>
      );
    case "api_error":
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
          システムエラー
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{result}</Badge>
      );
  }
}

// --- CloudSign status badge ---

function CloudsignStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
          先方確認中
        </Badge>
      );
    case "completed":
      return (
        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50">
          締結済み
        </Badge>
      );
    case "canceled":
      return (
        <Badge className="bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100">
          破棄済み
        </Badge>
      );
    case "unknown":
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
          不明
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">{status}</Badge>
      );
  }
}

// --- Trigger type label ---

function triggerTypeLabel(type: string): string {
  switch (type) {
    case "initial":
      return "初回送付";
    case "bounce_fix":
      return "不達修正";
    case "email_change":
      return "メアド変更";
    case "staff_manual":
      return "スタッフ手動";
    default:
      return type;
  }
}

// --- Manual check form (expandable) ---

function ManualCheckForm({
  attemptId,
  onSaved,
}: {
  attemptId: number;
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [checkResult, setCheckResult] = useState<
    "found_pending" | "found_completed" | "not_found" | ""
  >("");
  const [documentId, setDocumentId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!checkResult) return;
    setSaving(true);
    try {
      const result = await saveManualCheckResult(attemptId, {
        checkResult,
        documentId: documentId.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("確認結果を保存しました");
      setExpanded(false);
      onSaved();
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={() => setExpanded(true)}
      >
        確認結果を入力
      </Button>
    );
  }

  return (
    <div className="mt-2 border rounded-lg p-3 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">クラウドサインでの確認結果</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(false)}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`check-${attemptId}`}
            value="found_pending"
            checked={checkResult === "found_pending"}
            onChange={() => setCheckResult("found_pending")}
            className="accent-blue-600"
          />
          書類が見つかった（先方確認中）
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`check-${attemptId}`}
            value="found_completed"
            checked={checkResult === "found_completed"}
            onChange={() => setCheckResult("found_completed")}
            className="accent-blue-600"
          />
          書類が見つかった（締結済み）
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name={`check-${attemptId}`}
            value="not_found"
            checked={checkResult === "not_found"}
            onChange={() => setCheckResult("not_found")}
            className="accent-blue-600"
          />
          書類は見つからなかった
        </label>
      </div>

      {(checkResult === "found_pending" ||
        checkResult === "found_completed") && (
        <div>
          <label className="text-xs text-gray-600">
            ドキュメントID（任意）
          </label>
          <Input
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="例: abcdef12-3456-..."
            className="mt-1"
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!checkResult || saving}
          onClick={handleSave}
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              保存中...
            </>
          ) : (
            "確認結果を保存"
          )}
        </Button>
      </div>
    </div>
  );
}

// --- Attempt row ---

function AttemptRow({
  attempt,
  onRefresh,
}: {
  attempt: Attempt;
  onRefresh: () => void;
}) {
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);

  const needsDecline =
    (attempt.sendResult === "bounced" || attempt.sendResult === "api_error") &&
    attempt.cloudsignStatus === "pending" &&
    !attempt.declinedAt;

  const canDeclineDelivered =
    attempt.sendResult === "delivered" &&
    attempt.cloudsignStatus === "pending" &&
    !attempt.declinedAt;

  const needsManualCheck =
    attempt.sendResult === "api_error" && !attempt.manualCheckResult;

  const handleDecline = async () => {
    if (
      !confirm(
        "この契約書をCRM上で「破棄済み」にします。クラウドサインのAPIでも破棄を試みます。よろしいですか？"
      )
    )
      return;
    setDeclining(true);
    setDeclineError(null);
    try {
      const result = await declineContractAttempt(attempt.id);
      if (!result.ok) {
        setDeclineError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("契約書を破棄しました");
      onRefresh();
    } catch {
      setDeclineError(
        "破棄に失敗しました。クラウドサインにログインして手動で破棄してください。"
      );
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs text-gray-400 shrink-0">
          #{attempt.sequence}
        </span>
        <span className="text-gray-700 truncate max-w-[200px]" title={attempt.email}>
          {attempt.email}
        </span>
        <SendResultBadge result={attempt.sendResult} />
        <CloudsignStatusBadge status={attempt.cloudsignStatus ?? "unknown"} />
        <Badge variant="outline" className="text-[10px]">
          {triggerTypeLabel(attempt.triggerType)}
        </Badge>
        <span className="text-xs text-gray-400 ml-auto shrink-0">
          {new Date(attempt.createdAt).toLocaleString("ja-JP")}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {needsDecline && (
          <>
            {attempt.cloudsignUrl && (
              <a
                href={attempt.cloudsignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                クラウドサインで破棄する
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-xs text-red-600 border-red-200 hover:bg-red-50"
              disabled={declining}
              onClick={handleDecline}
            >
              {declining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              破棄済みにする
            </Button>
          </>
        )}

        {canDeclineDelivered && (
          <>
            {attempt.cloudsignUrl && (
              <a
                href={attempt.cloudsignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                クラウドサインで破棄する
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-400 hover:text-red-600"
              disabled={declining}
              onClick={handleDecline}
            >
              {declining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              破棄済みにする
            </Button>
          </>
        )}

        {needsManualCheck && (
          <ManualCheckForm attemptId={attempt.id} onSaved={onRefresh} />
        )}
      </div>

      {/* Decline error message */}
      {declineError && (
        <p className="text-xs text-red-600 bg-red-50 rounded p-2">
          {declineError}
          {attempt.cloudsignUrl && (
            <>
              {" "}
              <a
                href={attempt.cloudsignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                クラウドサインを開く
              </a>
            </>
          )}
        </p>
      )}

      {/* Show existing decline error from DB */}
      {attempt.declineError && !declineError && (
        <p className="text-xs text-orange-600 bg-orange-50 rounded p-2">
          破棄時にエラーが発生しました: {attempt.declineError}
          {attempt.cloudsignUrl && (
            <>
              {" "}
              <a
                href={attempt.cloudsignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                クラウドサインにログインして手動で破棄してください
              </a>
            </>
          )}
        </p>
      )}

      {/* Manual check result display */}
      {attempt.manualCheckResult && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded p-2">
          手動確認結果:{" "}
          {attempt.manualCheckResult === "found_pending"
            ? "書類あり（先方確認中）"
            : attempt.manualCheckResult === "found_completed"
              ? "書類あり（締結済み）"
              : attempt.manualCheckResult === "not_found"
                ? "書類なし"
                : attempt.manualCheckResult}
        </p>
      )}
    </div>
  );
}

// --- Main modal ---

export function ContractAttemptModal({
  open,
  onOpenChange,
  memberId,
  memberName,
}: ContractAttemptModalProps) {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [guidance, setGuidance] = useState<GuidanceStatus>(null);
  const [loading, setLoading] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [emailWarning, setEmailWarning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [attemptsData, guidanceData] = await Promise.all([
        getContractAttempts(memberId),
        getMemberGuidanceStatus(memberId),
      ]);
      setAttempts(attemptsData);
      setGuidance(guidanceData);
      if (guidanceData?.memberEmail) {
        setSendEmail(guidanceData.memberEmail);
      }
    } catch {
      toast.error("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (open) {
      loadData();
      setEmailWarning(false);
    }
  }, [open, loadData]);

  // Check email against failed list
  useEffect(() => {
    if (guidance?.failedEmails && sendEmail) {
      setEmailWarning(guidance.failedEmails.includes(sendEmail));
    } else {
      setEmailWarning(false);
    }
  }, [sendEmail, guidance?.failedEmails]);

  const handleSend = async () => {
    if (!sendEmail.trim()) {
      toast.error("メールアドレスを入力してください");
      return;
    }
    if (
      emailWarning &&
      !confirm(
        "このメールアドレスには以前送付を試みましたが失敗しています。本当に送付しますか？（220円/通）"
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const result = await manualSendContract(memberId, sendEmail.trim());
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("契約書を送付しました");
      await loadData();
    } catch {
      toast.error("送付に失敗しました");
    } finally {
      setSending(false);
    }
  };

  const guidanceConfig = guidance?.overallStatus
    ? GUIDANCE_CONFIG[guidance.overallStatus]
    : null;

  const showSendForm =
    guidance && !guidance.hasUndeclinedFailure && !guidance.hasPendingContract;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="mixed"
        className="p-0 overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>送付履歴 — {memberName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">読み込み中...</span>
          </div>
        ) : (
          <div className="px-6 py-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
            {/* --- Guidance section --- */}
            {guidanceConfig && (
              <div
                className={`rounded-lg border p-4 ${guidanceConfig.bgColor} ${guidanceConfig.borderColor}`}
              >
                <div className="flex items-start gap-3">
                  <guidanceConfig.icon
                    className={`h-5 w-5 mt-0.5 shrink-0 ${guidanceConfig.iconColor}`}
                  />
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-sm">
                      {guidanceConfig.title}
                    </h3>
                    <p className="text-sm text-gray-700">
                      {guidanceConfig.description}
                    </p>
                    {guidanceConfig.actions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">
                          やること:
                        </p>
                        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-0.5">
                          {guidanceConfig.actions.map((action, i) => (
                            <li key={i}>{action}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {guidance?.hasEverDelivered &&
                      [
                        "bounced",
                        "bounce_confirmed",
                        "email_change_failed",
                      ].includes(guidance.overallStatus) && (
                        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded p-2 mt-2 flex items-start gap-1.5">
                          <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                          お客様は以前メールを受信しています。公式LINEで送付先を確認してください。
                        </p>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* --- Manual send form --- */}
            {showSendForm && (
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Send className="h-4 w-4" />
                  手動で契約書を送付
                </h3>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-600 mb-1 block">
                      送付先メールアドレス
                    </label>
                    <Input
                      type="email"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      placeholder="example@email.com"
                    />
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={sending || !sendEmail.trim()}
                  >
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        送付中...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        契約書を送付する
                      </>
                    )}
                  </Button>
                </div>
                {emailWarning && (
                  <p className="text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded p-2 flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    このメールアドレスには以前送付を試みましたが失敗しています。本当に送付しますか？（220円/通）
                  </p>
                )}
              </div>
            )}

            {guidance?.hasUndeclinedFailure && !guidance.hasPendingContract && (
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <p className="text-sm text-orange-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  未到達の契約書があります。送付する前に、以下の未到達の契約書をクラウドサインで破棄してください。
                </p>
              </div>
            )}

            {/* --- Attempts list --- */}
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium text-gray-700">
                送付履歴（{attempts.length}件）
              </h3>
              {attempts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  送付履歴はまだありません
                </div>
              ) : (
                <div className="space-y-2">
                  {attempts.map((attempt) => (
                    <AttemptRow
                      key={attempt.id}
                      attempt={attempt}
                      onRefresh={loadData}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
