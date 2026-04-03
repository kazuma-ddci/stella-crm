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
import { Plus, Pencil, Trash2, Copy, Check, Send, Eye, EyeOff, X, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  createBot, updateBot, deleteBot, testBot,
  createGroup, updateGroup, deleteGroup,
  createTopic, updateTopic, deleteTopic,
  createRule, updateRule, deleteRule, toggleRule,
  type RuleInput,
} from "./actions";

// ============================================
// Types
// ============================================

type BotData = { id: number; name: string; token: string; isActive: boolean };

type TopicData = { id: number; name: string; topicId: string; isActive: boolean };
type GroupData = { id: number; name: string; chatId: string; isActive: boolean; topics: TopicData[] };

type MappingData = {
  id: number; staffName: string; telegramTopicId: number | null;
  topicName: string | null; telegramMention: string | null; isDefault: boolean;
};

type RuleData = {
  id: number; uuid: string; name: string; botId: number; botName: string;
  groupId: number | null; groupName: string | null;
  eventType: string; bookingPrefix: string | null;
  topicStrategy: string; fixedTopicId: number | null; fixedTopicName: string | null;
  messageTemplate: string;
  customParams: Array<{ key: string; label: string }> | null;
  includeFormFields: string[] | null;
  duplicateLockSeconds: number; lineAccountType: string | null;
  isActive: boolean; topicMappings: MappingData[]; logCount: number;
};

type Props = { bots: BotData[]; groups: GroupData[]; rules: RuleData[]; canEdit: boolean };

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
  { value: "group_direct", label: "グループ直接（トピックなし）" },
  { value: "fixed", label: "固定トピック" },
  { value: "staff_mapped", label: "担当者ごとにトピック振り分け" },
];

const LINE_ACCOUNT_TYPES = [
  { value: "none", label: "なし（友達情報を参照しない）" },
  { value: "security-cloud", label: "セキュリティクラウドサポート" },
  { value: "josei-support", label: "助成金申請サポート" },
];

const BASE_PLACEHOLDERS = [
  { key: "{{linename}}", label: "LINE名", desc: "プロラインに登録されているLINE表示名" },
  { key: "{{uid}}", label: "UID", desc: "プロラインのユーザー固有ID" },
  { key: "{{line_number}}", label: "LINE番号（CRM友達情報）", desc: "CRMの友達情報テーブルから取得するLINE番号（snsname）" },
  { key: "{{introducer}}", label: "紹介者（CRM友達情報）", desc: "セキュリティクラウド: 紹介者フィールド / 助成金申請サポート: 紹介元ベンダー名" },
  { key: "{{as_member_mention}}", label: "AS担当者（メンション付き）", desc: "担当者名とTelegramメンション。例: 尾崎(@asdf0414)" },
  { key: "{{followed}}", label: "LINE追加日時", desc: "LINE友達追加された日時。例: 2025年03月17日(月) 17:08" },
];

