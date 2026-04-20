"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertTriangle,
  ClipboardList,
  Plus,
  History,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import type {
  SessionSummaryForUI,
  CompanySessionAlerts,
  StaffOption,
  CompanyContactForCompletion,
  CompanyContactForNotify,
  ReferrerOptionForUI,
} from "./meeting-sessions-section";
import type { SessionCategory, SessionStatus } from "@/lib/slp/session-helper";
import { ManualSetModal } from "./manual-set-modal";
import { PendingCreateModal } from "./pending-create-modal";
import { StatusChangeModal } from "./status-change-modal";
import { PromoteToReservedModal } from "./promote-to-reserved-modal";
import { SessionEditModal } from "./session-edit-modal";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { SessionHistoryModal } from "./session-history-modal";
import { SessionContactHistoriesModal } from "./session-contact-histories-modal";
import { CompletionModal } from "./completion-modal";
import { NoShowModal } from "./no-show-modal";
import { SessionZoomIssuePanel } from "./session-zoom-issue-panel";
import { SessionNotifyOverrideModal } from "./session-notify-override-modal";
import { formatRoundNumber } from "./round-label";
import { updateSessionDetail } from "../session-actions";
import { BellRing } from "lucide-react";

// 予約日/案内日を日付+時刻に分解/結合
function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return {
    date: `${y}-${m}-${day}`,
    time: `${h}:${min}`,
  };
}

function formatJstDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

