import { prisma } from "@/lib/prisma";
import { MeetingSessionsCard } from "./meeting-sessions-card";
import type { SessionCategory, SessionStatus } from "@/lib/slp/session-helper";
import { resolveReferrersForCompany } from "@/lib/slp/company-resolution";

export interface StaffOption {
  id: number;
  name: string;
}

export interface SessionZoomForUI {
  id: number;
  zoomMeetingId: string; // BigInt → string
  joinUrl: string;
  startUrl: string | null;
  scheduledAt: string | null;
  isPrimary: boolean;
  label: string | null;
  hostStaffId: number | null;
  hostStaffName: string | null;
  /** ホスト担当者のZoom連携が有効か（null→無効=API連携なし扱い） */
  hostIntegrationActive: boolean;
  hasRecording: boolean;
  zoomError: string | null;
  zoomErrorAt: string | null;
}

export interface SessionSummaryForUI {
  id: number;
  category: SessionCategory;
  roundNumber: number;
  status: SessionStatus;
  source: "proline" | "manual";
  bookedAt: string | null; // ISO: 予約発生日時（予約日）
  scheduledAt: string | null; // ISO: 実施予定日時（案内日/商談日）
  assignedStaffId: number | null;
  assignedStaffName: string | null;
  prolineStaffName: string | null; // プロラインから来た担当者名（マッピング未登録時の警告用）
  completedAt: string | null;
  cancelledAt: string | null;
  noShowAt: string | null;
  notes: string | null;
  prolineReservationId: string | null;
  cancelReason: string | null;
  noShowReason: string | null;
  createdByStaffName: string | null;
  createdAt: string;
  zooms: SessionZoomForUI[];
  hasRecording: boolean;
  contactHistoriesCount: number;
  /** 予約を行った担当者（SlpCompanyContact.id）— プロライン経由予約時のみ値あり */
  bookerContactId: number | null;
  bookerContactName: string | null;
  /** この商談の通知対象 個別設定が存在するか */
  hasNotifyOverride: boolean;
  /** 個別設定の対象コンタクトID群（UIで初期値として使う） */
  notifyOverrideContactIds: number[];
}

/** 通知対象設定に使う事業者の担当者一覧（商談カードのモーダル用） */
export interface CompanyContactForNotify {
  id: number;
  name: string | null;
  lineFriendLabel: string | null;
  isPrimary: boolean;
  receivesSessionNotifications: boolean;
}

export interface CompanyContactForCompletion {
  id: number;
  name: string | null;
  lineFriendLabel: string | null;
}

export interface ReferrerOptionForUI {
  lineFriendId: number;
  label: string; // "{lineFriendId} {snsname}"
}

export interface CompanySessionAlerts {
  duplicateBriefing: number; // 2件以上で重複
  duplicateConsultation: number;
  noShowTotal: number;
}

