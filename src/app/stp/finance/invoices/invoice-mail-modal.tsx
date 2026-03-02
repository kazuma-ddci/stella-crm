"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Loader2,
  Mail,
  Send,
  Plus,
  X,
  RefreshCw,
  CheckCircle2,
  CheckIcon,
  XCircle,
  Clock,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import * as SelectPrimitive from "@radix-ui/react-select";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { expandTemplate } from "@/lib/email/template-utils";
import { addContact } from "@/app/companies/contact-actions";
import type { InvoiceMailFormData } from "./mail-actions";
import {
  getInvoiceMailData,
  sendInvoiceMail,
  resendInvoiceMail,
  recordManualSend,
} from "./mail-actions";

// ============================================
// 型定義
// ============================================

type Recipient = {
  contactId?: number | null;
  name: string | null;
  email: string;
  type: "to" | "cc" | "bcc";
};

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceGroupId: number;
};

const SEND_METHOD_LABELS: Record<string, string> = {
  email: "メール",
  line: "LINE",
  postal: "郵送",
  other: "その他",
};

const MAIL_STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  draft: { label: "下書き", variant: "secondary" },
  sent: { label: "送信済み", variant: "default" },
  failed: { label: "送信失敗", variant: "destructive" },
};

// ============================================
// メインコンポーネント
// ============================================