const BOOKING_PLACEHOLDERS = [
  { key: "{{booking_datetime}}", label: "予約開始日時", desc: "予約の開始日時。例: 2025年1月23日 (月) 09:00（booking_startと同じ）" },
  { key: "{{staff_name}}", label: "予約担当者名", desc: "予約した担当者。例: 山田（booking_staffと同じ）" },
  { key: "{{booking_id}}", label: "予約ID", desc: "予約ごとに発行される固有ID。例: kCBebvaOCem" },
  { key: "{{booking_create}}", label: "予約作成日時", desc: "予約操作を行った日時。例: 2024年12月1日 (日) 21:00" },
  { key: "{{booking_start}}", label: "予約開始日時", desc: "予約の開始日時。例: 2025年1月23日 (月) 09:00" },
  { key: "{{booking_start_date}}", label: "予約開始日", desc: "予約の開始日。例: 2025年1月23日 (木)" },
  { key: "{{booking_start_time}}", label: "予約開始時間", desc: "予約の開始時間。例: 09:00" },
  { key: "{{booking_end}}", label: "予約終了日時", desc: "予約の終了日時。例: 2025年1月23日 (木) 10:30" },
  { key: "{{booking_end_date}}", label: "予約終了日", desc: "予約の終了日。例: 2025年1月23日 (木)" },
  { key: "{{booking_end_time}}", label: "予約終了時間", desc: "予約の終了時間。例: 10:30" },
  { key: "{{booking_duration}}", label: "予約枠の長さ", desc: "予約枠の長さ。例: 1時間30分" },
  { key: "{{booking_menu}}", label: "予約メニュー名", desc: "予約したメニュー名。例: コースA（未設定なら空欄）" },
  { key: "{{booking_staff}}", label: "予約担当者名", desc: "予約した担当者名。例: 山田（指名なしでも担当者名が入る）" },
  { key: "{{booking_num}}", label: "予約した回数", desc: "このカレンダーで予約した累積回数。例: 10" },
  { key: "{{booking_active_num}}", label: "予約中の数", desc: "このカレンダーでまだ開始時間を迎えていない予約数。例: 1" },
  { key: "{{booking_finish_num}}", label: "終了した回数", desc: "このカレンダーで終了時間を過ぎた累積回数。例: 8" },
  { key: "{{booking_reschedule_num}}", label: "予約変更回数", desc: "この予約IDに対しての変更回数。例: 1" },
  { key: "{{booking_cancel_num}}", label: "キャンセル回数", desc: "このカレンダーでキャンセルした累積回数。例: 3" },
];

const COMMON_PLACEHOLDERS = [
  { key: "{{booking_history_url}}", label: "予約履歴ページURL", desc: "ユーザーの予約履歴ページURL（変更・キャンセル可能）" },
  { key: "{{booking_before}}", label: "予約時間までの時間", desc: "予約時間までの残り時間。例: 3日前、2時間前、当日（リマインダー用）" },
  { key: "{{all_booking_active_num}}", label: "全カレンダー予約中の数", desc: "全ての予約カレンダーで予約中の数。例: 1" },
  { key: "{{all_booking_finish_num}}", label: "全カレンダー終了した回数", desc: "全ての予約カレンダーで終了した累積回数。例: 8" },
];

const DOMAIN = "https://portal.stella-international.co.jp";

// ============================================
// Main Component
// ============================================

