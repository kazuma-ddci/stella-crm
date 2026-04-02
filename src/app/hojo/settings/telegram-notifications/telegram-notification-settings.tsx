"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Copy, Check, Send, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import {
  createBot,
  updateBot,
  deleteBot,
  testBot,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  type TopicMappingInput,
  type RuleInput,
} from "./actions";

// ============================================
// Types
// ============================================

type BotData = {
  id: number;
  name: string;
  token: string;
  chatId: string;
  isActive: boolean;
};

type TopicMappingData = {
  id: number;
  staffName: string;
  topicId: string;
  telegramMention: string | null;
  isDefault: boolean;
};

type RuleData = {
  id: number;
  uuid: string;
  name: string;
  botId: number;
  botName: string;
  eventType: string;
  bookingPrefix: string | null;
  topicStrategy: string;
  fixedTopicId: string | null;
  messageTemplate: string;
  customParams: Array<{ key: string; label: string }> | null;
  includeFormFields: string[] | null;
  duplicateLockSeconds: number;
  lineAccountType: string | null;
  isActive: boolean;
  topicMappings: TopicMappingData[];
  logCount: number;
};

type Props = {
  bots: BotData[];
  rules: RuleData[];
  canEdit: boolean;
};

// ============================================
// Constants
// ============================================

const EVENT_TYPES = [
  { value: "booking_new", label: "新規予約" },
  { value: "booking_change", label: "予約変更" },
  { value: "booking_cancel", label: "予約キャンセル" },
  { value: "custom", label: "カスタム" },
];

const TOPIC_STRATEGIES = [
  { value: "staff_mapped", label: "担当者ごとに振り分け" },
  { value: "fixed", label: "固定トピック" },
  { value: "group_direct", label: "グループ直接（トピックなし）" },
];

const LINE_ACCOUNT_TYPES = [
  { value: "", label: "なし（友達情報を参照しない）" },
  { value: "security-cloud", label: "セキュリティクラウドサポート" },
  { value: "josei-support", label: "助成金申請サポート" },
];

const BASE_PLACEHOLDERS = [
  { key: "{{linename}}", label: "LINE名" },
  { key: "{{uid}}", label: "UID" },
  { key: "{{line_number}}", label: "LINE番号（CRM友達情報）" },
  { key: "{{introducer}}", label: "紹介者（CRM友達情報）" },
  { key: "{{as_member_mention}}", label: "AS担当者（メンション付き）" },
  { key: "{{followed}}", label: "LINE追加日時" },
];

const BOOKING_PLACEHOLDERS = [
  { key: "{{booking_datetime}}", label: "予約開始日時" },
  { key: "{{staff_name}}", label: "予約担当者名" },
  { key: "{{booking_id}}", label: "予約ID" },
  { key: "{{booking_create}}", label: "予約作成日時" },
  { key: "{{booking_start}}", label: "予約開始日時" },
  { key: "{{booking_start_date}}", label: "予約開始日" },
  { key: "{{booking_start_time}}", label: "予約開始時間" },
  { key: "{{booking_end}}", label: "予約終了日時" },
  { key: "{{booking_end_date}}", label: "予約終了日" },
  { key: "{{booking_end_time}}", label: "予約終了時間" },
  { key: "{{booking_duration}}", label: "予約枠の長さ" },
  { key: "{{booking_menu}}", label: "予約メニュー名" },
  { key: "{{booking_staff}}", label: "予約担当者名" },
  { key: "{{booking_num}}", label: "予約した回数" },
  { key: "{{booking_active_num}}", label: "予約中の数" },
  { key: "{{booking_finish_num}}", label: "終了した回数" },
  { key: "{{booking_reschedule_num}}", label: "予約変更回数" },
  { key: "{{booking_cancel_num}}", label: "キャンセル回数" },
];