export function InvoiceMailModal({ open, onClose, invoiceGroupId }: Props) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<InvoiceMailFormData | null>(null);
  const [activeTab, setActiveTab] = useState<"email" | "manual" | "history">(
    "email"
  );

  // メール送信フォーム
  const [senderEmailId, setSenderEmailId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  // 経理引渡オプション
  const [submitToAccounting, setSubmitToAccounting] = useState(false);

  // 手動入力用
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualType, setManualType] = useState<"to" | "cc" | "bcc">("to");

  // 担当者追加確認用
  const [pendingContacts, setPendingContacts] = useState<
    { name: string; email: string }[]
  >([]);

  // 手動送付記録
  const [manualSendMethod, setManualSendMethod] = useState<
    "line" | "postal" | "other"
  >("line");
  const [manualNote, setManualNote] = useState("");

  // ============================================
  // データ取得
  // ============================================

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getInvoiceMailData(invoiceGroupId);
      setData(result);

      // デフォルト送信元メール
      const defaultEmail = result.senderEmails.find((e) => e.isDefault);
      if (defaultEmail) {
        setSenderEmailId(String(defaultEmail.id));
      } else if (result.senderEmails.length > 0) {
        setSenderEmailId(String(result.senderEmails[0].id));
      }

      // デフォルトテンプレート
      const defaultTemplate = result.templates.find((t) => t.isDefault);
      if (defaultTemplate) {
        setTemplateId(String(defaultTemplate.id));
        applyTemplate(defaultTemplate, result);
      }

      // 主要担当者をTO宛先に追加
      const primaryContacts = result.contacts.filter(
        (c) => c.isPrimary && c.email
      );
      if (primaryContacts.length > 0) {
        setRecipients(
          primaryContacts.map((c) => ({
            contactId: c.id,
            name: c.name,
            email: c.email!,
            type: "to" as const,
          }))
        );
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "データの取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, [invoiceGroupId]);

  useEffect(() => {
    if (open) {
      loadData();
      setShowConfirm(false);
      setActiveTab("email");
    }
  }, [open, loadData]);

  // ============================================
  // テンプレート展開
  // ============================================

  const buildTemplateVariables = useCallback(
    (formData: InvoiceMailFormData): Record<string, string> => {
      const group = formData.invoiceGroup;
      const now = new Date();
      return {
        法人名: group.operatingCompanyName,
        取引先名: group.counterpartyName,
        担当者名:
          recipients.find((r) => r.type === "to")?.name ?? "ご担当者",
        年月: `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, "0")}月`,
        合計金額: group.totalAmount
          ? `¥${group.totalAmount.toLocaleString()}`
          : "",
        支払期限: group.paymentDueDate ?? "",
        受信メールアドレス:
          recipients.find((r) => r.type === "to")?.email ?? "",
      };
    },
    [recipients]
  );

  const applyTemplate = useCallback(
    (
      template: InvoiceMailFormData["templates"][number],
      formData?: InvoiceMailFormData
    ) => {
      const d = formData ?? data;
      if (!d) return;
      const vars = buildTemplateVariables(d);
      setSubject(expandTemplate(template.emailSubjectTemplate, vars));
      setBody(expandTemplate(template.emailBodyTemplate, vars));
    },
    [data, buildTemplateVariables]
  );

  // テンプレート変更時
  const handleTemplateChange = useCallback(
    (newTemplateId: string) => {
      setTemplateId(newTemplateId);
      if (!data || !newTemplateId) return;
      const template = data.templates.find(
        (t) => t.id === Number(newTemplateId)
      );
      if (template) {
        applyTemplate(template);
      }
    },
    [data, applyTemplate]
  );

  // ============================================
  // 宛先操作
  // ============================================

  const addContactAsRecipient = useCallback(
    (
      contact: InvoiceMailFormData["contacts"][number],
      type: "to" | "cc" | "bcc"
    ) => {
      if (!contact.email) return;
      // 既に追加済みか確認
      if (recipients.some((r) => r.email === contact.email)) {
        toast.error("このメールアドレスは既に追加されています");
        return;
      }
      setRecipients((prev) => [
        ...prev,
        {
          contactId: contact.id,
          name: contact.name,
          email: contact.email!,
          type,
        },
      ]);
    },
    [recipients]
  );

  const addManualRecipient = useCallback(() => {
    if (!manualEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualEmail)) {
      toast.error("有効なメールアドレスを入力してください");
      return;
    }
    if (recipients.some((r) => r.email === manualEmail)) {
      toast.error("このメールアドレスは既に追加されています");
      return;
    }
    setRecipients((prev) => [
      ...prev,
      {
        contactId: null,
        name: manualName || null,
        email: manualEmail,
        type: manualType,
      },
    ]);
    setManualEmail("");
    setManualName("");
  }, [manualEmail, manualName, manualType, recipients]);

  const removeRecipient = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }, []);

  const changeRecipientType = useCallback(
    (email: string, newType: "to" | "cc" | "bcc") => {
      setRecipients((prev) =>
        prev.map((r) => (r.email === email ? { ...r, type: newType } : r))
      );
    },
    []
  );

  // ============================================
  // 送信
  // ============================================

  const canSend = useMemo(() => {
    return (
      senderEmailId &&
      recipients.some((r) => r.type === "to") &&
      subject.trim() &&
      body.trim()
    );
  }, [senderEmailId, recipients, subject, body]);

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const result = await sendInvoiceMail({
        invoiceGroupId,
        senderEmailId: Number(senderEmailId),
        templateId: templateId ? Number(templateId) : undefined,
        subject,
        body,
        recipients: recipients.map((r) => ({
          contactId: r.contactId,
          name: r.name,
          email: r.email,
          type: r.type,
        })),
        submitToAccounting,
      });

      if (result.success) {
        toast.success("送信完了しました");
        setShowConfirm(false);

        // 手動入力宛先（名前あり）で取引先がStella全顧客マスタに属している場合、担当者追加を提案
        const manualRecipients = recipients.filter(
          (r) => r.contactId === null && r.name
        );
        if (data?.invoiceGroup.stellaCompanyId && manualRecipients.length > 0) {
          setPendingContacts(
            manualRecipients.map((r) => ({ name: r.name!, email: r.email }))
          );
        } else {
          onClose();
        }
      } else {
        toast.error(`送信に失敗しました: ${result.error}`);
        setShowConfirm(false);
        // 履歴を再読み込み
        await loadData();
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "送信中にエラーが発生しました"
      );
      setShowConfirm(false);
    } finally {
      setSending(false);
    }
  }, [
    canSend,
    invoiceGroupId,
    senderEmailId,
    templateId,
    subject,
    body,
    recipients,
    data,
    onClose,
    loadData,
  ]);

  // ============================================
  // 再送
  // ============================================

  const handleResend = useCallback(
    async (mailId: number) => {
      if (!confirm("このメールを再送しますか？")) return;
      setSending(true);
      try {
        const result = await resendInvoiceMail(mailId);
        if (result.success) {
          toast.success("再送完了しました");
          await loadData();
        } else {
          toast.error(`再送に失敗しました: ${result.error}`);
          await loadData();
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "再送中にエラーが発生しました"
        );
      } finally {
        setSending(false);
      }
    },
    [loadData]
  );

  // ============================================
  // 担当者追加（送信後の確認）
  // ============================================

  const handleAddContacts = useCallback(async () => {
    if (!data?.invoiceGroup.stellaCompanyId || pendingContacts.length === 0) return;
    setSending(true);
    try {
      for (const contact of pendingContacts) {
        await addContact(data.invoiceGroup.stellaCompanyId, {
          name: contact.name,
          email: contact.email,
          isPrimary: false,
        });
      }
      toast.success("担当者を追加しました");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "担当者の追加に失敗しました"
      );
    } finally {
      setSending(false);
      setPendingContacts([]);
      onClose();
    }
  }, [data, pendingContacts, onClose]);

  const handleSkipAddContacts = useCallback(() => {
    setPendingContacts([]);
    onClose();
  }, [onClose]);

  // ============================================
  // 手動送付記録
  // ============================================

  const handleManualRecord = useCallback(async () => {
    setSending(true);
    try {
      await recordManualSend({
        invoiceGroupId,
        sendMethod: manualSendMethod,
        note: manualNote || undefined,
      });
      toast.success("送付記録を保存しました");
      setManualNote("");
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "送付記録の保存に失敗しました"
      );
    } finally {
      setSending(false);
    }
  }, [invoiceGroupId, manualSendMethod, manualNote, onClose]);

  // ============================================
  // レンダリング
  // ============================================

  if (!open) return null;

  const toRecipients = recipients.filter((r) => r.type === "to");
  const ccRecipients = recipients.filter((r) => r.type === "cc");
  const bccRecipients = recipients.filter((r) => r.type === "bcc");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            請求書送付
            {data?.invoiceGroup.invoiceNumber && (
              <span className="font-mono text-sm text-muted-foreground">
                {data.invoiceGroup.invoiceNumber}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="text-center py-8 text-muted-foreground">
            データの取得に失敗しました
          </div>
        ) : (
          <>
            {/* タブ */}
            <div className="flex gap-1 border-b">
              <button
                onClick={() => {
                  setActiveTab("email");
                  setShowConfirm(false);
                }}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "email"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <Mail className="inline h-3.5 w-3.5 mr-1" />
                メール送信
              </button>
              <button
                onClick={() => setActiveTab("manual")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "manual"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                手動記録
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "history"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <Clock className="inline h-3.5 w-3.5 mr-1" />
                送信履歴
                {data.mailHistory.length > 0 && (
                  <span className="ml-1 text-xs">
                    ({data.mailHistory.length})
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {/* ============================================ */}
              {/* メール送信タブ */}
              {/* ============================================ */}
              {activeTab === "email" && !showConfirm && (
                <div className="space-y-4 p-1">
                  {/* 送信先情報 */}
                  <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                    <div>
                      <span className="text-muted-foreground inline-block w-[3em] text-justify mr-1" style={{ textAlignLast: "justify" }}>送付先</span>
                      <span className="text-muted-foreground mr-2">:</span>
                      <span className="font-medium">
                        {data.invoiceGroup.counterpartyName}
                      </span>
                    </div>
                    {data.invoiceGroup.pdfFileName && (
                      <div>
                        <span className="text-muted-foreground inline-block w-[3em] text-justify mr-1" style={{ textAlignLast: "justify" }}>添付</span>
                        <span className="text-muted-foreground mr-2">:</span>
                        <span className="font-medium">
                          {data.invoiceGroup.pdfFileName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 送信元メールアドレス */}
                  <div>
                    <Label>送信元メールアドレス</Label>
                    <Select
                      value={senderEmailId}
                      onValueChange={setSenderEmailId}
                    >
                      <SelectTrigger className="mt-1 w-full">
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {data.senderEmails.map((e) => {
                          const description = e.memo || e.label;
                          return (
                            <SelectPrimitive.Item
                              key={e.id}
                              value={String(e.id)}
                              className="relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                            >
                              <span className="absolute right-2 flex size-3.5 items-center justify-center">
                                <SelectPrimitive.ItemIndicator>
                                  <CheckIcon className="size-4" />
                                </SelectPrimitive.ItemIndicator>
                              </span>
                              <div>
                                <SelectPrimitive.ItemText>
                                  {e.email}
                                </SelectPrimitive.ItemText>
                                {description && (
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    ({description})
                                  </span>
                                )}
                                {e.isDefault && (
                                  <span className="text-muted-foreground ml-1 text-xs">
                                    [デフォルト]
                                  </span>
                                )}
                              </div>
                            </SelectPrimitive.Item>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {data.senderEmails.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        SMTP設定済みの送信元メールアドレスがありません。運営法人マスタで設定してください。
                      </p>
                    )}
                  </div>

                  {/* 宛先選択 */}
                  <div>
                    <Label>宛先</Label>

                    {/* 選択済み宛先 */}
                    {recipients.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {["to", "cc", "bcc"].map((type) => {
                          const filtered = recipients.filter(
                            (r) => r.type === type
                          );
                          if (filtered.length === 0) return null;
                          return (
                            <div key={type} className="flex items-start gap-2">
                              <span className="mt-1 text-xs font-medium text-muted-foreground uppercase w-8">
                                {type}
                              </span>
                              <div className="flex flex-wrap gap-1 flex-1">
                                {filtered.map((r) => (
                                  <Badge
                                    key={r.email}
                                    variant="secondary"
                                    className="gap-1 pr-1"
                                  >
                                    <span>
                                      {r.name
                                        ? `${r.name} <${r.email}>`
                                        : r.email}
                                    </span>
                                    <select
                                      value={r.type}
                                      onChange={(e) =>
                                        changeRecipientType(
                                          r.email,
                                          e.target.value as
                                            | "to"
                                            | "cc"
                                            | "bcc"
                                        )
                                      }
                                      className="text-xs bg-transparent border-none outline-none cursor-pointer"
                                    >
                                      <option value="to">TO</option>
                                      <option value="cc">CC</option>
                                      <option value="bcc">BCC</option>
                                    </select>
                                    <button
                                      onClick={() => removeRecipient(r.email)}
                                      className="ml-0.5 hover:bg-gray-300 rounded p-0.5"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 担当者一覧から選択 */}
                    {data.contacts.length > 0 && (
                      <div className="mt-2 border rounded-lg divide-y max-h-32 overflow-y-auto">
                        {data.contacts
                          .filter(
                            (c) =>
                              c.email &&
                              !recipients.some((r) => r.email === c.email)
                          )
                          .map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center justify-between px-3 py-2 text-sm"
                            >
                              <div>
                                <span className="font-medium">{c.name}</span>
                                {c.department && (
                                  <span className="text-muted-foreground ml-1">
                                    ({c.department})
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-2">
                                  {c.email}
                                </span>
                                {c.isPrimary && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1 text-xs"
                                  >
                                    主
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    addContactAsRecipient(c, "to")
                                  }
                                >
                                  TO
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    addContactAsRecipient(c, "cc")
                                  }
                                >
                                  CC
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() =>
                                    addContactAsRecipient(c, "bcc")
                                  }
                                >
                                  BCC
                                </Button>
                              </div>
                            </div>
                          ))}
                        {data.contacts.filter(
                          (c) =>
                            c.email &&
                            !recipients.some((r) => r.email === c.email)
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                            全ての担当者が追加済みです
                          </div>
                        )}
                      </div>
                    )}

                    {/* 手動入力 */}
                    <div className="mt-2 flex gap-2 items-end">
                      <div className="flex-1">
                        <Input
                          placeholder="メールアドレス"
                          value={manualEmail}
                          onChange={(e) => setManualEmail(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          placeholder="名前(任意)"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <select
                        value={manualType}
                        onChange={(e) =>
                          setManualType(
                            e.target.value as "to" | "cc" | "bcc"
                          )
                        }
                        className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="to">TO</option>
                        <option value="cc">CC</option>
                        <option value="bcc">BCC</option>
                      </select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={addManualRecipient}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* テンプレート選択 */}
                  {data.templates.length > 0 && (
                    <div>
                      <Label htmlFor="template-select">テンプレート</Label>
                      <select
                        id="template-select"
                        value={templateId}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">テンプレートを選択</option>
                        {data.templates.map((t) => (
                          <option key={t.id} value={String(t.id)}>
                            {t.name}
                            {t.isDefault ? " [デフォルト]" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* 件名 */}
                  <div>
                    <Label htmlFor="mail-subject">件名</Label>
                    <Input
                      id="mail-subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="件名を入力"
                      className="mt-1"
                    />
                  </div>

                  {/* 本文 */}
                  <div>
                    <Label htmlFor="mail-body">本文</Label>
                    <Textarea
                      id="mail-body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="本文を入力"
                      rows={8}
                      className="mt-1"
                    />
                  </div>

                  {/* 送信確認ボタン */}
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setShowConfirm(true)}
                      disabled={!canSend || sending}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      送信内容を確認
                    </Button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* 送信確認画面 */}
              {/* ============================================ */}
              {activeTab === "email" && showConfirm && (
                <div className="space-y-4 p-1">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    以下の内容でメールを送信します。内容を確認してください。
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    {/* 送信元 */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        送信元
                      </span>
                      <div className="text-sm">
                        {data.senderEmails.find(
                          (e) => e.id === Number(senderEmailId)
                        )?.email ?? ""}
                      </div>
                    </div>

                    {/* TO */}
                    {toRecipients.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          TO
                        </span>
                        <div className="text-sm">
                          {toRecipients
                            .map((r) =>
                              r.name ? `${r.name} <${r.email}>` : r.email
                            )
                            .join(", ")}
                        </div>
                      </div>
                    )}

                    {/* CC */}
                    {ccRecipients.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          CC
                        </span>
                        <div className="text-sm">
                          {ccRecipients
                            .map((r) =>
                              r.name ? `${r.name} <${r.email}>` : r.email
                            )
                            .join(", ")}
                        </div>
                      </div>
                    )}

                    {/* BCC */}
                    {bccRecipients.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          BCC
                        </span>
                        <div className="text-sm">
                          {bccRecipients
                            .map((r) =>
                              r.name ? `${r.name} <${r.email}>` : r.email
                            )
                            .join(", ")}
                        </div>
                      </div>
                    )}

                    {/* 件名 */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        件名
                      </span>
                      <div className="text-sm font-medium">{subject}</div>
                    </div>

                    {/* 本文 */}
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        本文
                      </span>
                      <div className="text-sm whitespace-pre-wrap bg-white rounded border p-3 mt-1 max-h-40 overflow-y-auto">
                        {body}
                      </div>
                    </div>

                    {/* 添付ファイル */}
                    {data.invoiceGroup.pdfFileName && (
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">
                          添付ファイル
                        </span>
                        <div className="text-sm">
                          {data.invoiceGroup.pdfFileName}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 経理引渡オプション */}
                  <label className="flex items-center gap-2 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={submitToAccounting}
                      onChange={(e) => setSubmitToAccounting(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">送付と同時に経理へ引き渡す</span>
                  </label>

                  {/* 操作ボタン */}
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirm(false)}
                      disabled={sending}
                    >
                      戻る
                    </Button>
                    <Button onClick={handleSend} disabled={sending}>
                      {sending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      送信する
                    </Button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* 手動送付記録タブ */}
              {/* ============================================ */}
              {activeTab === "manual" && (
                <div className="space-y-4 p-1">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm text-muted-foreground">
                    メール以外の方法で請求書を送付した場合に記録します。
                  </div>

                  <div>
                    <Label htmlFor="manual-method">送付方法</Label>
                    <select
                      id="manual-method"
                      value={manualSendMethod}
                      onChange={(e) =>
                        setManualSendMethod(
                          e.target.value as "line" | "postal" | "other"
                        )
                      }
                      className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="line">LINE</option>
                      <option value="postal">郵送</option>
                      <option value="other">その他</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="manual-note">備考（任意）</Label>
                    <Textarea
                      id="manual-note"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="送付に関するメモ"
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleManualRecord} disabled={sending}>
                      {sending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      送付を記録
                    </Button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* 送信履歴タブ */}
              {/* ============================================ */}
              {activeTab === "history" && (
                <div className="space-y-3 p-1">
                  {data.mailHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      送信履歴がありません
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {data.mailHistory.map((m) => {
                        const statusConf =
                          MAIL_STATUS_CONFIG[m.status] ??
                          MAIL_STATUS_CONFIG.draft;
                        return (
                          <div key={m.id} className="px-4 py-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {m.status === "sent" ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : m.status === "failed" ? (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-gray-400" />
                                )}
                                <Badge variant={statusConf.variant}>
                                  {statusConf.label}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {SEND_METHOD_LABELS[m.sendMethod] ??
                                    m.sendMethod}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {m.sentAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(m.sentAt).toLocaleString(
                                      "ja-JP"
                                    )}
                                  </span>
                                )}
                                {m.status === "failed" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => handleResend(m.id)}
                                    disabled={sending}
                                  >
                                    <RefreshCw className="mr-1 h-3 w-3" />
                                    再送
                                  </Button>
                                )}
                              </div>
                            </div>
                            {m.subject && (
                              <div className="text-sm truncate">
                                {m.subject}
                              </div>
                            )}
                            {m.recipientEmails.length > 0 && (
                              <div className="text-xs text-muted-foreground truncate">
                                宛先: {m.recipientEmails.join(", ")}
                              </div>
                            )}
                            {m.sentByName && (
                              <div className="text-xs text-muted-foreground">
                                送信者: {m.sentByName}
                              </div>
                            )}
                            {m.errorMessage && (
                              <div className="text-xs text-red-600 bg-red-50 rounded p-2 mt-1">
                                {m.errorMessage}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================ */}
              {/* 担当者追加確認（送信成功後） */}
              {/* ============================================ */}
              {pendingContacts.length > 0 && (
                <div className="absolute inset-0 bg-background flex flex-col p-4 space-y-4">
                  <div className="flex items-center gap-2 text-base font-medium">
                    <UserPlus className="h-5 w-5" />
                    担当者の追加
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                    以下の情報を
                    <span className="font-medium">
                      {data?.invoiceGroup.counterpartyName}
                    </span>
                    の担当者に追加しますか？
                  </div>
                  <div className="border rounded-lg divide-y">
                    {pendingContacts.map((c) => (
                      <div
                        key={c.email}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.email}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSkipAddContacts}
                      disabled={sending}
                    >
                      スキップ
                    </Button>
                    <Button onClick={handleAddContacts} disabled={sending}>
                      {sending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <UserPlus className="mr-2 h-4 w-4" />
                      追加する
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