export function TelegramNotificationSettings({ bots, groups, rules, canEdit }: Props) {
  return (
    <Tabs defaultValue="rules" className="space-y-4">
      <TabsList>
        <TabsTrigger value="rules">通知ルール ({rules.length})</TabsTrigger>
        <TabsTrigger value="groups">グループ・トピック ({groups.length})</TabsTrigger>
        <TabsTrigger value="bots">ボット管理 ({bots.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="rules">
        <RulesTab rules={rules} bots={bots} groups={groups} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="groups">
        <GroupsTab groups={groups} canEdit={canEdit} />
      </TabsContent>

      <TabsContent value="bots">
        <BotsTab bots={bots} canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}

// ============================================
// Groups & Topics Tab
// ============================================

function GroupsTab({ groups, canEdit }: { groups: GroupData[]; canEdit: boolean }) {
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editGroup, setEditGroup] = useState<GroupData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GroupData | null>(null);
  const [showTopicDialog, setShowTopicDialog] = useState(false);
  const [topicGroupId, setTopicGroupId] = useState<number | null>(null);
  const [editTopic, setEditTopic] = useState<TopicData | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<TopicData | null>(null);

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGroup(deleteTarget.id);
      toast.success("グループを削除しました");
    } catch { toast.error("削除に失敗しました"); }
    setDeleteTarget(null);
  };

  const handleDeleteTopic = async () => {
    if (!deleteTopicTarget) return;
    try {
      await deleteTopic(deleteTopicTarget.id);
      toast.success("トピックを削除しました");
    } catch { toast.error("削除に失敗しました"); }
    setDeleteTopicTarget(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Telegramグループ・トピック</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={() => { setEditGroup(null); setShowGroupDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" />グループ追加
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-muted-foreground text-sm">グループが登録されていません。</p>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-medium">{group.name}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded ml-2">{group.chatId}</code>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => { setEditGroup(group); setShowGroupDialog(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(group)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground font-medium">トピック</span>
                      {canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => { setTopicGroupId(group.id); setEditTopic(null); setShowTopicDialog(true); }}>
                          <Plus className="h-3 w-3 mr-1" />追加
                        </Button>
                      )}
                    </div>
                    {group.topics.length === 0 ? (
                      <p className="text-xs text-muted-foreground">トピックなし</p>
                    ) : (
                      group.topics.map((topic) => (
                        <div key={topic.id} className="flex items-center justify-between text-sm py-1 pl-2 border-l-2 border-muted">
                          <div>
                            <span>{topic.name}</span>
                            <code className="text-xs bg-muted px-1 rounded ml-2">ID: {topic.topicId}</code>
                          </div>
                          {canEdit && (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTopicGroupId(group.id); setEditTopic(topic); setShowTopicDialog(true); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTopicTarget(topic)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showGroupDialog && (
        <GroupDialog group={editGroup} onClose={() => setShowGroupDialog(false)} />
      )}

      {showTopicDialog && topicGroupId && (
        <TopicDialog groupId={topicGroupId} topic={editTopic} onClose={() => setShowTopicDialog(false)} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グループの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.name}」と配下のトピックを全て削除しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTopicTarget} onOpenChange={() => setDeleteTopicTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>トピックの削除</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTopicTarget?.name}」を削除しますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTopic} className="bg-destructive text-destructive-foreground">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function GroupDialog({ group, onClose }: { group: GroupData | null; onClose: () => void }) {
  const [name, setName] = useState(group?.name || "");
  const [chatId, setChatId] = useState(group?.chatId || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !chatId.trim()) { toast.error("全項目を入力してください"); return; }
    setSaving(true);
    try {
      if (group) { await updateGroup(group.id, { name: name.trim(), chatId: chatId.trim() }); }
      else { await createGroup({ name: name.trim(), chatId: chatId.trim() }); }
      toast.success(group ? "更新しました" : "追加しました");
      onClose();
    } catch { toast.error("保存に失敗しました"); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{group ? "グループ編集" : "グループ追加"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>グループ名</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 補助金メイングループ" /></div>
          <div><Label>チャットID</Label><Input value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="例: -1002221566780" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopicDialog({ groupId, topic, onClose }: { groupId: number; topic: TopicData | null; onClose: () => void }) {
  const [name, setName] = useState(topic?.name || "");
  const [topicId, setTopicId] = useState(topic?.topicId || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !topicId.trim()) { toast.error("全項目を入力してください"); return; }
    setSaving(true);
    try {
      if (topic) { await updateTopic(topic.id, { name: name.trim(), topicId: topicId.trim() }); }
      else { await createTopic({ groupId, name: name.trim(), topicId: topicId.trim() }); }
      toast.success(topic ? "更新しました" : "追加しました");
      onClose();
    } catch { toast.error("保存に失敗しました"); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{topic ? "トピック編集" : "トピック追加"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>トピック名</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 塩澤チーム" /></div>
          <div><Label>トピックID</Label><Input value={topicId} onChange={(e) => setTopicId(e.target.value)} placeholder="例: 25417" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [testChatId, setTestChatId] = useState("");
  const [testBotTarget, setTestBotTarget] = useState<BotData | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteBot(deleteTarget.id); toast.success("削除しました"); }
    catch { toast.error("削除に失敗しました"); }
    setDeleteTarget(null);
  };

  const handleTest = async () => {
    if (!testBotTarget) return;
    try {
      await testBot(testBotTarget.id, testChatId);
      toast.success("テストメッセージを送信しました");
      setTestBotTarget(null); setTestChatId("");
    } catch (err) { toast.error(`テスト送信失敗: ${err instanceof Error ? err.message : "不明なエラー"}`); }
  };

  const maskToken = (t: string) => t.length <= 10 ? "****" : t.substring(0, 6) + "****" + t.substring(t.length - 4);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Telegramボット一覧</CardTitle>
          {canEdit && <Button size="sm" onClick={() => { setEditBot(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-1" />ボット追加</Button>}
        </CardHeader>
        <CardContent>
          {bots.length === 0 ? (
            <p className="text-muted-foreground text-sm">ボットが登録されていません。</p>
          ) : (
            <div className="space-y-3">
              {bots.map((bot) => (
                <div key={bot.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{bot.name}</span>
                      <Badge variant={bot.isActive ? "default" : "secondary"}>{bot.isActive ? "有効" : "無効"}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <span>トークン:</span>
                      <code className="text-xs bg-muted px-1 rounded">{showTokens[bot.id] ? bot.token : maskToken(bot.token)}</code>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowTokens((prev) => ({ ...prev, [bot.id]: !prev[bot.id] }))}>
                        {showTokens[bot.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setTestBotTarget(bot); setTestChatId(""); }}><Send className="h-4 w-4 mr-1" />テスト</Button>
                      <Button variant="outline" size="sm" onClick={() => { setEditBot(bot); setShowDialog(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" onClick={() => setDeleteTarget(bot)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showDialog && <BotDialog bot={editBot} onClose={() => setShowDialog(false)} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>ボットの削除</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.name}」を削除しますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {testBotTarget && (
        <Dialog open onOpenChange={() => setTestBotTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>テスト送信: {testBotTarget.name}</DialogTitle></DialogHeader>
            <div><Label>送信先チャットID</Label><Input value={testChatId} onChange={(e) => setTestChatId(e.target.value)} placeholder="例: -1002221566780" /></div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestBotTarget(null)}>キャンセル</Button>
              <Button onClick={handleTest} disabled={!testChatId.trim()}><Send className="h-4 w-4 mr-1" />テスト送信</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function BotDialog({ bot, onClose }: { bot: BotData | null; onClose: () => void }) {
  const [name, setName] = useState(bot?.name || "");
  const [token, setToken] = useState(bot?.token || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !token.trim()) { toast.error("全項目を入力してください"); return; }
    setSaving(true);
    try {
      if (bot) { await updateBot(bot.id, { name: name.trim(), token: token.trim() }); }
      else { await createBot({ name: name.trim(), token: token.trim() }); }
      toast.success(bot ? "更新しました" : "追加しました");
      onClose();
    } catch { toast.error("保存に失敗しました"); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{bot ? "ボット編集" : "ボット追加"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>ボット名</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: メイン通知Bot" /></div>
          <div><Label>Botトークン</Label><Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="例: 6935908989:AAF..." type="password" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Rules Tab
// ============================================

function RulesTab({ rules, bots, groups, canEdit }: { rules: RuleData[]; bots: BotData[]; groups: GroupData[]; canEdit: boolean }) {
  const [showEditor, setShowEditor] = useState(false);
  const [editRule, setEditRule] = useState<RuleData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuleData | null>(null);
  const [urlRule, setUrlRule] = useState<RuleData | null>(null);

  const handleCreate = () => {
    if (bots.length === 0) { toast.error("先に「ボット管理」タブでボットを登録してください"); return; }
    if (groups.length === 0) { toast.error("先に「グループ・トピック」タブでグループを登録してください"); return; }
    setEditRule(null); setShowEditor(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteRule(deleteTarget.id); toast.success("削除しました"); }
    catch { toast.error("削除に失敗しました"); }
    setDeleteTarget(null);
  };

  const handleToggle = async (rule: RuleData) => {
    try { await toggleRule(rule.id, !rule.isActive); toast.success(rule.isActive ? "無効にしました" : "有効にしました"); }
    catch { toast.error("変更に失敗しました"); }
  };

  const eventLabel = (t: string) => EVENT_TYPES.find((e) => e.value === t)?.label || t;
  const strategyLabel = (s: string) => {
    if (s === "group_direct") return "グループ直接";
    if (s === "fixed") return "固定トピック";
    return "担当者別";
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>通知ルール一覧</CardTitle>
          {canEdit && <Button size="sm" onClick={handleCreate}><Plus className="h-4 w-4 mr-1" />ルール作成</Button>}
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">通知ルールがありません。</p>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>{rule.isActive ? "有効" : "無効"}</Badge>
                        <Badge variant="outline">{eventLabel(rule.eventType)}</Badge>
                        {rule.bookingPrefix && <Badge variant="outline">{rule.bookingPrefix}</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ボット: {rule.botName} | 送信先: {rule.groupName || "未設定"} ({strategyLabel(rule.topicStrategy)}
                        {rule.fixedTopicName && ` - ${rule.fixedTopicName}`}
                        {rule.topicStrategy === "staff_mapped" && ` - ${rule.topicMappings.length}件`})
                        | ログ: {rule.logCount}件
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && <Switch checked={rule.isActive} onCheckedChange={() => handleToggle(rule)} />}
                      <Button variant="outline" size="sm" onClick={() => setUrlRule(rule)}><Copy className="h-4 w-4 mr-1" />URL</Button>
                      {canEdit && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => { setEditRule(rule); setShowEditor(true); }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(rule)}><Trash2 className="h-4 w-4" /></Button>
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

      {showEditor && <RuleEditor rule={editRule} bots={bots} groups={groups} onClose={() => setShowEditor(false)} />}
      {urlRule && <UrlDialog rule={urlRule} onClose={() => setUrlRule(null)} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>ルールの削除</AlertDialogTitle>
            <AlertDialogDescription>「{deleteTarget?.name}」を削除しますか？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">削除</AlertDialogAction>
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

    addParam("linename");
    addParam("uid");

    if (rule.eventType !== "custom" && rule.bookingPrefix) {
      const p = rule.bookingPrefix;
      const bookingMap: Record<string, string> = {
        "{{booking_datetime}}": `${p}-booking-start`, "{{booking_start}}": `${p}-booking-start`,
        "{{booking_start_date}}": `${p}-booking-start-date`, "{{booking_start_time}}": `${p}-booking-start-time`,
        "{{booking_end}}": `${p}-booking-end`, "{{booking_end_date}}": `${p}-booking-end-date`,
        "{{booking_end_time}}": `${p}-booking-end-time`, "{{booking_duration}}": `${p}-booking-duration`,
        "{{booking_menu}}": `${p}-booking-menu`, "{{staff_name}}": `${p}-booking-staff`,
        "{{booking_staff}}": `${p}-booking-staff`, "{{booking_id}}": `${p}-booking-id`,
        "{{booking_create}}": `${p}-booking-create`, "{{booking_num}}": `${p}-booking-num`,
        "{{booking_active_num}}": `${p}-booking-active-num`, "{{booking_finish_num}}": `${p}-booking-finish-num`,
        "{{booking_reschedule_num}}": `${p}-booking-reschedule-num`, "{{booking_cancel_num}}": `${p}-booking-cancel-num`,
      };
      for (const [ph, pk] of Object.entries(bookingMap)) {
        if (rule.messageTemplate.includes(ph)) addParam(pk);
      }
      if (rule.topicStrategy === "staff_mapped") addParam(`${p}-booking-staff`);
    }

    const commonMap: Record<string, string> = {
      "{{booking_history_url}}": "booking", "{{booking_before}}": "booking-before",
      "{{all_booking_active_num}}": "booking-active-num", "{{all_booking_finish_num}}": "booking-finish-num",
      "{{followed}}": "followed",
    };
    for (const [ph, pk] of Object.entries(commonMap)) {
      if (rule.messageTemplate.includes(ph)) addParam(pk);
    }

    if (rule.includeFormFields) for (const f of rule.includeFormFields) addParam(f);
    if (rule.customParams) for (const cp of rule.customParams) addParam(cp.key);

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
        <DialogHeader><DialogTitle>プロラインに貼り付けるURL</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            以下のURLをプロラインの「phpのURL」欄にコピー＆ペーストしてください。
            <code className="text-xs">[[...]]</code> の部分はプロラインが自動で置換します。
          </p>
          <div className="bg-muted p-3 rounded-lg"><code className="text-sm break-all">{url}</code></div>
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
// Rule Editor
// ============================================

function RuleEditor({ rule, bots, groups, onClose }: { rule: RuleData | null; bots: BotData[]; groups: GroupData[]; onClose: () => void }) {
  const [name, setName] = useState(rule?.name || "");
  const [botId, setBotId] = useState(rule?.botId?.toString() || bots[0]?.id.toString() || "");
  const [groupId, setGroupId] = useState(rule?.groupId?.toString() || "");
  const [eventType, setEventType] = useState(rule?.eventType || "booking_new");
  const [bookingPrefix, setBookingPrefix] = useState(rule?.bookingPrefix || "");
  const [topicStrategy, setTopicStrategy] = useState(rule?.topicStrategy || "group_direct");
  const [fixedTopicId, setFixedTopicId] = useState(rule?.fixedTopicId?.toString() || "");
  const [messageTemplate, setMessageTemplate] = useState(rule?.messageTemplate || "");
  const [includeFormFields, setIncludeFormFields] = useState(rule?.includeFormFields?.join(", ") || "");
  const [customParams, setCustomParams] = useState<Array<{ key: string; label: string }>>(rule?.customParams || []);
  const [duplicateLockSeconds, setDuplicateLockSeconds] = useState(rule?.duplicateLockSeconds?.toString() || "180");
  const [lineAccountType, setLineAccountType] = useState(rule?.lineAccountType || "none");
  const [topicMappings, setTopicMappings] = useState<Array<{
    staffName: string; telegramTopicId: string; telegramMention: string; isDefault: boolean;
  }>>(
    rule?.topicMappings?.map((m) => ({
      staffName: m.staffName,
      telegramTopicId: m.telegramTopicId?.toString() || "",
      telegramMention: m.telegramMention || "",
      isDefault: m.isDefault,
    })) || []
  );
  const [saving, setSaving] = useState(false);

  const isBookingEvent = eventType !== "custom";
  const selectedGroup = groups.find((g) => g.id.toString() === groupId);
  const handleSave = async () => {
    if (!name.trim()) { toast.error("ルール名を入力してください"); return; }
    if (!messageTemplate.trim()) { toast.error("通知メッセージを入力してください"); return; }
    if (isBookingEvent && !bookingPrefix.trim()) { toast.error("予約プレフィックスを入力してください"); return; }
    if ((topicStrategy === "group_direct" || topicStrategy === "fixed") && !groupId) {
      toast.error("送信先グループを選択してください"); return;
    }
    if (topicStrategy === "fixed" && !fixedTopicId) { toast.error("送信先トピックを選択してください"); return; }

    setSaving(true);
    try {
      const input: RuleInput = {
        name: name.trim(),
        botId: parseInt(botId),
        groupId: groupId ? parseInt(groupId) : undefined,
        eventType,
        bookingPrefix: isBookingEvent ? bookingPrefix.trim() : undefined,
        topicStrategy,
        fixedTopicId: topicStrategy === "fixed" && fixedTopicId ? parseInt(fixedTopicId) : undefined,
        messageTemplate: messageTemplate.trim(),
        customParams: eventType === "custom" && customParams.length > 0 ? customParams : undefined,
        includeFormFields: includeFormFields.trim() ? includeFormFields.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        duplicateLockSeconds: parseInt(duplicateLockSeconds) || 180,
        lineAccountType: lineAccountType === "none" ? undefined : lineAccountType,
        topicMappings: topicStrategy === "staff_mapped"
          ? topicMappings.map((m) => ({
              staffName: m.staffName,
              telegramTopicId: m.telegramTopicId ? parseInt(m.telegramTopicId) : null,
              telegramMention: m.telegramMention || undefined,
              isDefault: m.isDefault,
            }))
          : [],
      };

      if (rule) { await updateRule(rule.id, input); toast.success("更新しました"); }
      else { await createRule(input); toast.success("作成しました"); }
      onClose();
    } catch (err) { toast.error(`保存失敗: ${err instanceof Error ? err.message : "不明なエラー"}`); }
    setSaving(false);
  };

  const insertPlaceholder = (ph: string) => setMessageTemplate((p) => p + ph);

  const availablePlaceholders = [
    ...BASE_PLACEHOLDERS,
    ...(isBookingEvent ? BOOKING_PLACEHOLDERS : []),
    ...COMMON_PLACEHOLDERS,
    ...(includeFormFields.trim()
      ? includeFormFields.split(",").map((f) => f.trim()).filter(Boolean).map((f) => ({ key: `{{form:${f}}}`, label: `フォーム: ${f}` }))
      : []),
    ...customParams.map((cp) => ({ key: `{{custom:${cp.key}}}`, label: `カスタム: ${cp.label || cp.key}` })),
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{rule ? "ルール編集" : "ルール作成"}</DialogTitle></DialogHeader>

        <div className="space-y-6">
          {/* 基本設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>ルール名 *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 申請予約通知" /></div>
            <div>
              <Label>Telegramボット *</Label>
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{bots.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>イベント種別 *</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isBookingEvent && (
              <div>
                <Label>予約プレフィックス *</Label>
                <Input value={bookingPrefix} onChange={(e) => setBookingPrefix(e.target.value)} placeholder="例: cl2" />
                <p className="text-xs text-muted-foreground mt-1">プロラインの予約カレンダー番号</p>
              </div>
            )}
          </div>

          {/* カスタムパラメータ */}
          {eventType === "custom" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>カスタムパラメータ</Label>
                <Button variant="outline" size="sm" onClick={() => setCustomParams([...customParams, { key: "", label: "" }])}>
                  <Plus className="h-3 w-3 mr-1" />追加
                </Button>
              </div>
              {customParams.map((cp, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input value={cp.key} onChange={(e) => { const u = [...customParams]; u[i] = { ...cp, key: e.target.value }; setCustomParams(u); }} placeholder="パラメータ名" className="flex-1" />
                  <Input value={cp.label} onChange={(e) => { const u = [...customParams]; u[i] = { ...cp, label: e.target.value }; setCustomParams(u); }} placeholder="表示名" className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => setCustomParams(customParams.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* LINE友達情報 */}
          <div>
            <Label>LINE友達情報の参照先</Label>
            <Select value={lineAccountType} onValueChange={setLineAccountType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LINE_ACCOUNT_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* 送信先設定 */}
          <div>
            <Label>送信先 *</Label>
            <Select value={topicStrategy} onValueChange={(v) => { setTopicStrategy(v); setGroupId(""); setFixedTopicId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TOPIC_STRATEGIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* グループ直接 or 固定トピック */}
          {(topicStrategy === "group_direct" || topicStrategy === "fixed") && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>送信先グループ *</Label>
                <Select value={groupId} onValueChange={(v) => { setGroupId(v); setFixedTopicId(""); }}>
                  <SelectTrigger><SelectValue placeholder="グループを選択" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {topicStrategy === "fixed" && selectedGroup && (
                <div>
                  <Label>送信先トピック *</Label>
                  <Select value={fixedTopicId} onValueChange={setFixedTopicId}>
                    <SelectTrigger><SelectValue placeholder="トピックを選択" /></SelectTrigger>
                    <SelectContent>
                      {selectedGroup.topics.map((t) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* 担当者別マッピング */}
          {topicStrategy === "staff_mapped" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>担当者 → トピック マッピング</Label>
                <Button variant="outline" size="sm" onClick={() => setTopicMappings([...topicMappings, { staffName: "", telegramTopicId: "", telegramMention: "", isDefault: false }])}>
                  <Plus className="h-3 w-3 mr-1" />追加
                </Button>
              </div>
              {topicMappings.length === 0 && <p className="text-xs text-muted-foreground">マッピングがありません。</p>}
              {topicMappings.map((m, i) => (
                <div key={i} className="flex gap-2 items-center mb-2">
                  <Input value={m.staffName} onChange={(e) => { const u = [...topicMappings]; u[i] = { ...m, staffName: e.target.value }; setTopicMappings(u); }} placeholder="担当者名" className="w-24" />
                  <Select value={m.telegramTopicId} onValueChange={(v) => { const u = [...topicMappings]; u[i] = { ...m, telegramTopicId: v }; setTopicMappings(u); }}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="トピックを選択" /></SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => g.topics.map((t) => (
                        <SelectItem key={t.id} value={t.id.toString()}>{g.name} / {t.name}</SelectItem>
                      )))}
                    </SelectContent>
                  </Select>
                  <Input value={m.telegramMention} onChange={(e) => { const u = [...topicMappings]; u[i] = { ...m, telegramMention: e.target.value }; setTopicMappings(u); }} placeholder="@メンション" className="w-28" />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input type="checkbox" checked={m.isDefault} onChange={(e) => { const u = [...topicMappings]; u[i] = { ...m, isDefault: e.target.checked }; setTopicMappings(u); }} />
                    デフォルト
                  </label>
                  <Button variant="ghost" size="icon" onClick={() => setTopicMappings(topicMappings.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}

          {/* フォームフィールド */}
          <div>
            <Label>フォームフィールド（オプション）</Label>
            <Input value={includeFormFields} onChange={(e) => setIncludeFormFields(e.target.value)} placeholder="例: form2-1, form2-2" />
            <p className="text-xs text-muted-foreground mt-1">プロラインから受け取るフォーム回答（カンマ区切り）</p>
          </div>

          {/* メッセージテンプレート */}
          <div>
            <Label>通知メッセージ *</Label>
            <Textarea
              value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={8}
              placeholder={"例:\n【申請予約がされました】\n{{booking_datetime}}\n{{staff_name}}\n\nLINE名: {{linename}}\nuid: {{uid}}"}
              className="font-mono text-sm"
            />
            <PlaceholderHelper placeholders={availablePlaceholders} onInsert={insertPlaceholder} />
          </div>

          {/* 重複防止 */}
          <div>
            <Label>重複防止（秒）</Label>
            <Input type="number" value={duplicateLockSeconds} onChange={(e) => setDuplicateLockSeconds(e.target.value)} className="w-32" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Placeholder Helper
// ============================================

function PlaceholderHelper({
  placeholders,
  onInsert,
}: {
  placeholders: Array<{ key: string; label: string; desc?: string }>;
  onInsert: (key: string) => void;
}) {
  const [showDesc, setShowDesc] = useState(false);

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        {placeholders.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onInsert(p.key)}
            className="text-xs bg-muted hover:bg-muted/80 px-2 py-0.5 rounded border cursor-pointer"
            title={p.label}
          >
            {p.key}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowDesc(!showDesc)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-3 w-3" />
        <span>プレースホルダーの説明を{showDesc ? "閉じる" : "見る"}</span>
        {showDesc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showDesc && (
        <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0">
              <tr className="bg-muted">
                <th className="text-left px-3 py-1.5 font-medium">プレースホルダー</th>
                <th className="text-left px-3 py-1.5 font-medium">名称</th>
                <th className="text-left px-3 py-1.5 font-medium">説明・例</th>
              </tr>
            </thead>
            <tbody>
              {placeholders.map((p, i) => (
                <tr key={p.key} className={i % 2 === 0 ? "bg-white" : "bg-muted/30"}>
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => onInsert(p.key)}
                      className="font-mono text-blue-600 hover:underline cursor-pointer"
                    >
                      {p.key}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{p.label}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{p.desc || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