function combineDateTime(date: string, time: string): Date | null {
  if (!date) return null;
  const t = time || "00:00";
  // JST としてパースしてUTCに変換
  const iso = `${date}T${t}:00+09:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function sessionLabel(s: SessionSummaryForUI): string {
  const statusSuffix =
    s.status === "完了" ? "完了"
    : s.status === "キャンセル" ? "キャンセル"
    : s.status === "飛び" ? "飛び"
    : s.status === "未予約" ? "未予約"
    : "予約中";
  return `${formatRoundNumber(s.roundNumber)}（${statusSuffix}）`;
}

// ==========================================================
// カテゴリブロック（概要案内 / 導入希望商談）
// ==========================================================

interface CategoryBlockProps {
  title: string;
  category: SessionCategory;
  sessions: SessionSummaryForUI[];
  duplicateCount: number;
  companyRecordId: number;
  staffOptions: StaffOption[];
  contacts: CompanyContactForCompletion[];
  contactsForNotify: CompanyContactForNotify[];
  referrerOptions: ReferrerOptionForUI[];
  onDataChange: () => void;
}

function CategoryBlock({
  title,
  category,
  sessions,
  duplicateCount,
  companyRecordId,
  staffOptions,
  contacts,
  contactsForNotify,
  referrerOptions,
  onDataChange,
}: CategoryBlockProps) {
  // useSearchParams はサーバ/クライアントでタイミング差を招きハイドレーションミスマッチの原因になるため、
  // マウント後に window.location から読み取る方式に変更。
  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
    [sessions]
  );

  const latestSession = sortedSessions[sortedSessions.length - 1];

  // 初期値はサーバ/クライアント共通で決定論的に（最新セッション or 空）。
  // URL query からの復元はマウント後の useEffect で行う。
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    latestSession ? String(latestSession.id) : ""
  );

  // マウント後に URL query からセッション指定を拾って反映
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlSessionId = params.get(`${category}SessionId`);
    if (urlSessionId && sortedSessions.some((s) => String(s.id) === urlSessionId)) {
      setSelectedSessionId(urlSessionId);
    }
  }, [category, sortedSessions]);

  // 選択中セッションが削除された等で消えた場合、最新にフォールバック
  useEffect(() => {
    if (
      selectedSessionId &&
      sortedSessions.length > 0 &&
      !sortedSessions.some((s) => String(s.id) === selectedSessionId)
    ) {
      setSelectedSessionId(String(sortedSessions[sortedSessions.length - 1].id));
    }
  }, [selectedSessionId, sortedSessions]);

  const selected = sortedSessions.find((s) => String(s.id) === selectedSessionId) ?? null;
  const hasAny = sortedSessions.length > 0;
  const duplicateWarning = duplicateCount >= 2;

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  const handleCreated = (newSessionId?: number) => {
    if (newSessionId) {
      // 新規追加後は Select を直接切り替える（URLは現在のものを維持）
      setSelectedSessionId(String(newSessionId));
    }
    onDataChange();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {hasAny && sortedSessions.length > 1 && (
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="打ち合わせを選択" />
                </SelectTrigger>
                <SelectContent>
                  {sortedSessions.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                      {sessionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs h-8">
                  <Plus className="h-3 w-3 mr-1" />
                  新しい打ち合わせ
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setManualModalOpen(true)}>
                  手動で予約中として作成
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setPendingModalOpen(true)}>
                  未予約として起票
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ManualSetModal
          open={manualModalOpen}
          onOpenChange={setManualModalOpen}
          companyRecordId={companyRecordId}
          category={category}
          staffOptions={staffOptions}
          referrerOptions={referrerOptions}
          onCreated={handleCreated}
        />
        <PendingCreateModal
          open={pendingModalOpen}
          onOpenChange={setPendingModalOpen}
          companyRecordId={companyRecordId}
          category={category}
          onCreated={handleCreated}
        />

        {duplicateWarning && (
          <Alert variant="destructive" className="py-2 mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              ⚠️ 予約中/未予約の打ち合わせが {duplicateCount} 件あります。スタッフで整理してください。
            </AlertDescription>
          </Alert>
        )}

        {!hasAny ? (
          <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            打ち合わせはまだ作成されていません
          </div>
        ) : selected ? (
          <SessionForm
            session={selected}
            category={category}
            categoryLabel={title}
            staffOptions={staffOptions}
            contacts={contacts}
            contactsForNotify={contactsForNotify}
            referrerOptions={referrerOptions}
            onDataChange={onDataChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

// ==========================================================
// 1セッションのインライン編集フォーム
// ==========================================================

interface SessionFormProps {
  session: SessionSummaryForUI;
  category: SessionCategory;
  categoryLabel: string;
  staffOptions: StaffOption[];
  contacts: CompanyContactForCompletion[];
  contactsForNotify: CompanyContactForNotify[];
  referrerOptions: ReferrerOptionForUI[];
  onDataChange: () => void;
}

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "未予約", label: "未予約" },
  { value: "予約中", label: "予約中" },
  { value: "完了", label: "完了" },
  { value: "キャンセル", label: "キャンセル" },
  { value: "飛び", label: "飛び" },
];

function SessionForm({
  session,
  category,
  categoryLabel,
  staffOptions,
  contacts,
  contactsForNotify,
  referrerOptions,
  onDataChange,
}: SessionFormProps) {
  const bookedSplit = splitIso(session.bookedAt);
  const scheduledSplit = splitIso(session.scheduledAt);

  const [bookedDate, setBookedDate] = useState(bookedSplit.date);
  const [bookedTime, setBookedTime] = useState(bookedSplit.time);
  const [scheduledDate, setScheduledDate] = useState(scheduledSplit.date);
  const [scheduledTime, setScheduledTime] = useState(scheduledSplit.time);
  const [staffId, setStaffId] = useState<string>(
    session.assignedStaffId?.toString() ?? "__unset__"
  );
  const [notes, setNotes] = useState(session.notes ?? "");
  const [saving, setSaving] = useState(false);

  // session が切り替わったら state を同期
  useEffect(() => {
    const b = splitIso(session.bookedAt);
    const s = splitIso(session.scheduledAt);
    setBookedDate(b.date);
    setBookedTime(b.time);
    setScheduledDate(s.date);
    setScheduledTime(s.time);
    setStaffId(session.assignedStaffId?.toString() ?? "__unset__");
    setNotes(session.notes ?? "");
  }, [session.id, session.bookedAt, session.scheduledAt, session.assignedStaffId, session.notes]);

  // ステータス変更モーダル類
  const [statusReasonOpen, setStatusReasonOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SessionStatus | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactHistOpen, setContactHistOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [notifyOverrideOpen, setNotifyOverrideOpen] = useState(false);
  // Zoom URL / 議事録取得は接触履歴画面に移管（「接触履歴を見る」から操作）

  // ステータス直接変更ハンドラ
  const handleStatusChange = (value: string) => {
    const newStatus = value as SessionStatus;
    if (newStatus === session.status) return;

    // 未予約 → 予約中：昇格モーダル
    if (session.status === "未予約" && newStatus === "予約中") {
      setPromoteOpen(true);
      return;
    }
    // 予約中 → 完了：お礼モーダル（理由不要）
    if (session.status === "予約中" && newStatus === "完了") {
      setCompletionOpen(true);
      return;
    }
    // キャンセル → 完了：お礼モーダル（理由必須）
    if (session.status === "キャンセル" && newStatus === "完了") {
      setCompletionOpen(true);
      return;
    }
    // 予約中 → 飛び：飛びモーダル（理由任意 + 紹介者通知チェック）
    if (session.status === "予約中" && newStatus === "飛び") {
      setNoShowOpen(true);
      return;
    }
    // その他：理由必須モーダル
    setPendingStatus(newStatus);
    setStatusReasonOpen(true);
  };

  // フィールド保存
  const fieldsDirty =
    bookedDate !== bookedSplit.date ||
    bookedTime !== bookedSplit.time ||
    scheduledDate !== scheduledSplit.date ||
    scheduledTime !== scheduledSplit.time ||
    staffId !== (session.assignedStaffId?.toString() ?? "__unset__") ||
    notes !== (session.notes ?? "");

  const handleSave = async () => {
    if (!fieldsDirty) {
      toast.info("変更がありません");
      return;
    }
    // プロラインソースは理由必須のため、編集モーダルを開く
    if (session.source === "proline") {
      setEditModalOpen(true);
      return;
    }
    // 手動ソースは理由不要、即保存
    setSaving(true);
    try {
      const r = await updateSessionDetail({
        sessionId: session.id,
        fields: {
          bookedAt: combineDateTime(bookedDate, bookedTime),
          scheduledAt: combineDateTime(scheduledDate, scheduledTime),
          assignedStaffId: staffId === "__unset__" ? null : parseInt(staffId, 10),
          notes: notes.trim() || null,
        },
      });
      if (r.ok) {
        toast.success("保存しました");
        onDataChange();
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ステータス + 変更履歴アイコン */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Label>ステータス</Label>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            title="変更履歴を表示"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            {session.source === "proline" ? (
              <Badge variant="outline" className="text-[10px]">プロライン起票</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">手動セット</Badge>
            )}
          </span>
        </div>

        {/* 予約者 + 通知対象個別設定ボタン */}
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {session.bookerContactId !== null && (() => {
            const bookerIncluded =
              !session.hasNotifyOverride ||
              session.notifyOverrideContactIds.includes(session.bookerContactId);
            return (
              <div className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
                <span className="font-medium">予約した人:</span>
                <span>{session.bookerContactName ?? "(名前なし)"}</span>
                {!session.hasNotifyOverride && (
                  <span className="text-[10px] text-emerald-700">（必ず通知）</span>
                )}
                {session.hasNotifyOverride && bookerIncluded && (
                  <span className="text-[10px] text-emerald-700">（個別設定に含まれる）</span>
                )}
                {session.hasNotifyOverride && !bookerIncluded && (
                  <span className="text-[10px] text-amber-700">（個別設定で通知対象外）</span>
                )}
              </div>
            );
          })()}
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => setNotifyOverrideOpen(true)}
          >
            <BellRing className="h-3 w-3 mr-1" />
            通知対象を個別設定
            {session.hasNotifyOverride && (
              <Badge
                variant="outline"
                className="ml-1.5 text-[10px] bg-amber-50 border-amber-300 text-amber-800"
              >
                設定中 ({session.notifyOverrideContactIds.length}名)
              </Badge>
            )}
          </Button>
        </div>
        <Select value={session.status} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          ※ ステータス変更は即座に反映されます（保存ボタン不要）
        </p>
      </div>

      <hr />

      {/* 予約日 / 案内日 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>予約日</Label>
          <div className="flex gap-2">
            <DatePicker value={bookedDate} onChange={setBookedDate} className="flex-1" />
            <Input
              type="time"
              value={bookedTime}
              onChange={(e) => setBookedTime(e.target.value)}
              className="w-[120px]"
            />
          </div>
        </div>
        <div>
          <Label>{category === "briefing" ? "案内日" : "商談日"}</Label>
          <div className="flex gap-2">
            <DatePicker value={scheduledDate} onChange={setScheduledDate} className="flex-1" />
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="w-[120px]"
            />
          </div>
        </div>

        {/* 担当者 */}
        <div className="md:col-span-2">
          <Label>{category === "briefing" ? "案内担当者" : "商談担当者"}</Label>
          {!session.assignedStaffId && session.prolineStaffName && (
            <div className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              プロラインからの担当者名: <strong>{session.prolineStaffName}</strong>
              <span className="text-amber-600 ml-1">（マッピング未登録）</span>
            </div>
          )}
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger>
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unset__">未選択</SelectItem>
              {staffOptions.map((o) => (
                <SelectItem key={o.id} value={o.id.toString()}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            公的(SLP)に閲覧以上の権限を持つスタッフのみ表示
          </p>
        </div>
      </div>

      {/* 各商談の primary Zoom 管理（手動発行 / 再発行 / URL表示） */}
      {session.status !== "キャンセル" && session.status !== "飛び" && (
        <SessionZoomIssuePanel
          sessionId={session.id}
          categoryLabel={categoryLabel}
          primary={session.zooms.find((z) => z.isPrimary) ?? null}
          zoomError={session.zooms.find((z) => z.isPrimary)?.zoomError ?? null}
          zoomErrorAt={session.zooms.find((z) => z.isPrimary)?.zoomErrorAt ?? null}
        />
      )}
      {/* 追加Zoom・議事録は接触履歴画面で管理（「接触履歴を見る」ボタン参照） */}

      {/* メモ */}
      <div>
        <Label>メモ</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="スタッフ用メモ"
        />
      </div>

      {/* 予約ID + キャンセル・飛び理由 */}
      {session.prolineReservationId && (
        <div className="text-xs">
          <span className="text-muted-foreground">予約ID: </span>
          <code className="font-mono bg-slate-100 px-2 py-0.5 rounded">
            {session.prolineReservationId}
          </code>
        </div>
      )}
      {session.status === "キャンセル" && session.cancelReason && (
        <div className="rounded bg-neutral-50 p-2 border text-xs">
          <div className="text-muted-foreground mb-1">キャンセル理由</div>
          <div className="whitespace-pre-wrap">{session.cancelReason}</div>
        </div>
      )}
      {session.status === "飛び" && session.noShowReason && (
        <div className="rounded bg-red-50 p-2 border border-red-200 text-xs">
          <div className="text-muted-foreground mb-1">飛び理由</div>
          <div className="whitespace-pre-wrap">{session.noShowReason}</div>
        </div>
      )}

      {/* アクションボタン群 */}
      <div className="flex flex-wrap gap-2 pt-3 border-t items-center">
        <Button
          size="sm"
          variant="default"
          onClick={handleSave}
          disabled={saving || !fieldsDirty}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setContactHistOpen(true)}
        >
          接触履歴を見る（{session.contactHistoriesCount}件）
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
          <History className="h-3.5 w-3.5 mr-1" />
          変更履歴
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            削除
          </Button>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">
        {session.createdByStaffName && <>起票: {session.createdByStaffName} / </>}
        作成: {formatJstDateTime(session.createdAt)}
      </div>

      {/* モーダル群 */}
      <StatusChangeModal
        open={statusReasonOpen}
        onOpenChange={(open) => {
          setStatusReasonOpen(open);
          if (!open) setPendingStatus(null);
        }}
        sessionId={session.id}
        currentStatus={session.status}
        targetStatus={pendingStatus}
        roundNumber={session.roundNumber}
        onDone={onDataChange}
      />
      <PromoteToReservedModal
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        sessionId={session.id}
        category={category}
        roundNumber={session.roundNumber}
        staffOptions={staffOptions}
        referrerOptions={referrerOptions}
        currentScheduledAt={session.scheduledAt}
        currentAssignedStaffId={session.assignedStaffId}
        onDone={onDataChange}
      />
      <SessionEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        sessionId={session.id}
        roundNumber={session.roundNumber}
        currentScheduledAt={session.scheduledAt}
        currentBookedAt={session.bookedAt}
        currentAssignedStaffId={session.assignedStaffId}
        currentNotes={session.notes}
        hasRecording={session.hasRecording}
        staffOptions={staffOptions}
        pendingFields={{
          bookedDate,
          bookedTime,
          scheduledDate,
          scheduledTime,
          staffId,
          notes,
        }}
        onDone={onDataChange}
      />
      <DeleteConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        sessionId={session.id}
        roundNumber={session.roundNumber}
        onDone={onDataChange}
      />
      <SessionHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        sessionId={session.id}
        roundNumber={session.roundNumber}
      />
      <SessionContactHistoriesModal
        open={contactHistOpen}
        onOpenChange={setContactHistOpen}
        sessionId={session.id}
        titleLabel={`${formatRoundNumber(session.roundNumber)} ${categoryLabel}`}
        staffOptions={staffOptions}
      />
      <CompletionModal
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        sessionId={session.id}
        category={category}
        roundNumber={session.roundNumber}
        fromStatus={session.status}
        contacts={contacts}
        onDone={onDataChange}
      />
      <NoShowModal
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        sessionId={session.id}
        category={category}
        roundNumber={session.roundNumber}
        source={session.source}
        referrerOptions={referrerOptions}
        onDone={onDataChange}
      />
      <SessionNotifyOverrideModal
        open={notifyOverrideOpen}
        onOpenChange={setNotifyOverrideOpen}
        sessionId={session.id}
        sessionLabel={`${formatRoundNumber(session.roundNumber)} ${categoryLabel}`}
        contacts={contactsForNotify}
        bookerContactId={session.bookerContactId}
        hasOverride={session.hasNotifyOverride}
        overrideContactIds={session.notifyOverrideContactIds}
        onDone={onDataChange}
      />
    </div>
  );
}

// ==========================================================
// メインカード
// ==========================================================

export function MeetingSessionsCard({
  companyRecordId,
  briefingSessions,
  consultationSessions,
  alerts,
  staffOptions,
  contacts,
  contactsForNotify,
  referrerOptions,
}: {
  companyRecordId: number;
  briefingSessions: SessionSummaryForUI[];
  consultationSessions: SessionSummaryForUI[];
  alerts: CompanySessionAlerts;
  staffOptions: StaffOption[];
  contacts: CompanyContactForCompletion[];
  contactsForNotify: CompanyContactForNotify[];
  referrerOptions: ReferrerOptionForUI[];
}) {
  const router = useRouter();
  const handleDataChange = () => {
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {alerts.noShowTotal > 0 && (
        <Alert className="py-2 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-xs text-amber-800 flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5" />
            過去に「飛び」の記録が {alerts.noShowTotal} 件あります
          </AlertDescription>
        </Alert>
      )}

      <CategoryBlock
        title="概要案内"
        category="briefing"
        sessions={briefingSessions}
        duplicateCount={alerts.duplicateBriefing}
        companyRecordId={companyRecordId}
        staffOptions={staffOptions}
        contacts={contacts}
        contactsForNotify={contactsForNotify}
        referrerOptions={referrerOptions}
        onDataChange={handleDataChange}
      />
      <CategoryBlock
        title="導入希望商談"
        category="consultation"
        sessions={consultationSessions}
        duplicateCount={alerts.duplicateConsultation}
        companyRecordId={companyRecordId}
        staffOptions={staffOptions}
        contacts={contacts}
        contactsForNotify={contactsForNotify}
        referrerOptions={referrerOptions}
        onDataChange={handleDataChange}
      />
    </div>
  );
}