const COMMON_PLACEHOLDERS = [
  { key: "{{booking_history_url}}", label: "予約履歴ページURL" },
  { key: "{{booking_before}}", label: "予約時間までの時間" },
  { key: "{{all_booking_active_num}}", label: "全カレンダー予約中の数" },
  { key: "{{all_booking_finish_num}}", label: "全カレンダー終了した回数" },
];

const DOMAIN = "https://portal.stella-international.co.jp";

// ============================================
// Main Component
// ============================================

export function TelegramNotificationSettings({ bots, rules, canEdit }: Props) {
  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rules">通知ルール ({rules.length})</TabsTrigger>
        <TabsTrigger value="bots">ボット管理 ({bots.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="rules">
        <RulesTab rules={rules} bots={bots} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="bots">
        <BotsTab bots={bots} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}

// ============================================
// Bots Tab
// ============================================

function BotsTab({ bots, canEdit }: { bots: BotData[]; canEdit: boolean }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editBot, setEditBot] = useState<BotData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BotData | null>(null);
  const [showTokens, setShowTokens] = useState<Record<number, boolean>>({});

  const handleCreate = () => {
    setEditBot(null);
    setShowDialog(true);
  };

  const handleEdit = (bot: BotData) => {
    setEditBot(bot);
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteBot(deleteTarget.id);
      toast.success("ボットを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
    setDeleteTarget(null);
  };

  const handleTest = async (bot: BotData) => {
    try {
      await testBot(bot.id);
      toast.success("テストメッセージを送信しました");
    } catch (err) {
      toast.error(`テスト送信失敗: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  const maskToken = (token: string) => {
    if (token.length <= 10) return "****";
    return token.substring(0, 6) + "****" + token.substring(token.length - 4);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Telegramボット一覧</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              ボット追加
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {bots.length === 0 ? (
            <p className="text-muted-foreground text-sm">ボットが登録されていません。まず「ボット追加」からTelegramボットを登録してください。</p>
          ) : (
            <div className="space-y-3">
              {bots.map((bot) => (
                <div key={bot.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bot.name}</span>
                      <Badge variant={bot.isActive ? "default" : "secondary"}>
                        {bot.isActive ? "有効" : "無効"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1">
                        <span>トークン:</span>
                        <code className="text-xs bg-muted px-1 rounded">
                          {showTokens[bot.id] ? bot.token : maskToken(bot.token)}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setShowTokens((prev) => ({ ...prev, [bot.id]: !prev[bot.id] }))}
                        >
                          {showTokens[bot.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                      <div>チャットID: <code className="text-xs bg-muted px-1 rounded">{bot.chatId}</code></div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleTest(bot)}>
                        <Send className="h-4 w-4 mr-1" />
                        テスト
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(bot)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(bot)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showDialog && (
        <BotDialog
          bot={editBot}
          onClose={() => setShowDialog(false)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ボットの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？このボットに紐づく通知ルールも全て削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================
// Bot Dialog
// ============================================

function BotDialog({ bot, onClose }: { bot: BotData | null; onClose: () => void }) {
  const [name, setName] = useState(bot?.name || "");
  const [token, setToken] = useState(bot?.token || "");
  const [chatId, setChatId] = useState(bot?.chatId || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !token.trim() || !chatId.trim()) {
      toast.error("全ての項目を入力してください");
      return;
    }
    setSaving(true);
    try {
      if (bot) {
        await updateBot(bot.id, { name: name.trim(), token: token.trim(), chatId: chatId.trim() });
        toast.success("ボットを更新しました");
      } else {
        await createBot({ name: name.trim(), token: token.trim(), chatId: chatId.trim() });
        toast.success("ボットを追加しました");
      }
      onClose();
    } catch {
      toast.error("保存に失敗しました");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{bot ? "ボット編集" : "ボット追加"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>ボット名</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: メイン通知Bot" />
          </div>
          <div>
            <Label>Botトークン</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="例: 6935908989:AAF..." type="password" />
          </div>
          <div>
            <Label>チャットID</Label>
            <Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="例: -1002221566780" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Rules Tab
// ============================================

function RulesTab({ rules, bots, canEdit }: { rules: RuleData[]; bots: BotData[]; canEdit: boolean }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editRule, setEditRule] = useState<RuleData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuleData | null>(null);
  const [urlRule, setUrlRule] = useState<RuleData | null>(null);

  const handleCreate = () => {
    if (bots.length === 0) {
      toast.error("先に「ボット管理」タブでTelegramボットを登録してください");
      return;
    }
    setEditRule(null);
    setShowEditor(true);
  };

  const handleEdit = (rule: RuleData) => {
    setEditRule(rule);
    setShowEditor(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRule(deleteTarget.id);
      toast.success("ルールを削除しました");
    } catch {
      toast.error("削除に失敗しました");
    }
    setDeleteTarget(null);
  };

  const handleToggle = async (rule: RuleData) => {
    try {
      await toggleRule(rule.id, !rule.isActive);
      toast.success(rule.isActive ? "ルールを無効にしました" : "ルールを有効にしました");
    } catch {
      toast.error("変更に失敗しました");
    }
  };

  const eventTypeLabel = (type: string) => EVENT_TYPES.find((e) => e.value === type)?.label || type;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>通知ルール一覧</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              ルール作成
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              通知ルールがありません。「ルール作成」から新しいルールを追加してください。
            </p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "有効" : "無効"}
                        </Badge>
                        <Badge variant="outline">{eventTypeLabel(rule.eventType)}</Badge>
                        {rule.bookingPrefix && (
                          <Badge variant="outline">{rule.bookingPrefix}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ボット: {rule.botName} | 送信先: {
                          rule.topicStrategy === "staff_mapped" ? `担当者別(${rule.topicMappings.length}件)` :
                          rule.topicStrategy === "fixed" ? `固定トピック(${rule.fixedTopicId})` :
                          "グループ直接"
                        } | 送信ログ: {rule.logCount}件
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggle(rule)}
                        />
                      )}
                      <Button variant="outline" size="sm" onClick={() => setUrlRule(rule)}>
                        <Copy className="h-4 w-4 mr-1" />
                        URL
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleEdit(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(rule)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showEditor && (
        <RuleEditor
          rule={editRule}
          bots={bots}
          onClose={() => setShowEditor(false)}
        />
      )}

      {urlRule && (
        <UrlDialog rule={urlRule} onClose={() => setUrlRule(null)} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ルールの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」を削除しますか？送信ログも全て削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================
// URL Dialog
// ============================================

function UrlDialog({ rule, onClose }: { rule: RuleData; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const generateUrl = useCallback(() => {
    const base = `${DOMAIN}/api/public/hojo/telegram-notify?rule=${rule.uuid}`;
    const params: string[] = [];
    const addedKeys = new Set<string>();

    const addParam = (key: string, prolineVar?: string) => {
      if (addedKeys.has(key)) return;
      addedKeys.add(key);
      params.push(`${key}=[[${prolineVar || key}]]`);
    };

    // 基本パラメータ（常に必要）
    addParam("linename");
    addParam("uid");

    // 予約イベントの場合、プレフィックス付きパラメータを追加
    if (rule.eventType !== "custom" && rule.bookingPrefix) {
      const p = rule.bookingPrefix;
      // メッセージテンプレートで使われているプレースホルダーに基づいてパラメータを決定
      const bookingParamMap: Record<string, string> = {
        "{{booking_datetime}}": `${p}-booking-start`,
        "{{booking_start}}": `${p}-booking-start`,
        "{{booking_start_date}}": `${p}-booking-start-date`,
        "{{booking_start_time}}": `${p}-booking-start-time`,
        "{{booking_end}}": `${p}-booking-end`,
        "{{booking_end_date}}": `${p}-booking-end-date`,
        "{{booking_end_time}}": `${p}-booking-end-time`,
        "{{booking_duration}}": `${p}-booking-duration`,
        "{{booking_menu}}": `${p}-booking-menu`,
        "{{staff_name}}": `${p}-booking-staff`,
        "{{booking_staff}}": `${p}-booking-staff`,
        "{{booking_id}}": `${p}-booking-id`,
        "{{booking_create}}": `${p}-booking-create`,
        "{{booking_num}}": `${p}-booking-num`,
        "{{booking_active_num}}": `${p}-booking-active-num`,
        "{{booking_finish_num}}": `${p}-booking-finish-num`,
        "{{booking_reschedule_num}}": `${p}-booking-reschedule-num`,
        "{{booking_cancel_num}}": `${p}-booking-cancel-num`,
      };

      for (const [placeholder, paramKey] of Object.entries(bookingParamMap)) {
        if (rule.messageTemplate.includes(placeholder)) {
          addParam(paramKey);
        }
      }

      // 担当者マッピングがある場合は常にstaff必要
      if (rule.topicStrategy === "staff_mapped") {
        addParam(`${p}-booking-staff`);
      }
    }

    // 共通変数（テンプレートで使われている場合のみ）
    const commonParamMap: Record<string, string> = {
      "{{booking_history_url}}": "booking",
      "{{booking_before}}": "booking-before",
      "{{all_booking_active_num}}": "booking-active-num",
      "{{all_booking_finish_num}}": "booking-finish-num",
      "{{followed}}": "followed",
    };
    for (const [placeholder, paramKey] of Object.entries(commonParamMap)) {
      if (rule.messageTemplate.includes(placeholder)) {
        addParam(paramKey);
      }
    }

    // フォームフィールド
    if (rule.includeFormFields && rule.includeFormFields.length > 0) {
      for (const field of rule.includeFormFields) {
        addParam(field);
      }
    }

    // カスタムパラメータ
    if (rule.customParams && rule.customParams.length > 0) {
      for (const cp of rule.customParams) {
        addParam(cp.key);
      }
    }

    return base + (params.length > 0 ? "&" + params.join("&") : "");
  }, [rule]);

  const url = generateUrl();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("URLをコピーしました");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>プロラインに貼り付けるURL</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            以下のURLをプロラインの「phpのURL」欄にコピー＆ペーストしてください。
            <code className="text-xs">[[...]]</code> の部分はプロラインが自動で置換します。
          </p>
          <div className="bg-muted p-3 rounded-lg">
            <code className="text-sm break-all">{url}</code>
          </div>
          <Button onClick={handleCopy} className="w-full">
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "コピーしました" : "URLをコピー"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Rule Editor (Create/Edit)
// ============================================

function RuleEditor({
  rule,
  bots,
  onClose,
}: {
  rule: RuleData | null;
  bots: BotData[];
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name || "");
  const [botId, setBotId] = useState(rule?.botId?.toString() || bots[0]?.id.toString() || "");
  const [eventType, setEventType] = useState(rule?.eventType || "booking_new");
  const [bookingPrefix, setBookingPrefix] = useState(rule?.bookingPrefix || "");
  const [topicStrategy, setTopicStrategy] = useState(rule?.topicStrategy || "staff_mapped");
  const [fixedTopicId, setFixedTopicId] = useState(rule?.fixedTopicId || "");
  const [messageTemplate, setMessageTemplate] = useState(rule?.messageTemplate || "");
  const [includeFormFields, setIncludeFormFields] = useState(
    rule?.includeFormFields?.join(", ") || ""
  );
  const [customParams, setCustomParams] = useState<Array<{ key: string; label: string }>>(
    rule?.customParams || []
  );
  const [duplicateLockSeconds, setDuplicateLockSeconds] = useState(
    rule?.duplicateLockSeconds?.toString() || "180"
  );
  const [lineAccountType, setLineAccountType] = useState(rule?.lineAccountType || "");
  const [topicMappings, setTopicMappings] = useState<TopicMappingInput[]>(
    rule?.topicMappings?.map((m) => ({
      staffName: m.staffName,
      topicId: m.topicId,
      telegramMention: m.telegramMention || "",
      isDefault: m.isDefault,
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const isBookingEvent = eventType !== "custom";

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("ルール名を入力してください");
      return;
    }
    if (!messageTemplate.trim()) {
      toast.error("通知メッセージを入力してください");
      return;
    }
    if (isBookingEvent && !bookingPrefix.trim()) {
      toast.error("予約プレフィックスを入力してください");
      return;
    }

    setSaving(true);
    try {
      const input: RuleInput = {
        name: name.trim(),
        botId: parseInt(botId),
        eventType,
        bookingPrefix: isBookingEvent ? bookingPrefix.trim() : undefined,
        topicStrategy,
        fixedTopicId: topicStrategy === "fixed" ? fixedTopicId.trim() : undefined,
        messageTemplate: messageTemplate.trim(),
        customParams: eventType === "custom" && customParams.length > 0 ? customParams : undefined,
        includeFormFields: includeFormFields.trim()
          ? includeFormFields.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        duplicateLockSeconds: parseInt(duplicateLockSeconds) || 180,
        lineAccountType: lineAccountType || undefined,
        topicMappings: topicStrategy === "staff_mapped" ? topicMappings : [],
      };

      if (rule) {
        await updateRule(rule.id, input);
        toast.success("ルールを更新しました");
      } else {
        await createRule(input);
        toast.success("ルールを作成しました");
      }
      onClose();
    } catch (err) {
      toast.error(`保存に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
    setSaving(false);
  };

  const addMapping = () => {
    setTopicMappings([...topicMappings, { staffName: "", topicId: "", telegramMention: "", isDefault: false }]);
  };

  const removeMapping = (index: number) => {
    setTopicMappings(topicMappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: keyof TopicMappingInput, value: string | boolean) => {
    setTopicMappings(topicMappings.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, { key: "", label: "" }]);
  };

  const removeCustomParam = (index: number) => {
    setCustomParams(customParams.filter((_, i) => i !== index));
  };

  const insertPlaceholder = (placeholder: string) => {
    setMessageTemplate((prev) => prev + placeholder);
  };

  const availablePlaceholders = [
    ...BASE_PLACEHOLDERS,
    ...(isBookingEvent ? BOOKING_PLACEHOLDERS : []),
    ...COMMON_PLACEHOLDERS,
    ...(includeFormFields.trim()
      ? includeFormFields.split(",").map((f) => f.trim()).filter(Boolean).map((f) => ({
          key: `{{form:${f}}}`,
          label: `フォーム: ${f}`,
        }))
      : []),
    ...(customParams.map((cp) => ({
      key: `{{custom:${cp.key}}}`,
      label: `カスタム: ${cp.label || cp.key}`,
    }))),
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? "ルール編集" : "ルール作成"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ルール名 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 申請予約通知" />
            </div>
            <div>
              <Label>Telegramボット *</Label>
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bots.map((b) => (
                    <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>イベント種別 *</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isBookingEvent && (
              <div>
                <Label>予約プレフィックス *</Label>
                <Input
                  value={bookingPrefix}
                  onChange={(e) => setBookingPrefix(e.target.value)}
                  placeholder="例: cl2"
                />
                <p className="text-xs text-muted-foreground mt-1">プロラインの予約カレンダー番号</p>
              </div>
            )}
          </div>

          {/* カスタムパラメータ */}
          {eventType === "custom" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>カスタムパラメータ</Label>
                <Button variant="outline" size="sm" onClick={addCustomParam}>
                  <Plus className="h-3 w-3 mr-1" />追加
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">プロラインから受け取る追加パラメータを定義します</p>
              {customParams.map((cp, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input
                    value={cp.key}
                    onChange={(e) => {
                      const updated = [...customParams];
                      updated[i] = { ...cp, key: e.target.value };
                      setCustomParams(updated);
                    }}
                    placeholder="パラメータ名（例: followed）"
                    className="flex-1"
                  />
                  <Input
                    value={cp.label}
                    onChange={(e) => {
                      const updated = [...customParams];
                      updated[i] = { ...cp, label: e.target.value };
                      setCustomParams(updated);
                    }}
                    placeholder="表示名（例: LINE追加日時）"
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeCustomParam(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* LINE友達情報 */}
          <div>
            <Label>LINE友達情報の参照先</Label>
            <Select value={lineAccountType} onValueChange={setLineAccountType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LINE_ACCOUNT_TYPES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              UIDから顧客情報（LINE番号、紹介者）を取得するLINEアカウント
            </p>
          </div>

          {/* トピック設定 */}
          <div>
            <Label>送信先設定 *</Label>
            <Select value={topicStrategy} onValueChange={setTopicStrategy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TOPIC_STRATEGIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {topicStrategy === "fixed" && (
            <div>
              <Label>トピックID</Label>
              <Input value={fixedTopicId} onChange={(e) => setFixedTopicId(e.target.value)} placeholder="例: 16053" />
            </div>
          )}

          {topicStrategy === "staff_mapped" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>担当者 → トピック マッピング</Label>
                <Button variant="outline" size="sm" onClick={addMapping}>
                  <Plus className="h-3 w-3 mr-1" />追加
                </Button>
              </div>
              <div className="space-y-2">
                {topicMappings.length === 0 && (
                  <p className="text-xs text-muted-foreground">マッピングがありません。「追加」で担当者とトピックIDの対応を設定してください。</p>
                )}
                {topicMappings.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={m.staffName}
                      onChange={(e) => updateMapping(i, "staffName", e.target.value)}
                      placeholder="担当者名"
                      className="w-28"
                    />
                    <Input
                      value={m.topicId}
                      onChange={(e) => updateMapping(i, "topicId", e.target.value)}
                      placeholder="トピックID"
                      className="w-28"
                    />
                    <Input
                      value={m.telegramMention || ""}
                      onChange={(e) => updateMapping(i, "telegramMention", e.target.value)}
                      placeholder="@メンション"
                      className="w-32"
                    />
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={m.isDefault}
                        onChange={(e) => updateMapping(i, "isDefault", e.target.checked)}
                      />
                      デフォルト
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => removeMapping(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* フォームフィールド */}
          <div>
            <Label>フォームフィールド（オプション）</Label>
            <Input
              value={includeFormFields}
              onChange={(e) => setIncludeFormFields(e.target.value)}
              placeholder="例: form2-1, form2-2, form2-3"
            />
            <p className="text-xs text-muted-foreground mt-1">
              プロラインから受け取るフォーム回答のフィールド名（カンマ区切り）
            </p>
          </div>

          {/* メッセージテンプレート */}
          <div>
            <Label>通知メッセージ *</Label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={8}
              placeholder={"例:\n【申請予約がされました】\n{{booking_datetime}}\n{{staff_name}}\n\nLINE名: {{linename}}\nuid: {{uid}}\n紹介者: {{introducer}}\nAS担当者: {{as_member_mention}}"}
              className="font-mono text-sm"
            />
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">使用可能なプレースホルダー（クリックで挿入）:</p>
              <div className="flex flex-wrap gap-1">
                {availablePlaceholders.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => insertPlaceholder(p.key)}
                    className="text-xs bg-muted hover:bg-muted/80 px-2 py-0.5 rounded border cursor-pointer"
                    title={p.label}
                  >
                    {p.key}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 詳細設定 */}
          <div>
            <Label>重複防止（秒）</Label>
            <Input
              type="number"
              value={duplicateLockSeconds}
              onChange={(e) => setDuplicateLockSeconds(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              同一パラメータのリクエストを無視する秒数（デフォルト: 180秒）
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