// 商談ブロック（Server Component - データ取得＋Clientへ受け渡し）
// SlpMeetingSession テーブルから直接読み取って表示する。
export async function MeetingSessionsSection({
  companyRecordId,
}: {
  companyRecordId: number;
}) {
  // SLP プロジェクトIDを先に取得（staff絞り込み用）
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });

  const [sessions, activeBriefing, activeConsultation, noShowTotal, staffAssignments, companyContacts, referrers] = await Promise.all([
    prisma.slpMeetingSession.findMany({
      where: { companyRecordId, deletedAt: null },
      orderBy: [{ category: "asc" }, { roundNumber: "asc" }, { createdAt: "asc" }],
      include: {
        assignedStaff: { select: { name: true } },
        createdByStaff: { select: { name: true } },
        bookerContact: { select: { id: true, name: true } },
        notifyOverrides: { select: { contactId: true } },
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        category: "briefing",
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        category: "consultation",
        status: { in: ["未予約", "予約中"] },
        deletedAt: null,
      },
    }),
    prisma.slpMeetingSession.count({
      where: {
        companyRecordId,
        status: "飛び",
        deletedAt: null,
      },
    }),
    slpProject
      ? prisma.staffProjectAssignment.findMany({
          where: { projectId: slpProject.id, staff: { isActive: true, isSystemUser: false } },
          include: { staff: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.slpCompanyContact.findMany({
      where: { companyRecordId },
      include: {
        lineFriend: { select: { id: true, snsname: true, uid: true } },
      },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    }),
    resolveReferrersForCompany(companyRecordId),
  ]);

  const staffOptions: StaffOption[] = staffAssignments
    .map((a) => ({ id: a.staff.id, name: a.staff.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const contactsForCompletion: CompanyContactForCompletion[] = companyContacts.map((c) => ({
    id: c.id,
    name: c.name,
    lineFriendLabel: c.lineFriend
      ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
      : null,
  }));

  const contactsForNotify: CompanyContactForNotify[] = companyContacts.map((c) => ({
    id: c.id,
    name: c.name,
    lineFriendLabel: c.lineFriend
      ? `${c.lineFriend.id} ${c.lineFriend.snsname ?? ""}`.trim()
      : null,
    isPrimary: c.isPrimary,
    receivesSessionNotifications: c.receivesSessionNotifications,
  }));

  const referrerOptions: ReferrerOptionForUI[] = referrers.map((r) => ({
    lineFriendId: r.lineFriendId,
    label: r.label,
  }));

  const briefing: SessionSummaryForUI[] = [];
  const consultation: SessionSummaryForUI[] = [];
  const sessionIds = sessions.map((s) => String(s.id));
  const v2ContactHistories =
    sessionIds.length > 0
      ? await prisma.contactHistoryV2.findMany({
          where: {
            sourceType: "slp_meeting_session",
            sourceRefId: { in: sessionIds },
            deletedAt: null,
          },
          include: {
            meetings: {
              where: { deletedAt: null },
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              include: {
                hostStaff: {
                  select: {
                    id: true,
                    name: true,
                    meetingIntegrations: {
                      where: { provider: "zoom", disconnectedAt: null },
                      select: { id: true },
                    },
                  },
                },
                record: {
                  select: {
                    aiSummary: true,
                    transcriptText: true,
                    recordingUrl: true,
                    recordingPath: true,
                  },
                },
              },
            },
          },
        })
      : [];
  const v2BySessionId = new Map<string, typeof v2ContactHistories>();
  for (const ch of v2ContactHistories) {
    if (!ch.sourceRefId) continue;
    const rows = v2BySessionId.get(ch.sourceRefId) ?? [];
    rows.push(ch);
    v2BySessionId.set(ch.sourceRefId, rows);
  }

  for (const s of sessions) {
    const linkedV2Histories = v2BySessionId.get(String(s.id)) ?? [];
    const meetings = linkedV2Histories.flatMap((ch) => ch.meetings);
    const zooms: SessionZoomForUI[] = meetings.map((m) => ({
      id: m.id,
      zoomMeetingId: m.externalMeetingId ?? "",
      joinUrl: m.joinUrl ?? "",
      startUrl: m.startUrl,
      scheduledAt: m.scheduledStartAt?.toISOString() ?? null,
      isPrimary: m.isPrimary,
      label: m.label,
      hostStaffId: m.hostStaffId,
      hostStaffName: m.hostStaff?.name ?? null,
      hostIntegrationActive:
        !!m.hostStaff && (m.hostStaff.meetingIntegrations?.length ?? 0) > 0,
      hasRecording:
        m.state === "完了" ||
        !!m.record?.aiSummary ||
        !!m.record?.transcriptText ||
        !!m.record?.recordingUrl ||
        !!m.record?.recordingPath,
      zoomError: m.apiError ?? null,
      zoomErrorAt: m.apiErrorAt?.toISOString() ?? null,
    }));
    const summary: SessionSummaryForUI = {
      id: s.id,
      category: s.category as SessionCategory,
      roundNumber: s.roundNumber,
      status: s.status as SessionStatus,
      source: s.source as "proline" | "manual",
      bookedAt: s.bookedAt?.toISOString() ?? null,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      assignedStaffId: s.assignedStaffId,
      assignedStaffName: s.assignedStaff?.name ?? null,
      prolineStaffName: s.prolineStaffName ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      noShowAt: s.noShowAt?.toISOString() ?? null,
      notes: s.notes,
      prolineReservationId: s.prolineReservationId,
      cancelReason: s.cancelReason,
      noShowReason: s.noShowReason,
      createdByStaffName: s.createdByStaff?.name ?? null,
      createdAt: s.createdAt.toISOString(),
      zooms,
      hasRecording: zooms.some((z) => z.hasRecording),
      contactHistoriesCount: linkedV2Histories.length,
      bookerContactId: s.bookerContact?.id ?? null,
      bookerContactName: s.bookerContact?.name ?? null,
      hasNotifyOverride: s.notifyOverrides.length > 0,
      notifyOverrideContactIds: s.notifyOverrides.map((o) => o.contactId),
    };
    if (s.category === "briefing") briefing.push(summary);
    else if (s.category === "consultation") consultation.push(summary);
  }

  const alerts: CompanySessionAlerts = {
    duplicateBriefing: activeBriefing,
    duplicateConsultation: activeConsultation,
    noShowTotal,
  };

  return (
    <MeetingSessionsCard
      companyRecordId={companyRecordId}
      briefingSessions={briefing}
      consultationSessions={consultation}
      alerts={alerts}
      staffOptions={staffOptions}
      contacts={contactsForCompletion}
      contactsForNotify={contactsForNotify}
      referrerOptions={referrerOptions}
    />
  );
}
